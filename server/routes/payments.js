const express = require('express');
const router = express.Router();
const { db, getNextDocNumber, logAudit, recalculateCustomerBalance } = require('../db');

// GET /api/payments/summary
router.get('/summary', (req, res) => {
  try {
    const summary = db.prepare(`
      SELECT 
        COUNT(id) as total_payments,
        COALESCE(SUM(amount), 0) as total_received,
        COALESCE(SUM(CASE WHEN strftime('%Y-%m', payment_date) = strftime('%Y-%m', 'now') THEN amount ELSE 0 END), 0) as this_month_received
      FROM payments_received
      WHERE is_deleted = 0
    `).get();

    // Also get unpaid receivables summary
    const receivables = db.prepare(`
      SELECT 
        COALESCE(SUM(balance), 0) as pending_receivables,
        COALESCE(SUM(CASE WHEN payment_status = 'Overdue' THEN balance ELSE 0 END), 0) as overdue_receivables
      FROM sales
      WHERE is_deleted = 0 AND status != 'Void'
    `).get();

    res.json({
      success: true,
      data: {
        ...summary,
        ...receivables
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/payments
router.get('/', (req, res) => {
  try {
    const { search, customer_id, from_date, to_date, payment_method, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT 
        pr.id, pr.payment_number, pr.payment_date, pr.amount, pr.payment_method,
        pr.reference_number, pr.notes, pr.created_at,
        c.id as customer_id, c.name as customer_name, c.company_name as customer_company,
        s.id as sale_id, s.invoice_number, s.total as invoice_total
      FROM payments_received pr
      JOIN customers c ON pr.customer_id = c.id
      LEFT JOIN sales s ON pr.sale_id = s.id
      WHERE pr.is_deleted = 0
    `;
    const params = [];

    if (search) {
      query += ` AND (pr.payment_number LIKE ? OR pr.reference_number LIKE ? OR c.name LIKE ? OR c.company_name LIKE ? OR s.invoice_number LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    if (customer_id) {
      query += ` AND pr.customer_id = ?`;
      params.push(Number(customer_id));
    }

    if (payment_method && payment_method !== 'All') {
      query += ` AND pr.payment_method = ?`;
      params.push(payment_method);
    }

    if (from_date) {
      query += ` AND pr.payment_date >= ?`;
      params.push(from_date);
    }

    if (to_date) {
      query += ` AND pr.payment_date <= ?`;
      params.push(to_date);
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const totalCount = db.prepare(countQuery).get(...params).total;

    query += ` ORDER BY pr.payment_date DESC, pr.id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const payments = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: payments,
      pagination: {
        total: totalCount,
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/payments/:id
router.get('/:id', (req, res) => {
  try {
    const payment = db.prepare(`
      SELECT 
        pr.*,
        c.name as customer_name, c.company_name as customer_company, c.email as customer_email,
        c.phone as customer_phone, c.address as customer_address, c.tax_number as customer_tax,
        s.invoice_number, s.invoice_date, s.total as invoice_total, s.balance as invoice_balance
      FROM payments_received pr
      JOIN customers c ON pr.customer_id = c.id
      LEFT JOIN sales s ON pr.sale_id = s.id
      WHERE pr.id = ? AND pr.is_deleted = 0
    `).get(req.params.id);

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment record not found' });
    }

    const business = db.prepare('SELECT * FROM businesses WHERE id = 1').get();

    res.json({ success: true, data: { ...payment, business } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/payments (Record Payment with Atomic Invoice & Customer Balance Update)
router.post('/', (req, res) => {
  try {
    const { customer_id, sale_id, payment_date, amount, payment_method = 'Bank Transfer', reference_number, notes } = req.body;

    if (!customer_id) {
      return res.status(400).json({ success: false, error: 'Customer is required.' });
    }
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Payment amount must be greater than 0.' });
    }
    if (!payment_date) {
      return res.status(400).json({ success: false, error: 'Payment date is required.' });
    }

    const paymentAmount = Number(amount);

    const paymentTx = db.transaction(() => {
      // 1. Generate sequence number
      const paymentNumber = getNextDocNumber(db, 1, 'PAY');

      // 2. Insert payment record
      const info = db.prepare(`
        INSERT INTO payments_received (
          business_id, customer_id, sale_id, payment_number, payment_date,
          amount, payment_method, reference_number, notes
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        customer_id,
        sale_id ? Number(sale_id) : null,
        paymentNumber,
        payment_date,
        paymentAmount,
        payment_method,
        reference_number ? reference_number.trim() : null,
        notes ? notes.trim() : 'Payment settlement'
      );

      const paymentId = info.lastInsertRowid;

      // 3. If linked to an invoice, update invoice
      if (sale_id) {
        const sale = db.prepare('SELECT id, total, paid_amount, balance FROM sales WHERE id = ?').get(sale_id);
        if (sale) {
          const newPaid = Math.round((sale.paid_amount + paymentAmount) * 100) / 100;
          const newBalance = Math.max(0, Math.round((sale.total - newPaid) * 100) / 100);
          const newStatus = newBalance <= 0 ? 'Paid' : 'Partially Paid';

          db.prepare(`
            UPDATE sales
            SET paid_amount = ?,
                balance = ?,
                payment_status = ?,
                updated_at = datetime('now')
            WHERE id = ?
          `).run(newPaid, newBalance, newStatus, sale.id);
        }
      }

      // 4. Update customer outstanding balance
      recalculateCustomerBalance(db, customer_id);

      // 5. Audit log
      logAudit(db, {
        action: 'CREATE',
        entityType: 'PAYMENT',
        entityId: paymentId,
        newValues: { paymentNumber, customer_id, sale_id, amount: paymentAmount, payment_method }
      });

      return { paymentId, paymentNumber };
    });

    const result = paymentTx();
    const createdPayment = db.prepare('SELECT * FROM payments_received WHERE id = ?').get(result.paymentId);

    res.status(201).json({
      success: true,
      data: createdPayment,
      message: `Payment ${result.paymentNumber} recorded successfully`
    });
  } catch (err) {
    console.error('Payment error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/payments/:id
router.delete('/:id', (req, res) => {
  try {
    const payment = db.prepare('SELECT * FROM payments_received WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    const deleteTx = db.transaction(() => {
      // 1. Soft delete payment
      db.prepare('UPDATE payments_received SET is_deleted = 1, updated_at = datetime(\'now\') WHERE id = ?').run(payment.id);

      // 2. If linked to sale, roll back paid amount
      if (payment.sale_id) {
        const sale = db.prepare('SELECT id, total, paid_amount FROM sales WHERE id = ?').get(payment.sale_id);
        if (sale) {
          const newPaid = Math.max(0, Math.round((sale.paid_amount - payment.amount) * 100) / 100);
          const newBalance = Math.round((sale.total - newPaid) * 100) / 100;
          const newStatus = newPaid === 0 ? 'Pending' : (newBalance <= 0 ? 'Paid' : 'Partially Paid');

          db.prepare(`
            UPDATE sales
            SET paid_amount = ?,
                balance = ?,
                payment_status = ?,
                updated_at = datetime('now')
            WHERE id = ?
          `).run(newPaid, newBalance, newStatus, sale.id);
        }
      }

      // 3. Recalculate customer balance
      recalculateCustomerBalance(db, payment.customer_id);

      logAudit(db, {
        action: 'DELETE',
        entityType: 'PAYMENT',
        entityId: payment.id,
        oldValues: payment
      });
    });

    deleteTx();

    res.json({ success: true, message: 'Payment deleted and balances adjusted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { db, logAudit, recalculateCustomerBalance } = require('../db');

// GET /api/customers/summary
router.get('/summary', (req, res) => {
  try {
    const summary = db.prepare(`
      SELECT 
        COUNT(id) as total_customers,
        COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) as active_customers,
        COALESCE(SUM(outstanding_balance), 0) as total_outstanding
      FROM customers
      WHERE is_deleted = 0
    `).get();

    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/customers
router.get('/', (req, res) => {
  try {
    const { search, status, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT 
        c.id, c.name, c.company_name, c.email, c.phone, c.address, c.tax_number,
        c.opening_balance, c.outstanding_balance, c.is_active, c.created_at, c.updated_at,
        COALESCE(sales_agg.total_sales, 0) as total_sales,
        COALESCE(sales_agg.total_paid, 0) as total_paid
      FROM customers c
      LEFT JOIN (
        SELECT 
          customer_id,
          SUM(total) as total_sales,
          SUM(paid_amount) as total_paid
        FROM sales
        WHERE is_deleted = 0 AND status != 'Void'
        GROUP BY customer_id
      ) sales_agg ON sales_agg.customer_id = c.id
      WHERE c.is_deleted = 0
    `;
    const params = [];

    if (search) {
      query += ` AND (c.name LIKE ? OR c.company_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (status === 'active') {
      query += ` AND c.is_active = 1`;
    } else if (status === 'inactive') {
      query += ` AND c.is_active = 0`;
    } else if (status === 'outstanding') {
      query += ` AND c.outstanding_balance > 0`;
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const totalCount = db.prepare(countQuery).get(...params).total;

    query += ` ORDER BY c.name ASC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const customers = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: customers,
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

// GET /api/customers/:id
router.get('/:id', (req, res) => {
  try {
    const customer = db.prepare(`
      SELECT * FROM customers WHERE id = ? AND is_deleted = 0
    `).get(req.params.id);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Aggregates
    const salesMetrics = db.prepare(`
      SELECT 
        COALESCE(SUM(total), 0) as total_sales,
        COALESCE(SUM(paid_amount), 0) as total_paid,
        COALESCE(SUM(balance), 0) as outstanding,
        COUNT(id) as invoice_count,
        MAX(invoice_date) as last_transaction_date
      FROM sales
      WHERE customer_id = ? AND is_deleted = 0 AND status != 'Void'
    `).get(req.params.id);

    // Sales list
    const sales = db.prepare(`
      SELECT id, invoice_number, invoice_date, due_date, total, paid_amount, balance, payment_status, status
      FROM sales
      WHERE customer_id = ? AND is_deleted = 0
      ORDER BY invoice_date DESC, id DESC
    `).all(req.params.id);

    // Payments list
    const payments = db.prepare(`
      SELECT pr.id, pr.payment_number, pr.payment_date, pr.amount, pr.payment_method, pr.reference_number, pr.sale_id,
             s.invoice_number
      FROM payments_received pr
      LEFT JOIN sales s ON pr.sale_id = s.id
      WHERE pr.customer_id = ? AND pr.is_deleted = 0
      ORDER BY pr.payment_date DESC, pr.id DESC
    `).all(req.params.id);

    // Quotations list
    const quotations = db.prepare(`
      SELECT id, quotation_number, quotation_date, valid_until, total, status
      FROM quotations
      WHERE customer_id = ? AND is_deleted = 0
      ORDER BY quotation_date DESC, id DESC
    `).all(req.params.id);

    res.json({
      success: true,
      data: {
        ...customer,
        metrics: {
          totalSales: salesMetrics.total_sales,
          totalPaid: salesMetrics.total_paid,
          outstanding: customer.outstanding_balance,
          invoiceCount: salesMetrics.invoice_count,
          lastTransaction: salesMetrics.last_transaction_date || customer.created_at
        },
        sales,
        payments,
        quotations
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/customers/:id/statement (Customer Account Statement)
router.get('/:id/statement', (req, res) => {
  try {
    const { from = '2026-01-01', to = '2026-12-31' } = req.query;
    const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // 1. Calculate opening balance prior to `from` date
    const priorSales = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as prior_total
      FROM sales
      WHERE customer_id = ? AND is_deleted = 0 AND status != 'Void' AND invoice_date < ?
    `).get(req.params.id, from).prior_total;

    const priorPayments = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as prior_total
      FROM payments_received
      WHERE customer_id = ? AND is_deleted = 0 AND payment_date < ?
    `).get(req.params.id, from).prior_total;

    const openingBalance = customer.opening_balance + priorSales - priorPayments;

    // 2. Fetch sales in date range
    const rangeSales = db.prepare(`
      SELECT 
        invoice_date as date,
        'Invoice' as type,
        invoice_number as reference,
        total as debit,
        0 as credit,
        notes
      FROM sales
      WHERE customer_id = ? AND is_deleted = 0 AND status != 'Void' AND invoice_date >= ? AND invoice_date <= ?
    `).all(req.params.id, from, to);

    // 3. Fetch payments in date range
    const rangePayments = db.prepare(`
      SELECT 
        payment_date as date,
        'Payment' as type,
        payment_number as reference,
        0 as debit,
        amount as credit,
        notes
      FROM payments_received
      WHERE customer_id = ? AND is_deleted = 0 AND payment_date >= ? AND payment_date <= ?
    `).all(req.params.id, from, to);

    // 4. Combine and calculate running balance
    const transactions = [...rangeSales, ...rangePayments].sort((a, b) => a.date.localeCompare(b.date));

    let runningBalance = openingBalance;
    let totalDebits = 0;
    let totalCredits = 0;

    const statementLines = transactions.map(txn => {
      runningBalance = runningBalance + txn.debit - txn.credit;
      totalDebits += txn.debit;
      totalCredits += txn.credit;
      return {
        ...txn,
        balance: runningBalance
      };
    });

    const business = db.prepare('SELECT * FROM businesses WHERE id = 1').get();

    res.json({
      success: true,
      data: {
        business,
        customer,
        dateRange: { from, to },
        openingBalance,
        totalDebits,
        totalCredits,
        closingBalance: runningBalance,
        transactions: statementLines
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/customers
router.post('/', (req, res) => {
  try {
    const { name, company_name, email, phone, address, tax_number, opening_balance = 0 } = req.body;

    if (!name && !company_name) {
      return res.status(400).json({ success: false, error: 'Customer Name or Company Name is required.' });
    }

    const openBal = Number(opening_balance) || 0;

    const info = db.prepare(`
      INSERT INTO customers (
        business_id, name, company_name, email, phone, address, tax_number, opening_balance, outstanding_balance
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      (name || company_name).trim(),
      company_name ? company_name.trim() : null,
      email ? email.trim() : null,
      phone ? phone.trim() : null,
      address ? address.trim() : null,
      tax_number ? tax_number.trim() : null,
      openBal,
      openBal
    );

    const customerId = info.lastInsertRowid;
    recalculateCustomerBalance(db, customerId);

    logAudit(db, {
      action: 'CREATE',
      entityType: 'CUSTOMER',
      entityId: customerId,
      newValues: { name, company_name, email, phone, openBal }
    });

    const newCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    res.status(201).json({ success: true, data: newCustomer, message: 'Customer created successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/customers/:id
router.put('/:id', (req, res) => {
  try {
    const { name, company_name, email, phone, address, tax_number, opening_balance, is_active } = req.body;

    const old = db.prepare('SELECT * FROM customers WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!old) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    db.prepare(`
      UPDATE customers
      SET name = COALESCE(?, name),
          company_name = ?,
          email = ?,
          phone = ?,
          address = ?,
          tax_number = ?,
          opening_balance = COALESCE(?, opening_balance),
          is_active = COALESCE(?, is_active),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name ? name.trim() : null,
      company_name !== undefined ? (company_name ? company_name.trim() : null) : old.company_name,
      email !== undefined ? (email ? email.trim() : null) : old.email,
      phone !== undefined ? (phone ? phone.trim() : null) : old.phone,
      address !== undefined ? (address ? address.trim() : null) : old.address,
      tax_number !== undefined ? (tax_number ? tax_number.trim() : null) : old.tax_number,
      opening_balance !== undefined ? Number(opening_balance) : null,
      is_active !== undefined ? Number(is_active) : null,
      req.params.id
    );

    recalculateCustomerBalance(db, req.params.id);

    logAudit(db, {
      action: 'UPDATE',
      entityType: 'CUSTOMER',
      entityId: req.params.id,
      oldValues: old,
      newValues: req.body
    });

    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated, message: 'Customer updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/customers/:id (Soft delete)
router.delete('/:id', (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    db.prepare('UPDATE customers SET is_deleted = 1, updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id);

    logAudit(db, {
      action: 'DELETE',
      entityType: 'CUSTOMER',
      entityId: req.params.id,
      oldValues: customer
    });

    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

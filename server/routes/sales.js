const express = require('express');
const router = express.Router();
const { db, getNextDocNumber, logAudit, recalculateCustomerBalance, recalculateProductStock } = require('../db');

// GET /api/sales/summary
router.get('/summary', (req, res) => {
  try {
    const summary = db.prepare(`
      SELECT 
        COUNT(id) as total_invoices,
        COALESCE(SUM(total), 0) as total_sales,
        COALESCE(SUM(paid_amount), 0) as total_paid,
        COALESCE(SUM(balance), 0) as total_outstanding,
        COALESCE(SUM(CASE WHEN payment_status = 'Paid' THEN 1 ELSE 0 END), 0) as paid_count,
        COALESCE(SUM(CASE WHEN payment_status = 'Pending' THEN 1 ELSE 0 END), 0) as pending_count,
        COALESCE(SUM(CASE WHEN payment_status = 'Partially Paid' THEN 1 ELSE 0 END), 0) as partial_count,
        COALESCE(SUM(CASE WHEN payment_status = 'Overdue' THEN 1 ELSE 0 END), 0) as overdue_count
      FROM sales
      WHERE is_deleted = 0 AND status != 'Void'
    `).get();

    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sales
router.get('/', (req, res) => {
  try {
    const { search, customer_id, payment_status, status, from_date, to_date, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT 
        s.id, s.invoice_number, s.invoice_date, s.due_date, s.reference_number,
        s.subtotal, s.discount, s.tax, s.total, s.paid_amount, s.balance,
        s.payment_status, s.status, s.payment_method, s.notes, s.terms, s.created_at,
        c.id as customer_id, c.name as customer_name, c.company_name as customer_company,
        COUNT(si.id) as item_count
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      WHERE s.is_deleted = 0
    `;
    const params = [];

    if (search) {
      query += ` AND (s.invoice_number LIKE ? OR s.reference_number LIKE ? OR c.name LIKE ? OR c.company_name LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (customer_id) {
      query += ` AND s.customer_id = ?`;
      params.push(Number(customer_id));
    }

    if (payment_status && payment_status !== 'All') {
      query += ` AND s.payment_status = ?`;
      params.push(payment_status);
    }

    if (status && status !== 'All') {
      query += ` AND s.status = ?`;
      params.push(status);
    }

    if (from_date) {
      query += ` AND s.invoice_date >= ?`;
      params.push(from_date);
    }

    if (to_date) {
      query += ` AND s.invoice_date <= ?`;
      params.push(to_date);
    }

    query += ` GROUP BY s.id`;

    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const totalCount = db.prepare(countQuery).get(...params).total;

    query += ` ORDER BY s.invoice_date DESC, s.id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const sales = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: sales,
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

// GET /api/sales/:id
router.get('/:id', (req, res) => {
  try {
    const sale = db.prepare(`
      SELECT 
        s.*,
        c.name as customer_name, c.company_name as customer_company, c.email as customer_email,
        c.phone as customer_phone, c.address as customer_address, c.tax_number as customer_tax
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      WHERE s.id = ? AND s.is_deleted = 0
    `).get(req.params.id);

    if (!sale) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const items = db.prepare(`
      SELECT 
        si.*,
        pr.name as product_name, pr.sku as product_sku, pr.unit as product_unit
      FROM sale_items si
      JOIN products pr ON si.product_id = pr.id
      WHERE si.sale_id = ?
    `).all(req.params.id);

    const payments = db.prepare(`
      SELECT * FROM payments_received
      WHERE sale_id = ? AND is_deleted = 0
      ORDER BY payment_date DESC, id DESC
    `).all(req.params.id);

    const business = db.prepare('SELECT * FROM businesses WHERE id = 1').get();

    res.json({
      success: true,
      data: {
        ...sale,
        items,
        payments,
        business
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sales (Atomic Transaction)
router.post('/', (req, res) => {
  try {
    const {
      customer_id, invoice_date, due_date, reference_number,
      items = [], paid_amount = 0, payment_method, notes, terms
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({ success: false, error: 'Customer is required.' });
    }
    if (!invoice_date || !due_date) {
      return res.status(400).json({ success: false, error: 'Invoice date and Due date are required.' });
    }
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one line item is required.' });
    }

    const customer = db.prepare('SELECT id FROM customers WHERE id = ? AND is_deleted = 0').get(customer_id);
    if (!customer) {
      return res.status(400).json({ success: false, error: 'Selected customer does not exist.' });
    }

    const saleTx = db.transaction(() => {
      // 1. Generate sequential Invoice Number
      const invoiceNumber = getNextDocNumber(db, 1, 'INV');

      // 2. Validate items & calculate totals
      let subtotal = 0;
      let totalDiscount = 0;
      let totalTax = 0;

      const validatedItems = items.map((item, idx) => {
        const prod = db.prepare('SELECT id, name, selling_price, current_stock FROM products WHERE id = ? AND is_deleted = 0').get(item.product_id);
        if (!prod) {
          throw new Error(`Product at row ${idx + 1} does not exist.`);
        }
        const qty = Number(item.quantity) || 1;
        const rate = Number(item.rate !== undefined ? item.rate : prod.selling_price);
        const disc = Number(item.discount) || 0;
        const taxRate = Number(item.tax_rate !== undefined ? item.tax_rate : 5);

        const lineSub = qty * rate;
        const lineTaxable = Math.max(0, lineSub - disc);
        const lineTax = (lineTaxable * taxRate) / 100;
        const lineAmount = lineTaxable + lineTax;

        subtotal += lineSub;
        totalDiscount += disc;
        totalTax += lineTax;

        return {
          productId: prod.id,
          description: item.description || prod.name,
          quantity: qty,
          rate,
          discount: disc,
          taxRate,
          amount: lineAmount
        };
      });

      const grandTotal = Math.round((subtotal - totalDiscount + totalTax) * 100) / 100;
      const initialPaid = Math.min(grandTotal, Number(paid_amount) || 0);
      const balance = Math.round((grandTotal - initialPaid) * 100) / 100;

      let paymentStatus = 'Pending';
      if (initialPaid >= grandTotal && grandTotal > 0) {
        paymentStatus = 'Paid';
      } else if (initialPaid > 0) {
        paymentStatus = 'Partially Paid';
      }

      // 3. Insert Sale
      const info = db.prepare(`
        INSERT INTO sales (
          business_id, customer_id, invoice_number, invoice_date, due_date, reference_number,
          subtotal, discount, tax, total, paid_amount, balance, payment_status, status,
          payment_method, notes, terms
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?)
      `).run(
        customer_id,
        invoiceNumber,
        invoice_date,
        due_date,
        reference_number ? reference_number.trim() : null,
        subtotal,
        totalDiscount,
        totalTax,
        grandTotal,
        initialPaid,
        balance,
        paymentStatus,
        payment_method ? payment_method.trim() : null,
        notes ? notes.trim() : 'Thank you for your business.',
        terms ? terms.trim() : 'Payment is due within invoice terms.'
      );

      const saleId = info.lastInsertRowid;

      // 4. Insert line items, decrease stock, log stock movement
      for (const it of validatedItems) {
        db.prepare(`
          INSERT INTO sale_items (sale_id, product_id, description, quantity, rate, discount, tax_rate, amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(saleId, it.productId, it.description, it.quantity, it.rate, it.discount, it.taxRate, it.amount);

        // Decrease stock
        db.prepare('UPDATE products SET current_stock = current_stock - ?, updated_at = datetime(\'now\') WHERE id = ?')
          .run(it.quantity, it.productId);

        // Log movement
        db.prepare(`
          INSERT INTO stock_movements (business_id, product_id, movement_date, movement_type, reference_type, reference_id, quantity, unit_cost, notes)
          VALUES (1, ?, ?, 'SALE', 'SALE', ?, ?, ?, ?)
        `).run(it.productId, invoice_date, invoiceNumber, -it.quantity, it.rate, `Sale Invoice delivery (${invoiceNumber})`);
      }

      // 5. If initial payment received, record payment
      if (initialPaid > 0) {
        const paymentNumber = getNextDocNumber(db, 1, 'PAY');
        db.prepare(`
          INSERT INTO payments_received (business_id, customer_id, sale_id, payment_number, payment_date, amount, payment_method, reference_number, notes)
          VALUES (1, ?, ?, ?, ?, ?, ?, ?, 'Payment recorded at invoice creation')
        `).run(
          customer_id,
          saleId,
          paymentNumber,
          invoice_date,
          initialPaid,
          payment_method || 'Bank Transfer',
          reference_number || `REF-${invoiceNumber}`
        );
      }

      // 6. Update customer balance
      recalculateCustomerBalance(db, customer_id);

      // 7. Audit log
      logAudit(db, {
        action: 'CREATE',
        entityType: 'SALE',
        entityId: saleId,
        newValues: { invoiceNumber, customer_id, total: grandTotal, paid: initialPaid, balance }
      });

      return { saleId, invoiceNumber };
    });

    const result = saleTx();
    const createdSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(result.saleId);

    res.status(201).json({
      success: true,
      data: createdSale,
      message: `Invoice ${result.invoiceNumber} created successfully`
    });
  } catch (err) {
    console.error('Sale creation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sales/:id/void (Void Invoice & Restore Stock)
router.post('/:id/void', (req, res) => {
  try {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!sale) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    if (sale.status === 'Void') {
      return res.status(400).json({ success: false, error: 'Invoice is already voided.' });
    }

    const voidTx = db.transaction(() => {
      // 1. Restore product stock
      const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
      for (const it of items) {
        db.prepare('UPDATE products SET current_stock = current_stock + ?, updated_at = datetime(\'now\') WHERE id = ?')
          .run(it.quantity, it.product_id);

        db.prepare(`
          INSERT INTO stock_movements (business_id, product_id, movement_date, movement_type, reference_type, reference_id, quantity, unit_cost, notes)
          VALUES (1, ?, date('now'), 'ADJUSTMENT_IN', 'SALE_VOID', ?, ?, ?, 'Invoice Voided - Restored Stock')
        `).run(it.product_id, sale.invoice_number, it.quantity, it.rate);
      }

      // 2. Mark void
      db.prepare('UPDATE sales SET status = \'Void\', balance = 0, updated_at = datetime(\'now\') WHERE id = ?').run(sale.id);

      // 3. Recalculate customer balance
      recalculateCustomerBalance(db, sale.customer_id);

      logAudit(db, {
        action: 'VOID',
        entityType: 'SALE',
        entityId: sale.id,
        oldValues: sale
      });
    });

    voidTx();

    res.json({ success: true, message: `Invoice ${sale.invoice_number} voided successfully` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/sales/:id (Soft delete)
router.delete('/:id', (req, res) => {
  try {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!sale) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    db.prepare('UPDATE sales SET is_deleted = 1, updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id);
    recalculateCustomerBalance(db, sale.customer_id);

    logAudit(db, {
      action: 'DELETE',
      entityType: 'SALE',
      entityId: req.params.id,
      oldValues: sale
    });

    res.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

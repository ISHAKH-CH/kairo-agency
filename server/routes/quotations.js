const express = require('express');
const router = express.Router();
const { db, getNextDocNumber, logAudit, recalculateCustomerBalance } = require('../db');

// GET /api/quotations/summary
router.get('/summary', (req, res) => {
  try {
    const summary = db.prepare(`
      SELECT 
        COUNT(id) as total_count,
        COALESCE(SUM(total), 0) as total_amount,
        COALESCE(SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END), 0) as draft_count,
        COALESCE(SUM(CASE WHEN status = 'Sent' THEN 1 ELSE 0 END), 0) as sent_count,
        COALESCE(SUM(CASE WHEN status = 'Accepted' THEN 1 ELSE 0 END), 0) as accepted_count,
        COALESCE(SUM(CASE WHEN status = 'Converted' THEN 1 ELSE 0 END), 0) as converted_count,
        COALESCE(SUM(CASE WHEN status = 'Expired' THEN 1 ELSE 0 END), 0) as expired_count
      FROM quotations
      WHERE is_deleted = 0
    `).get();

    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/quotations
router.get('/', (req, res) => {
  try {
    const { search, customer_id, status, from_date, to_date, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT 
        q.id, q.quotation_number, q.quotation_date, q.valid_until, q.reference_number,
        q.subtotal, q.discount, q.tax, q.total, q.status, q.notes, q.terms,
        q.converted_sale_id, q.created_at,
        c.id as customer_id, c.name as customer_name, c.company_name as customer_company,
        COUNT(qi.id) as item_count
      FROM quotations q
      JOIN customers c ON q.customer_id = c.id
      LEFT JOIN quotation_items qi ON qi.quotation_id = q.id
      WHERE q.is_deleted = 0
    `;
    const params = [];

    if (search) {
      query += ` AND (q.quotation_number LIKE ? OR q.reference_number LIKE ? OR c.name LIKE ? OR c.company_name LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (customer_id) {
      query += ` AND q.customer_id = ?`;
      params.push(Number(customer_id));
    }

    if (status && status !== 'All') {
      query += ` AND q.status = ?`;
      params.push(status);
    }

    if (from_date) {
      query += ` AND q.quotation_date >= ?`;
      params.push(from_date);
    }

    if (to_date) {
      query += ` AND q.quotation_date <= ?`;
      params.push(to_date);
    }

    query += ` GROUP BY q.id`;

    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const totalCount = db.prepare(countQuery).get(...params).total;

    query += ` ORDER BY q.quotation_date DESC, q.id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const quotations = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: quotations,
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

// GET /api/quotations/:id
router.get('/:id', (req, res) => {
  try {
    const quotation = db.prepare(`
      SELECT 
        q.*,
        c.name as customer_name, c.company_name as customer_company, c.email as customer_email,
        c.phone as customer_phone, c.address as customer_address, c.tax_number as customer_tax
      FROM quotations q
      JOIN customers c ON q.customer_id = c.id
      WHERE q.id = ? AND q.is_deleted = 0
    `).get(req.params.id);

    if (!quotation) {
      return res.status(404).json({ success: false, error: 'Quotation not found' });
    }

    const items = db.prepare(`
      SELECT 
        qi.*,
        pr.name as product_name, pr.sku as product_sku, pr.unit as product_unit
      FROM quotation_items qi
      JOIN products pr ON qi.product_id = pr.id
      WHERE qi.quotation_id = ?
    `).all(req.params.id);

    const business = db.prepare('SELECT * FROM businesses WHERE id = 1').get();

    res.json({ success: true, data: { ...quotation, items, business } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/quotations
router.post('/', (req, res) => {
  try {
    const {
      customer_id, quotation_date, valid_until, reference_number,
      items = [], notes, terms, status = 'Draft'
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({ success: false, error: 'Customer is required.' });
    }
    if (!quotation_date || !valid_until) {
      return res.status(400).json({ success: false, error: 'Quotation date and Valid Until date are required.' });
    }
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one line item is required.' });
    }

    const quoteTx = db.transaction(() => {
      const quoteNumber = getNextDocNumber(db, 1, 'QUO');

      let subtotal = 0;
      let totalDiscount = 0;
      let totalTax = 0;

      const validatedItems = items.map((item, idx) => {
        const prod = db.prepare('SELECT id, name, selling_price FROM products WHERE id = ? AND is_deleted = 0').get(item.product_id);
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

      const info = db.prepare(`
        INSERT INTO quotations (
          business_id, customer_id, quotation_number, quotation_date, valid_until, reference_number,
          subtotal, discount, tax, total, status, notes, terms
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        customer_id,
        quoteNumber,
        quotation_date,
        valid_until,
        reference_number ? reference_number.trim() : null,
        subtotal,
        totalDiscount,
        totalTax,
        grandTotal,
        status,
        notes ? notes.trim() : 'Valid for 30 days. Standard UAE warranty included.',
        terms ? terms.trim() : 'Payment 50% advance, 50% on delivery.'
      );

      const quoteId = info.lastInsertRowid;

      for (const it of validatedItems) {
        db.prepare(`
          INSERT INTO quotation_items (quotation_id, product_id, description, quantity, rate, discount, tax_rate, amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(quoteId, it.productId, it.description, it.quantity, it.rate, it.discount, it.taxRate, it.amount);
      }

      logAudit(db, {
        action: 'CREATE',
        entityType: 'QUOTATION',
        entityId: quoteId,
        newValues: { quoteNumber, customer_id, total: grandTotal, status }
      });

      return { quoteId, quoteNumber };
    });

    const result = quoteTx();
    const createdQuote = db.prepare('SELECT * FROM quotations WHERE id = ?').get(result.quoteId);

    res.status(201).json({
      success: true,
      data: createdQuote,
      message: `Quotation ${result.quoteNumber} created successfully`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/quotations/:id/convert (Convert Quotation to Sale / Invoice)
router.post('/:id/convert', (req, res) => {
  try {
    const quote = db.prepare('SELECT * FROM quotations WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!quote) {
      return res.status(404).json({ success: false, error: 'Quotation not found' });
    }

    if (quote.status === 'Converted' && quote.converted_sale_id) {
      return res.status(400).json({ success: false, error: 'This quotation has already been converted to a sale.' });
    }

    const quoteItems = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ?').all(quote.id);
    if (!quoteItems || quoteItems.length === 0) {
      return res.status(400).json({ success: false, error: 'Quotation has no line items.' });
    }

    const convertTx = db.transaction(() => {
      // 1. Generate Invoice Number
      const invoiceNumber = getNextDocNumber(db, 1, 'INV');
      const today = new Date().toISOString().split('T')[0];
      
      // Due date 15 days from today
      const due = new Date();
      due.setDate(due.getDate() + 15);
      const dueDate = due.toISOString().split('T')[0];

      // 2. Create Sale
      const saleInfo = db.prepare(`
        INSERT INTO sales (
          business_id, customer_id, quotation_id, invoice_number, invoice_date, due_date,
          reference_number, subtotal, discount, tax, total, paid_amount, balance,
          payment_status, status, notes, terms
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'Pending', 'Active', ?, ?)
      `).run(
        quote.customer_id,
        quote.id,
        invoiceNumber,
        today,
        dueDate,
        quote.quotation_number,
        quote.subtotal,
        quote.discount,
        quote.tax,
        quote.total,
        quote.total,
        quote.notes,
        quote.terms
      );

      const saleId = saleInfo.lastInsertRowid;

      // 3. Create Sale items & decrease stock & log movement
      for (const it of quoteItems) {
        db.prepare(`
          INSERT INTO sale_items (sale_id, product_id, description, quantity, rate, discount, tax_rate, amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(saleId, it.product_id, it.description, it.quantity, it.rate, it.discount, it.tax_rate, it.amount);

        // Decrease stock
        db.prepare('UPDATE products SET current_stock = current_stock - ?, updated_at = datetime(\'now\') WHERE id = ?')
          .run(it.quantity, it.product_id);

        // Stock movement
        db.prepare(`
          INSERT INTO stock_movements (business_id, product_id, movement_date, movement_type, reference_type, reference_id, quantity, unit_cost, notes)
          VALUES (1, ?, ?, 'SALE', 'SALE', ?, ?, ?, ?)
        `).run(it.product_id, today, invoiceNumber, -it.quantity, it.rate, `Converted from Quotation ${quote.quotation_number}`);
      }

      // 4. Update customer balance
      recalculateCustomerBalance(db, quote.customer_id);

      // 5. Update quote status to Converted
      db.prepare(`
        UPDATE quotations
        SET status = 'Converted',
            converted_sale_id = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(saleId, quote.id);

      // 6. Audit log
      logAudit(db, {
        action: 'CONVERT_TO_SALE',
        entityType: 'QUOTATION',
        entityId: quote.id,
        newValues: { invoiceNumber, saleId }
      });

      return { saleId, invoiceNumber };
    });

    const result = convertTx();

    res.json({
      success: true,
      data: { saleId: result.saleId, invoiceNumber: result.invoiceNumber },
      message: `Quotation converted successfully into Invoice ${result.invoiceNumber}`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/quotations/:id/status
router.post('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const quote = db.prepare('SELECT * FROM quotations WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!quote) {
      return res.status(404).json({ success: false, error: 'Quotation not found' });
    }

    db.prepare('UPDATE quotations SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, req.params.id);

    logAudit(db, {
      action: 'STATUS_CHANGE',
      entityType: 'QUOTATION',
      entityId: req.params.id,
      oldValues: { status: quote.status },
      newValues: { status }
    });

    res.json({ success: true, message: `Quotation status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/quotations/:id
router.delete('/:id', (req, res) => {
  try {
    const quote = db.prepare('SELECT * FROM quotations WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!quote) {
      return res.status(404).json({ success: false, error: 'Quotation not found' });
    }

    db.prepare('UPDATE quotations SET is_deleted = 1, updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id);

    logAudit(db, {
      action: 'DELETE',
      entityType: 'QUOTATION',
      entityId: req.params.id,
      oldValues: quote
    });

    res.json({ success: true, message: 'Quotation deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { db, getNextDocNumber, logAudit, recalculateSupplierBalance, recalculateProductStock } = require('../db');

// GET /api/purchases/summary
router.get('/summary', (req, res) => {
  try {
    const summary = db.prepare(`
      SELECT 
        COUNT(id) as total_count,
        COALESCE(SUM(total), 0) as total_purchases,
        COALESCE(SUM(paid_amount), 0) as total_paid,
        COALESCE(SUM(balance), 0) as total_outstanding,
        COALESCE(SUM(CASE WHEN status = 'Received' THEN 1 ELSE 0 END), 0) as received_count,
        COALESCE(SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END), 0) as draft_count,
        COALESCE(SUM(CASE WHEN payment_status = 'Pending' THEN 1 ELSE 0 END), 0) as pending_payment_count
      FROM purchases
      WHERE is_deleted = 0 AND status != 'Cancelled'
    `).get();

    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/purchases
router.get('/', (req, res) => {
  try {
    const { search, supplier_id, status, payment_status, from_date, to_date, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT 
        p.id, p.purchase_number, p.purchase_date, p.reference_number, p.payment_terms,
        p.subtotal, p.discount, p.tax, p.total, p.paid_amount, p.balance,
        p.payment_status, p.status, p.notes, p.created_at,
        s.id as supplier_id, s.name as supplier_name, s.company_name as supplier_company,
        COUNT(pi.id) as item_count
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
      WHERE p.is_deleted = 0
    `;
    const params = [];

    if (search) {
      query += ` AND (p.purchase_number LIKE ? OR p.reference_number LIKE ? OR s.name LIKE ? OR s.company_name LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (supplier_id) {
      query += ` AND p.supplier_id = ?`;
      params.push(Number(supplier_id));
    }

    if (status && status !== 'All') {
      query += ` AND p.status = ?`;
      params.push(status);
    }

    if (payment_status && payment_status !== 'All') {
      query += ` AND p.payment_status = ?`;
      params.push(payment_status);
    }

    if (from_date) {
      query += ` AND p.purchase_date >= ?`;
      params.push(from_date);
    }

    if (to_date) {
      query += ` AND p.purchase_date <= ?`;
      params.push(to_date);
    }

    query += ` GROUP BY p.id`;

    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const totalCount = db.prepare(countQuery).get(...params).total;

    query += ` ORDER BY p.purchase_date DESC, p.id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const purchases = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: purchases,
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

// GET /api/purchases/:id
router.get('/:id', (req, res) => {
  try {
    const purchase = db.prepare(`
      SELECT 
        p.*,
        s.name as supplier_name, s.company_name as supplier_company, s.email as supplier_email,
        s.phone as supplier_phone, s.address as supplier_address, s.tax_number as supplier_tax
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ? AND p.is_deleted = 0
    `).get(req.params.id);

    if (!purchase) {
      return res.status(404).json({ success: false, error: 'Purchase record not found' });
    }

    const items = db.prepare(`
      SELECT 
        pi.*,
        pr.name as product_name, pr.sku as product_sku, pr.unit as product_unit
      FROM purchase_items pi
      JOIN products pr ON pi.product_id = pr.id
      WHERE pi.purchase_id = ?
    `).all(req.params.id);

    const business = db.prepare('SELECT * FROM businesses WHERE id = 1').get();

    res.json({ success: true, data: { ...purchase, items, business } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/purchases (Atomic Transaction)
router.post('/', (req, res) => {
  try {
    const {
      supplier_id, purchase_date, reference_number, payment_terms = 'Due on Receipt',
      items = [], paid_amount = 0, payment_method, notes
    } = req.body;

    if (!supplier_id) {
      return res.status(400).json({ success: false, error: 'Supplier is required.' });
    }

    if (!purchase_date) {
      return res.status(400).json({ success: false, error: 'Purchase date is required.' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one line item is required.' });
    }

    // Verify supplier exists
    const supplier = db.prepare('SELECT id FROM suppliers WHERE id = ? AND is_deleted = 0').get(supplier_id);
    if (!supplier) {
      return res.status(400).json({ success: false, error: 'Selected supplier does not exist.' });
    }

    const purchaseTx = db.transaction(() => {
      // 1. Generate sequence number
      const purchaseNumber = getNextDocNumber(db, 1, 'PUR');

      // 2. Calculate totals
      let subtotal = 0;
      let totalDiscount = 0;
      let totalTax = 0;

      const validatedItems = items.map((item, idx) => {
        const prod = db.prepare('SELECT id, name, purchase_price FROM products WHERE id = ? AND is_deleted = 0').get(item.product_id);
        if (!prod) {
          throw new Error(`Product at row ${idx + 1} does not exist.`);
        }
        const qty = Number(item.quantity) || 1;
        const rate = Number(item.rate !== undefined ? item.rate : prod.purchase_price);
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

      // 3. Insert Purchase
      const info = db.prepare(`
        INSERT INTO purchases (
          business_id, supplier_id, purchase_number, purchase_date, reference_number, payment_terms,
          subtotal, discount, tax, total, paid_amount, balance, payment_status, status, notes
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Received', ?)
      `).run(
        supplier_id,
        purchaseNumber,
        purchase_date,
        reference_number ? reference_number.trim() : null,
        payment_terms,
        subtotal,
        totalDiscount,
        totalTax,
        grandTotal,
        initialPaid,
        balance,
        paymentStatus,
        notes ? notes.trim() : null
      );

      const purchaseId = info.lastInsertRowid;

      // 4. Insert line items, increase stock, and log stock movement
      for (const it of validatedItems) {
        db.prepare(`
          INSERT INTO purchase_items (purchase_id, product_id, description, quantity, rate, discount, tax_rate, amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(purchaseId, it.productId, it.description, it.quantity, it.rate, it.discount, it.taxRate, it.amount);

        // Increase product stock
        db.prepare('UPDATE products SET current_stock = current_stock + ?, updated_at = datetime(\'now\') WHERE id = ?')
          .run(it.quantity, it.productId);

        // Log stock movement
        db.prepare(`
          INSERT INTO stock_movements (business_id, product_id, movement_date, movement_type, reference_type, reference_id, quantity, unit_cost, notes)
          VALUES (1, ?, ?, 'PURCHASE', 'PURCHASE', ?, ?, ?, ?)
        `).run(it.productId, purchase_date, purchaseNumber, it.quantity, it.rate, `Purchase from supplier (${purchaseNumber})`);
      }

      // 5. Update supplier balance
      recalculateSupplierBalance(db, supplier_id);

      // 6. Audit log
      logAudit(db, {
        action: 'CREATE',
        entityType: 'PURCHASE',
        entityId: purchaseId,
        newValues: { purchaseNumber, supplier_id, total: grandTotal, paid: initialPaid, balance }
      });

      return { purchaseId, purchaseNumber };
    });

    const result = purchaseTx();
    const createdPurchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(result.purchaseId);

    res.status(201).json({
      success: true,
      data: createdPurchase,
      message: `Purchase ${result.purchaseNumber} recorded successfully`
    });
  } catch (err) {
    console.error('Purchase creation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/purchases/:id/cancel
router.post('/:id/cancel', (req, res) => {
  try {
    const purchase = db.prepare('SELECT * FROM purchases WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!purchase) {
      return res.status(404).json({ success: false, error: 'Purchase not found' });
    }

    if (purchase.status === 'Cancelled') {
      return res.status(400).json({ success: false, error: 'Purchase is already cancelled.' });
    }

    const cancelTx = db.transaction(() => {
      // 1. Fetch items to reverse stock
      const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(purchase.id);

      for (const it of items) {
        db.prepare('UPDATE products SET current_stock = current_stock - ?, updated_at = datetime(\'now\') WHERE id = ?')
          .run(it.quantity, it.product_id);

        db.prepare(`
          INSERT INTO stock_movements (business_id, product_id, movement_date, movement_type, reference_type, reference_id, quantity, unit_cost, notes)
          VALUES (1, ?, date('now'), 'ADJUSTMENT_OUT', 'PURCHASE_CANCEL', ?, ?, ?, 'Purchase Order Cancelled')
        `).run(it.product_id, purchase.purchase_number, -it.quantity, it.rate);
      }

      // 2. Mark cancelled
      db.prepare('UPDATE purchases SET status = \'Cancelled\', updated_at = datetime(\'now\') WHERE id = ?').run(purchase.id);

      // 3. Recalculate supplier balance
      recalculateSupplierBalance(db, purchase.supplier_id);

      logAudit(db, {
        action: 'CANCEL',
        entityType: 'PURCHASE',
        entityId: purchase.id,
        oldValues: purchase
      });
    });

    cancelTx();

    res.json({ success: true, message: `Purchase ${purchase.purchase_number} cancelled successfully` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/purchases/:id (Soft delete)
router.delete('/:id', (req, res) => {
  try {
    const purchase = db.prepare('SELECT * FROM purchases WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!purchase) {
      return res.status(404).json({ success: false, error: 'Purchase not found' });
    }

    db.prepare('UPDATE purchases SET is_deleted = 1, updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id);
    recalculateSupplierBalance(db, purchase.supplier_id);

    logAudit(db, {
      action: 'DELETE',
      entityType: 'PURCHASE',
      entityId: req.params.id,
      oldValues: purchase
    });

    res.json({ success: true, message: 'Purchase deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

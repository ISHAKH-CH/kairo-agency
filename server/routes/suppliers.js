const express = require('express');
const router = express.Router();
const { db, logAudit, recalculateSupplierBalance } = require('../db');

// GET /api/suppliers
router.get('/', (req, res) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT 
        s.id, s.name, s.company_name, s.email, s.phone, s.address, s.tax_number,
        s.opening_balance, s.outstanding_balance, s.is_active, s.created_at, s.updated_at,
        COALESCE(purch_agg.total_purchases, 0) as total_purchases,
        COALESCE(purch_agg.total_paid, 0) as total_paid
      FROM suppliers s
      LEFT JOIN (
        SELECT 
          supplier_id,
          SUM(total) as total_purchases,
          SUM(paid_amount) as total_paid
        FROM purchases
        WHERE is_deleted = 0 AND status != 'Cancelled'
        GROUP BY supplier_id
      ) purch_agg ON purch_agg.supplier_id = s.id
      WHERE s.is_deleted = 0
    `;
    const params = [];

    if (search) {
      query += ` AND (s.name LIKE ? OR s.company_name LIKE ? OR s.email LIKE ? OR s.phone LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const totalCount = db.prepare(countQuery).get(...params).total;

    query += ` ORDER BY s.name ASC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const suppliers = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: suppliers,
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

// GET /api/suppliers/:id
router.get('/:id', (req, res) => {
  try {
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    const purchases = db.prepare(`
      SELECT id, purchase_number, purchase_date, total, paid_amount, balance, payment_status, status
      FROM purchases
      WHERE supplier_id = ? AND is_deleted = 0
      ORDER BY purchase_date DESC, id DESC
    `).all(req.params.id);

    const metrics = db.prepare(`
      SELECT 
        COALESCE(SUM(total), 0) as total_purchases,
        COALESCE(SUM(paid_amount), 0) as total_paid,
        COALESCE(SUM(balance), 0) as outstanding,
        COUNT(id) as purchase_count
      FROM purchases
      WHERE supplier_id = ? AND is_deleted = 0 AND status != 'Cancelled'
    `).get(req.params.id);

    res.json({
      success: true,
      data: {
        ...supplier,
        metrics,
        purchases
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/suppliers
router.post('/', (req, res) => {
  try {
    const { name, company_name, email, phone, address, tax_number, opening_balance = 0 } = req.body;

    if (!name && !company_name) {
      return res.status(400).json({ success: false, error: 'Supplier Name or Company Name is required.' });
    }

    const openBal = Number(opening_balance) || 0;

    const info = db.prepare(`
      INSERT INTO suppliers (
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

    const supplierId = info.lastInsertRowid;
    recalculateSupplierBalance(db, supplierId);

    logAudit(db, {
      action: 'CREATE',
      entityType: 'SUPPLIER',
      entityId: supplierId,
      newValues: { name, company_name, email, phone }
    });

    const newSupplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
    res.status(201).json({ success: true, data: newSupplier, message: 'Supplier created successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/suppliers/:id
router.put('/:id', (req, res) => {
  try {
    const { name, company_name, email, phone, address, tax_number, opening_balance, is_active } = req.body;

    const old = db.prepare('SELECT * FROM suppliers WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!old) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    db.prepare(`
      UPDATE suppliers
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

    recalculateSupplierBalance(db, req.params.id);

    logAudit(db, {
      action: 'UPDATE',
      entityType: 'SUPPLIER',
      entityId: req.params.id,
      oldValues: old,
      newValues: req.body
    });

    const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated, message: 'Supplier updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/suppliers/:id (Soft delete)
router.delete('/:id', (req, res) => {
  try {
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    db.prepare('UPDATE suppliers SET is_deleted = 1, updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id);

    logAudit(db, {
      action: 'DELETE',
      entityType: 'SUPPLIER',
      entityId: req.params.id,
      oldValues: supplier
    });

    res.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

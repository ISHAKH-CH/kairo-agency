const express = require('express');
const router = express.Router();
const { db, logAudit } = require('../db');
const { seedData } = require('../seed');

// GET /api/settings/business
router.get('/business', (req, res) => {
  try {
    const business = db.prepare('SELECT * FROM businesses WHERE id = 1').get();
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = 1').get();
    res.json({ success: true, business, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/settings/business
router.put('/business', (req, res) => {
  try {
    const { name, email, phone, address, tax_number, currency, timezone, date_format } = req.body;
    const old = db.prepare('SELECT * FROM businesses WHERE id = 1').get();

    db.prepare(`
      UPDATE businesses
      SET name = COALESCE(?, name),
          email = COALESCE(?, email),
          phone = COALESCE(?, phone),
          address = COALESCE(?, address),
          tax_number = COALESCE(?, tax_number),
          currency = COALESCE(?, currency),
          currency_symbol = COALESCE(?, currency_symbol),
          timezone = COALESCE(?, timezone),
          date_format = COALESCE(?, date_format),
          updated_at = datetime('now')
      WHERE id = 1
    `).run(
      name ? name.trim() : null,
      email ? email.trim() : null,
      phone ? phone.trim() : null,
      address ? address.trim() : null,
      tax_number ? tax_number.trim() : null,
      currency ? currency.trim() : null,
      currency ? currency.trim() : null,
      timezone ? timezone.trim() : null,
      date_format ? date_format.trim() : null
    );

    logAudit(db, {
      action: 'UPDATE_SETTINGS',
      entityType: 'BUSINESS',
      entityId: 1,
      oldValues: old,
      newValues: req.body
    });

    const updated = db.prepare('SELECT * FROM businesses WHERE id = 1').get();
    res.json({ success: true, business: updated, message: 'Business profile updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/settings/audit-logs
router.get('/audit-logs', (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const count = db.prepare('SELECT COUNT(*) as total FROM audit_logs').get().total;
    const logs = db.prepare(`
      SELECT a.*, u.name as user_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ? OFFSET ?
    `).all(Number(limit), Number(offset));

    res.json({
      success: true,
      data: logs,
      pagination: {
        total: count,
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/settings/reset-database
router.post('/reset-database', (req, res) => {
  try {
    seedData();
    res.json({ success: true, message: 'Database reset to initial demo seed data successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/settings/export-backup
router.get('/export-backup', (req, res) => {
  try {
    const backup = {
      exported_at: new Date().toISOString(),
      business: db.prepare('SELECT * FROM businesses WHERE id = 1').get(),
      users: db.prepare('SELECT id, name, email, role, created_at FROM users').all(),
      customers: db.prepare('SELECT * FROM customers WHERE is_deleted = 0').all(),
      suppliers: db.prepare('SELECT * FROM suppliers WHERE is_deleted = 0').all(),
      products: db.prepare('SELECT * FROM products WHERE is_deleted = 0').all(),
      purchases: db.prepare('SELECT * FROM purchases WHERE is_deleted = 0').all(),
      purchase_items: db.prepare('SELECT * FROM purchase_items').all(),
      quotations: db.prepare('SELECT * FROM quotations WHERE is_deleted = 0').all(),
      quotation_items: db.prepare('SELECT * FROM quotation_items').all(),
      sales: db.prepare('SELECT * FROM sales WHERE is_deleted = 0').all(),
      sale_items: db.prepare('SELECT * FROM sale_items').all(),
      payments: db.prepare('SELECT * FROM payments_received WHERE is_deleted = 0').all(),
      expenditures: db.prepare('SELECT * FROM expenditures WHERE is_deleted = 0').all(),
      stock_movements: db.prepare('SELECT * FROM stock_movements').all(),
      audit_logs: db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200').all()
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=ledgerly_backup_${new Date().toISOString().split('T')[0]}.json`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

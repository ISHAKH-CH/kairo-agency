const express = require('express');
const router = express.Router();
const { db, getNextDocNumber, logAudit } = require('../db');

const EXPENSE_CATEGORIES = [
  'Rent',
  'Utilities',
  'Salaries',
  'Transportation',
  'Office Supplies',
  'Marketing',
  'Software',
  'Maintenance',
  'Travel',
  'Other'
];

// GET /api/expenditures/summary
router.get('/summary', (req, res) => {
  try {
    const summary = db.prepare(`
      SELECT 
        COUNT(id) as total_expenses_count,
        COALESCE(SUM(amount), 0) as total_expenses,
        COALESCE(SUM(CASE WHEN strftime('%Y-%m', expense_date) = strftime('%Y-%m', 'now') THEN amount ELSE 0 END), 0) as this_month_expenses,
        COALESCE(MAX(amount), 0) as largest_expense,
        COALESCE(SUM(CASE WHEN status = 'Pending' THEN amount ELSE 0 END), 0) as pending_expenses
      FROM expenditures
      WHERE is_deleted = 0
    `).get();

    // Category breakdown
    const categoryBreakdown = db.prepare(`
      SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(id) as count
      FROM expenditures
      WHERE is_deleted = 0
      GROUP BY category
      ORDER BY total DESC
    `).all();

    res.json({
      success: true,
      data: {
        ...summary,
        categoryBreakdown,
        categories: EXPENSE_CATEGORIES
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/expenditures
router.get('/', (req, res) => {
  try {
    const { search, category, from_date, to_date, payment_method, status, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT 
        id, expense_number, expense_date, category, description, vendor,
        amount, tax, payment_method, reference_number, notes, receipt_url, status,
        created_at, updated_at
      FROM expenditures
      WHERE is_deleted = 0
    `;
    const params = [];

    if (search) {
      query += ` AND (expense_number LIKE ? OR description LIKE ? OR vendor LIKE ? OR reference_number LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (category && category !== 'All') {
      query += ` AND category = ?`;
      params.push(category);
    }

    if (payment_method && payment_method !== 'All') {
      query += ` AND payment_method = ?`;
      params.push(payment_method);
    }

    if (status && status !== 'All') {
      query += ` AND status = ?`;
      params.push(status);
    }

    if (from_date) {
      query += ` AND expense_date >= ?`;
      params.push(from_date);
    }

    if (to_date) {
      query += ` AND expense_date <= ?`;
      params.push(to_date);
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const totalCount = db.prepare(countQuery).get(...params).total;

    query += ` ORDER BY expense_date DESC, id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const expenses = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: expenses,
      pagination: {
        total: totalCount,
        limit: Number(limit),
        offset: Number(offset)
      },
      categories: EXPENSE_CATEGORIES
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/expenditures/:id
router.get('/:id', (req, res) => {
  try {
    const expense = db.prepare('SELECT * FROM expenditures WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!expense) {
      return res.status(404).json({ success: false, error: 'Expenditure record not found' });
    }

    const business = db.prepare('SELECT * FROM businesses WHERE id = 1').get();

    res.json({ success: true, data: { ...expense, business } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/expenditures
router.post('/', (req, res) => {
  try {
    const {
      expense_date, category, description, vendor, amount,
      tax = 0, payment_method = 'Bank Transfer', reference_number, notes, receipt_url, status = 'Paid'
    } = req.body;

    if (!expense_date) {
      return res.status(400).json({ success: false, error: 'Expense Date is required.' });
    }
    if (!category) {
      return res.status(400).json({ success: false, error: 'Category is required.' });
    }
    if (!description) {
      return res.status(400).json({ success: false, error: 'Description is required.' });
    }
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Amount must be greater than 0.' });
    }

    const expenseNumber = getNextDocNumber(db, 1, 'EXP');

    const info = db.prepare(`
      INSERT INTO expenditures (
        business_id, expense_number, expense_date, category, description, vendor,
        amount, tax, payment_method, reference_number, notes, receipt_url, status
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      expenseNumber,
      expense_date,
      category,
      description.trim(),
      vendor ? vendor.trim() : null,
      Number(amount),
      Number(tax) || 0,
      payment_method,
      reference_number ? reference_number.trim() : null,
      notes ? notes.trim() : null,
      receipt_url || null,
      status
    );

    const expenseId = info.lastInsertRowid;

    logAudit(db, {
      action: 'CREATE',
      entityType: 'EXPENDITURE',
      entityId: expenseId,
      newValues: { expenseNumber, category, description, amount, vendor }
    });

    const newExpense = db.prepare('SELECT * FROM expenditures WHERE id = ?').get(expenseId);
    res.status(201).json({
      success: true,
      data: newExpense,
      message: `Expense ${expenseNumber} recorded successfully`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/expenditures/:id
router.put('/:id', (req, res) => {
  try {
    const {
      expense_date, category, description, vendor, amount,
      tax, payment_method, reference_number, notes, receipt_url, status
    } = req.body;

    const old = db.prepare('SELECT * FROM expenditures WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!old) {
      return res.status(404).json({ success: false, error: 'Expense record not found' });
    }

    db.prepare(`
      UPDATE expenditures
      SET expense_date = COALESCE(?, expense_date),
          category = COALESCE(?, category),
          description = COALESCE(?, description),
          vendor = ?,
          amount = COALESCE(?, amount),
          tax = COALESCE(?, tax),
          payment_method = COALESCE(?, payment_method),
          reference_number = ?,
          notes = ?,
          receipt_url = ?,
          status = COALESCE(?, status),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      expense_date || null,
      category || null,
      description ? description.trim() : null,
      vendor !== undefined ? (vendor ? vendor.trim() : null) : old.vendor,
      amount !== undefined ? Number(amount) : null,
      tax !== undefined ? Number(tax) : null,
      payment_method || null,
      reference_number !== undefined ? (reference_number ? reference_number.trim() : null) : old.reference_number,
      notes !== undefined ? (notes ? notes.trim() : null) : old.notes,
      receipt_url !== undefined ? receipt_url : old.receipt_url,
      status || null,
      req.params.id
    );

    logAudit(db, {
      action: 'UPDATE',
      entityType: 'EXPENDITURE',
      entityId: req.params.id,
      oldValues: old,
      newValues: req.body
    });

    const updated = db.prepare('SELECT * FROM expenditures WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated, message: 'Expense updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/expenditures/:id
router.delete('/:id', (req, res) => {
  try {
    const expense = db.prepare('SELECT * FROM expenditures WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!expense) {
      return res.status(404).json({ success: false, error: 'Expense record not found' });
    }

    db.prepare('UPDATE expenditures SET is_deleted = 1, updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id);

    logAudit(db, {
      action: 'DELETE',
      entityType: 'EXPENDITURE',
      entityId: req.params.id,
      oldValues: expense
    });

    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

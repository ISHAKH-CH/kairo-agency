const express = require('express');
const router = express.Router();
const { db } = require('../db');

// GET /api/search?q=query
router.get('/', (req, res) => {
  try {
    const q = req.query.q ? req.query.q.trim() : '';
    if (!q || q.length < 1) {
      return res.json({ success: true, results: [] });
    }

    const term = `%${q}%`;
    const results = [];

    // 1. Customers
    const customers = db.prepare(`
      SELECT id, name, company_name, email, phone, outstanding_balance
      FROM customers
      WHERE is_deleted = 0 AND (name LIKE ? OR company_name LIKE ? OR email LIKE ? OR phone LIKE ?)
      LIMIT 5
    `).all(term, term, term, term);

    for (const c of customers) {
      results.push({
        type: 'Customer',
        icon: 'users',
        title: c.name,
        subtitle: c.company_name ? `${c.company_name} • Bal: AED ${c.outstanding_balance.toLocaleString()}` : `Bal: AED ${c.outstanding_balance.toLocaleString()}`,
        url: `#/customers/${c.id}`
      });
    }

    // 2. Products
    const products = db.prepare(`
      SELECT id, name, sku, category, selling_price, current_stock
      FROM products
      WHERE is_deleted = 0 AND (name LIKE ? OR sku LIKE ? OR category LIKE ?)
      LIMIT 5
    `).all(term, term, term);

    for (const p of products) {
      results.push({
        type: 'Product',
        icon: 'package',
        title: p.name,
        subtitle: `SKU: ${p.sku} • AED ${p.selling_price} • ${p.current_stock} in stock`,
        url: `#/stock`
      });
    }

    // 3. Sales / Invoices
    const sales = db.prepare(`
      SELECT s.id, s.invoice_number, s.invoice_date, s.total, s.payment_status, c.name as customer_name
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      WHERE s.is_deleted = 0 AND (s.invoice_number LIKE ? OR s.reference_number LIKE ? OR c.name LIKE ?)
      LIMIT 5
    `).all(term, term, term);

    for (const s of sales) {
      results.push({
        type: 'Sale',
        icon: 'file-text',
        title: s.invoice_number,
        subtitle: `${s.customer_name} • AED ${s.total.toLocaleString()} • ${s.payment_status}`,
        url: `#/sales`
      });
    }

    // 4. Purchases
    const purchases = db.prepare(`
      SELECT p.id, p.purchase_number, p.purchase_date, p.total, p.status, sup.name as supplier_name
      FROM purchases p
      JOIN suppliers sup ON p.supplier_id = sup.id
      WHERE p.is_deleted = 0 AND (p.purchase_number LIKE ? OR p.reference_number LIKE ? OR sup.name LIKE ?)
      LIMIT 5
    `).all(term, term, term);

    for (const p of purchases) {
      results.push({
        type: 'Purchase',
        icon: 'shopping-cart',
        title: p.purchase_number,
        subtitle: `${p.supplier_name} • AED ${p.total.toLocaleString()} • ${p.status}`,
        url: `#/purchases`
      });
    }

    // 5. Quotations
    const quotes = db.prepare(`
      SELECT q.id, q.quotation_number, q.quotation_date, q.total, q.status, c.name as customer_name
      FROM quotations q
      JOIN customers c ON q.customer_id = c.id
      WHERE q.is_deleted = 0 AND (q.quotation_number LIKE ? OR q.reference_number LIKE ? OR c.name LIKE ?)
      LIMIT 5
    `).all(term, term, term);

    for (const qItem of quotes) {
      results.push({
        type: 'Quotation',
        icon: 'file-text',
        title: qItem.quotation_number,
        subtitle: `${qItem.customer_name} • AED ${qItem.total.toLocaleString()} • ${qItem.status}`,
        url: `#/quotations`
      });
    }

    // 6. Payments
    const payments = db.prepare(`
      SELECT pr.id, pr.payment_number, pr.amount, pr.payment_date, pr.payment_method, c.name as customer_name
      FROM payments_received pr
      JOIN customers c ON pr.customer_id = c.id
      WHERE pr.is_deleted = 0 AND (pr.payment_number LIKE ? OR pr.reference_number LIKE ? OR c.name LIKE ?)
      LIMIT 5
    `).all(term, term, term);

    for (const p of payments) {
      results.push({
        type: 'Payment',
        icon: 'credit-card',
        title: p.payment_number,
        subtitle: `${p.customer_name} • AED ${p.amount.toLocaleString()} via ${p.payment_method}`,
        url: `#/payments`
      });
    }

    // 7. Expenditures
    const expenses = db.prepare(`
      SELECT id, expense_number, category, description, vendor, amount, expense_date
      FROM expenditures
      WHERE is_deleted = 0 AND (expense_number LIKE ? OR description LIKE ? OR vendor LIKE ? OR category LIKE ?)
      LIMIT 5
    `).all(term, term, term, term);

    for (const e of expenses) {
      results.push({
        type: 'Expense',
        icon: 'dollar-sign',
        title: `${e.expense_number} - ${e.category}`,
        subtitle: `${e.description} • AED ${e.amount.toLocaleString()} (${e.vendor || 'General'})`,
        url: `#/expenditure`
      });
    }

    res.json({ success: true, count: results.length, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

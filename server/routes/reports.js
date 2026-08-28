const express = require('express');
const router = express.Router();
const { db } = require('../db');

// Helper for date bounds
function getDates(req) {
  const from = req.query.from || '2026-01-01';
  const to = req.query.to || '2026-12-31';
  return { from, to };
}

// 1. Sales Summary
router.get('/sales-summary', (req, res) => {
  try {
    const { from, to } = getDates(req);

    const summary = db.prepare(`
      SELECT 
        COUNT(id) as total_invoices,
        COALESCE(SUM(subtotal), 0) as gross_sales,
        COALESCE(SUM(discount), 0) as total_discount,
        COALESCE(SUM(tax), 0) as total_tax,
        COALESCE(SUM(total), 0) as net_sales,
        COALESCE(SUM(paid_amount), 0) as total_paid,
        COALESCE(SUM(balance), 0) as total_balance
      FROM sales
      WHERE is_deleted = 0 AND status != 'Void'
        AND invoice_date >= ? AND invoice_date <= ?
    `).get(from, to);

    const rows = db.prepare(`
      SELECT 
        s.invoice_date,
        s.invoice_number,
        c.name as customer_name,
        c.company_name as customer_company,
        s.subtotal,
        s.discount,
        s.tax,
        s.total,
        s.paid_amount,
        s.balance,
        s.payment_status
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      WHERE s.is_deleted = 0 AND s.status != 'Void'
        AND s.invoice_date >= ? AND s.invoice_date <= ?
      ORDER BY s.invoice_date DESC, s.id DESC
    `).all(from, to);

    res.json({ success: true, dateRange: { from, to }, summary, rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Sales by Customer
router.get('/sales-by-customer', (req, res) => {
  try {
    const { from, to } = getDates(req);

    const rows = db.prepare(`
      SELECT 
        c.id as customer_id,
        c.name as customer_name,
        c.company_name,
        COUNT(s.id) as invoice_count,
        COALESCE(SUM(s.subtotal), 0) as subtotal,
        COALESCE(SUM(s.tax), 0) as total_tax,
        COALESCE(SUM(s.total), 0) as total_sales,
        COALESCE(SUM(s.paid_amount), 0) as total_paid,
        COALESCE(SUM(s.balance), 0) as balance
      FROM customers c
      JOIN sales s ON s.customer_id = c.id AND s.is_deleted = 0 AND s.status != 'Void'
      WHERE s.invoice_date >= ? AND s.invoice_date <= ?
      GROUP BY c.id
      ORDER BY total_sales DESC
    `).all(from, to);

    const totals = rows.reduce((acc, r) => ({
      total_sales: acc.total_sales + r.total_sales,
      total_paid: acc.total_paid + r.total_paid,
      balance: acc.balance + r.balance,
      invoice_count: acc.invoice_count + r.invoice_count
    }), { total_sales: 0, total_paid: 0, balance: 0, invoice_count: 0 });

    res.json({ success: true, dateRange: { from, to }, totals, rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Sales by Product
router.get('/sales-by-product', (req, res) => {
  try {
    const { from, to } = getDates(req);

    const rows = db.prepare(`
      SELECT 
        p.id as product_id,
        p.sku,
        p.name as product_name,
        p.category,
        p.unit,
        COALESCE(SUM(si.quantity), 0) as quantity_sold,
        COALESCE(AVG(si.rate), 0) as average_selling_rate,
        COALESCE(SUM(si.amount), 0) as total_revenue
      FROM products p
      JOIN sale_items si ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id AND s.is_deleted = 0 AND s.status != 'Void'
      WHERE s.invoice_date >= ? AND s.invoice_date <= ?
      GROUP BY p.id
      ORDER BY total_revenue DESC
    `).all(from, to);

    const totals = rows.reduce((acc, r) => ({
      quantity_sold: acc.quantity_sold + r.quantity_sold,
      total_revenue: acc.total_revenue + r.total_revenue
    }), { quantity_sold: 0, total_revenue: 0 });

    res.json({ success: true, dateRange: { from, to }, totals, rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Sales by Date
router.get('/sales-by-date', (req, res) => {
  try {
    const { from, to } = getDates(req);

    const rows = db.prepare(`
      SELECT 
        s.invoice_date as date,
        COUNT(s.id) as invoice_count,
        COALESCE(SUM(s.subtotal), 0) as subtotal,
        COALESCE(SUM(s.tax), 0) as tax,
        COALESCE(SUM(s.total), 0) as total_sales,
        COALESCE(SUM(s.paid_amount), 0) as paid_amount,
        COALESCE(SUM(s.balance), 0) as balance
      FROM sales s
      WHERE s.is_deleted = 0 AND s.status != 'Void'
        AND s.invoice_date >= ? AND s.invoice_date <= ?
      GROUP BY s.invoice_date
      ORDER BY s.invoice_date ASC
    `).all(from, to);

    res.json({ success: true, dateRange: { from, to }, rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Outstanding Receivables (Aging Report)
router.get('/outstanding-sales', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        s.id,
        s.invoice_number,
        s.invoice_date,
        s.due_date,
        c.name as customer_name,
        c.company_name,
        c.phone,
        s.total,
        s.paid_amount,
        s.balance,
        s.payment_status,
        CAST((julianday('now') - julianday(s.due_date)) AS INTEGER) as days_overdue,
        CASE
          WHEN julianday('now') <= julianday(s.due_date) THEN 'Current'
          WHEN (julianday('now') - julianday(s.due_date)) <= 30 THEN '1-30 Days'
          WHEN (julianday('now') - julianday(s.due_date)) <= 60 THEN '31-60 Days'
          WHEN (julianday('now') - julianday(s.due_date)) <= 90 THEN '61-90 Days'
          ELSE '90+ Days'
        END as aging_bracket
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      WHERE s.is_deleted = 0 AND s.status != 'Void' AND s.balance > 0
      ORDER BY days_overdue DESC, s.due_date ASC
    `).all();

    const summary = rows.reduce((acc, r) => {
      acc.total_outstanding += r.balance;
      if (r.aging_bracket === 'Current') acc.current += r.balance;
      else if (r.aging_bracket === '1-30 Days') acc.bucket_1_30 += r.balance;
      else if (r.aging_bracket === '31-60 Days') acc.bucket_31_60 += r.balance;
      else if (r.aging_bracket === '61-90 Days') acc.bucket_61_90 += r.balance;
      else acc.bucket_90_plus += r.balance;
      return acc;
    }, { total_outstanding: 0, current: 0, bucket_1_30: 0, bucket_31_60: 0, bucket_61_90: 0, bucket_90_plus: 0 });

    res.json({ success: true, summary, rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Purchases Summary
router.get('/purchases-summary', (req, res) => {
  try {
    const { from, to } = getDates(req);

    const summary = db.prepare(`
      SELECT 
        COUNT(id) as total_purchases_count,
        COALESCE(SUM(subtotal), 0) as gross_purchases,
        COALESCE(SUM(discount), 0) as total_discount,
        COALESCE(SUM(tax), 0) as total_tax,
        COALESCE(SUM(total), 0) as net_purchases,
        COALESCE(SUM(paid_amount), 0) as total_paid,
        COALESCE(SUM(balance), 0) as total_balance
      FROM purchases
      WHERE is_deleted = 0 AND status != 'Cancelled'
        AND purchase_date >= ? AND purchase_date <= ?
    `).get(from, to);

    const rows = db.prepare(`
      SELECT 
        p.purchase_date,
        p.purchase_number,
        s.name as supplier_name,
        s.company_name as supplier_company,
        p.subtotal,
        p.discount,
        p.tax,
        p.total,
        p.paid_amount,
        p.balance,
        p.status,
        p.payment_status
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.is_deleted = 0 AND p.status != 'Cancelled'
        AND p.purchase_date >= ? AND p.purchase_date <= ?
      ORDER BY p.purchase_date DESC, p.id DESC
    `).all(from, to);

    res.json({ success: true, dateRange: { from, to }, summary, rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Purchases by Supplier
router.get('/purchases-by-supplier', (req, res) => {
  try {
    const { from, to } = getDates(req);

    const rows = db.prepare(`
      SELECT 
        s.id as supplier_id,
        s.name as supplier_name,
        s.company_name,
        COUNT(p.id) as purchase_count,
        COALESCE(SUM(p.subtotal), 0) as subtotal,
        COALESCE(SUM(p.tax), 0) as tax,
        COALESCE(SUM(p.total), 0) as total_purchases,
        COALESCE(SUM(p.paid_amount), 0) as total_paid,
        COALESCE(SUM(p.balance), 0) as balance
      FROM suppliers s
      JOIN purchases p ON p.supplier_id = s.id AND p.is_deleted = 0 AND p.status != 'Cancelled'
      WHERE p.purchase_date >= ? AND p.purchase_date <= ?
      GROUP BY s.id
      ORDER BY total_purchases DESC
    `).all(from, to);

    res.json({ success: true, dateRange: { from, to }, rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Purchases by Product
router.get('/purchases-by-product', (req, res) => {
  try {
    const { from, to } = getDates(req);

    const rows = db.prepare(`
      SELECT 
        pr.id as product_id,
        pr.sku,
        pr.name as product_name,
        pr.category,
        pr.unit,
        COALESCE(SUM(pi.quantity), 0) as quantity_purchased,
        COALESCE(AVG(pi.rate), 0) as average_purchase_rate,
        COALESCE(SUM(pi.amount), 0) as total_spend
      FROM products pr
      JOIN purchase_items pi ON pi.product_id = pr.id
      JOIN purchases p ON pi.purchase_id = p.id AND p.is_deleted = 0 AND p.status != 'Cancelled'
      WHERE p.purchase_date >= ? AND p.purchase_date <= ?
      GROUP BY pr.id
      ORDER BY total_spend DESC
    `).all(from, to);

    res.json({ success: true, dateRange: { from, to }, rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Stock Summary
router.get('/stock-summary', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        id, sku, barcode, name, category, unit,
        purchase_price, selling_price,
        current_stock, reorder_level,
        (current_stock * purchase_price) as stock_valuation_cost,
        (current_stock * selling_price) as stock_valuation_retail,
        CASE 
          WHEN current_stock <= 0 THEN 'Out of Stock'
          WHEN current_stock <= reorder_level THEN 'Low Stock'
          ELSE 'In Stock'
        END as stock_status
      FROM products
      WHERE is_deleted = 0 AND is_active = 1
      ORDER BY category ASC, name ASC
    `).all();

    const totals = rows.reduce((acc, r) => ({
      total_products: acc.total_products + 1,
      total_stock_qty: acc.total_stock_qty + r.current_stock,
      total_valuation_cost: acc.total_valuation_cost + r.stock_valuation_cost,
      total_valuation_retail: acc.total_valuation_retail + r.stock_valuation_retail
    }), { total_products: 0, total_stock_qty: 0, total_valuation_cost: 0, total_valuation_retail: 0 });

    res.json({ success: true, totals, rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Low Stock Alerts
router.get('/low-stock', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        id, sku, name, category, unit, current_stock, reorder_level, purchase_price,
        (reorder_level * 2 - current_stock) as suggested_reorder_qty,
        CASE WHEN current_stock <= 0 THEN 'Out of Stock' ELSE 'Low Stock' END as status
      FROM products
      WHERE is_deleted = 0 AND is_active = 1 AND current_stock <= reorder_level
      ORDER BY current_stock ASC
    `).all();

    res.json({ success: true, count: rows.length, rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Stock Movements History
router.get('/stock-movements', (req, res) => {
  try {
    const { from, to, product_id, movement_type } = req.query;
    let query = `
      SELECT 
        sm.id, sm.movement_date, sm.movement_type, sm.reference_type, sm.reference_id,
        sm.quantity, sm.unit_cost, sm.notes, sm.created_at,
        p.id as product_id, p.name as product_name, p.sku as product_sku, p.unit
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (from) {
      query += ` AND sm.movement_date >= ?`;
      params.push(from);
    }
    if (to) {
      query += ` AND sm.movement_date <= ?`;
      params.push(to);
    }
    if (product_id) {
      query += ` AND sm.product_id = ?`;
      params.push(Number(product_id));
    }
    if (movement_type && movement_type !== 'All') {
      query += ` AND sm.movement_type = ?`;
      params.push(movement_type);
    }

    query += ` ORDER BY sm.movement_date DESC, sm.id DESC LIMIT 100`;

    const rows = db.prepare(query).all(...params);

    res.json({ success: true, rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Stock Valuation
router.get('/stock-valuation', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT 
        category,
        COUNT(id) as product_count,
        SUM(current_stock) as total_units,
        SUM(current_stock * purchase_price) as cost_valuation,
        SUM(current_stock * selling_price) as retail_valuation,
        (SUM(current_stock * selling_price) - SUM(current_stock * purchase_price)) as potential_margin
      FROM products
      WHERE is_deleted = 0 AND is_active = 1
      GROUP BY category
      ORDER BY cost_valuation DESC
    `).all();

    const grandTotals = categories.reduce((acc, c) => ({
      product_count: acc.product_count + c.product_count,
      total_units: acc.total_units + c.total_units,
      cost_valuation: acc.cost_valuation + c.cost_valuation,
      retail_valuation: acc.retail_valuation + c.retail_valuation,
      potential_margin: acc.potential_margin + c.potential_margin
    }), { product_count: 0, total_units: 0, cost_valuation: 0, retail_valuation: 0, potential_margin: 0 });

    res.json({ success: true, grandTotals, categories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Financial: Income & Expense (Profit and Loss Statement)
router.get('/income-expense', (req, res) => {
  try {
    const { from, to } = getDates(req);

    // Total Sales Revenue
    const sales = db.prepare(`
      SELECT 
        COALESCE(SUM(subtotal), 0) as gross_revenue,
        COALESCE(SUM(discount), 0) as sales_discounts,
        COALESCE(SUM(total), 0) as net_sales_revenue,
        COALESCE(SUM(tax), 0) as sales_tax_collected
      FROM sales
      WHERE is_deleted = 0 AND status != 'Void' AND invoice_date >= ? AND invoice_date <= ?
    `).get(from, to);

    // Purchases / Cost of Goods
    const purchases = db.prepare(`
      SELECT 
        COALESCE(SUM(total), 0) as total_purchases,
        COALESCE(SUM(tax), 0) as purchase_tax_paid
      FROM purchases
      WHERE is_deleted = 0 AND status != 'Cancelled' AND purchase_date >= ? AND purchase_date <= ?
    `).get(from, to);

    // Expenses Breakdown by Category
    const expensesByCategory = db.prepare(`
      SELECT 
        category,
        COALESCE(SUM(amount), 0) as amount,
        COUNT(id) as count
      FROM expenditures
      WHERE is_deleted = 0 AND expense_date >= ? AND expense_date <= ?
      GROUP BY category
      ORDER BY amount DESC
    `).all(from, to);

    const totalOperatingExpenses = expensesByCategory.reduce((sum, e) => sum + e.amount, 0);

    const grossProfit = sales.net_sales_revenue - purchases.total_purchases;
    const netOperatingProfit = grossProfit - totalOperatingExpenses;
    const netTaxPayable = sales.sales_tax_collected - purchases.purchase_tax_paid;

    res.json({
      success: true,
      dateRange: { from, to },
      revenue: sales,
      cogs: purchases,
      grossProfit,
      operatingExpenses: {
        total: totalOperatingExpenses,
        breakdown: expensesByCategory
      },
      netProfit: netOperatingProfit,
      tax: {
        collected: sales.sales_tax_collected,
        paid: purchases.purchase_tax_paid,
        netPayable: netTaxPayable
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 14. Financial: Payments Received Summary
router.get('/payments-received', (req, res) => {
  try {
    const { from, to } = getDates(req);

    const byMethod = db.prepare(`
      SELECT 
        payment_method,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(id) as transaction_count
      FROM payments_received
      WHERE is_deleted = 0 AND payment_date >= ? AND payment_date <= ?
      GROUP BY payment_method
      ORDER BY total_amount DESC
    `).all(from, to);

    const rows = db.prepare(`
      SELECT 
        pr.payment_date,
        pr.payment_number,
        c.name as customer_name,
        c.company_name as customer_company,
        s.invoice_number,
        pr.payment_method,
        pr.reference_number,
        pr.amount
      FROM payments_received pr
      JOIN customers c ON pr.customer_id = c.id
      LEFT JOIN sales s ON pr.sale_id = s.id
      WHERE pr.is_deleted = 0 AND pr.payment_date >= ? AND pr.payment_date <= ?
      ORDER BY pr.payment_date DESC, pr.id DESC
    `).all(from, to);

    const totalReceived = byMethod.reduce((sum, m) => sum + m.total_amount, 0);

    res.json({
      success: true,
      dateRange: { from, to },
      totalReceived,
      byMethod,
      rows
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 15. Financial: Expense Summary
router.get('/expense-summary', (req, res) => {
  try {
    const { from, to } = getDates(req);

    const byCategory = db.prepare(`
      SELECT category, COALESCE(SUM(amount), 0) as total_amount, COUNT(id) as count
      FROM expenditures
      WHERE is_deleted = 0 AND expense_date >= ? AND expense_date <= ?
      GROUP BY category
      ORDER BY total_amount DESC
    `).all(from, to);

    const byVendor = db.prepare(`
      SELECT COALESCE(vendor, 'Unspecified') as vendor, COALESCE(SUM(amount), 0) as total_amount, COUNT(id) as count
      FROM expenditures
      WHERE is_deleted = 0 AND expense_date >= ? AND expense_date <= ?
      GROUP BY vendor
      ORDER BY total_amount DESC
      LIMIT 10
    `).all(from, to);

    const rows = db.prepare(`
      SELECT 
        expense_date, expense_number, category, description, vendor,
        amount, tax, payment_method, reference_number, status
      FROM expenditures
      WHERE is_deleted = 0 AND expense_date >= ? AND expense_date <= ?
      ORDER BY expense_date DESC, id DESC
    `).all(from, to);

    const totalExpenses = byCategory.reduce((sum, c) => sum + c.total_amount, 0);

    res.json({
      success: true,
      dateRange: { from, to },
      totalExpenses,
      byCategory,
      byVendor,
      rows
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

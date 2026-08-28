const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'ledgerly.db');
const db = new Database(dbPath);

// Enable WAL mode and foreign keys for high performance and data integrity
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    -- Users
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Businesses
    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      tax_number TEXT,
      currency TEXT NOT NULL DEFAULT 'AED',
      currency_symbol TEXT NOT NULL DEFAULT 'AED',
      timezone TEXT NOT NULL DEFAULT 'Asia/Dubai',
      date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Products
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL DEFAULT 1,
      sku TEXT NOT NULL UNIQUE,
      barcode TEXT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'units',
      purchase_price REAL NOT NULL DEFAULT 0.0,
      selling_price REAL NOT NULL DEFAULT 0.0,
      opening_stock REAL NOT NULL DEFAULT 0.0,
      current_stock REAL NOT NULL DEFAULT 0.0,
      reorder_level REAL NOT NULL DEFAULT 5.0,
      tax_rate REAL NOT NULL DEFAULT 5.0,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (business_id) REFERENCES businesses(id)
    );

    -- Customers
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      company_name TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      tax_number TEXT,
      opening_balance REAL NOT NULL DEFAULT 0.0,
      outstanding_balance REAL NOT NULL DEFAULT 0.0,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (business_id) REFERENCES businesses(id)
    );

    -- Suppliers
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      company_name TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      tax_number TEXT,
      opening_balance REAL NOT NULL DEFAULT 0.0,
      outstanding_balance REAL NOT NULL DEFAULT 0.0,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (business_id) REFERENCES businesses(id)
    );

    -- Purchases
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL DEFAULT 1,
      supplier_id INTEGER NOT NULL,
      purchase_number TEXT NOT NULL UNIQUE,
      purchase_date TEXT NOT NULL, -- Format YYYY-MM-DD
      reference_number TEXT,
      payment_terms TEXT DEFAULT 'Due on Receipt',
      subtotal REAL NOT NULL DEFAULT 0.0,
      discount REAL NOT NULL DEFAULT 0.0,
      tax REAL NOT NULL DEFAULT 0.0,
      total REAL NOT NULL DEFAULT 0.0,
      paid_amount REAL NOT NULL DEFAULT 0.0,
      balance REAL NOT NULL DEFAULT 0.0,
      payment_status TEXT NOT NULL DEFAULT 'Pending', -- Paid, Partially Paid, Pending
      status TEXT NOT NULL DEFAULT 'Received', -- Received, Draft, Cancelled
      notes TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (business_id) REFERENCES businesses(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    -- Purchase Items
    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      description TEXT,
      quantity REAL NOT NULL,
      rate REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0.0,
      tax_rate REAL NOT NULL DEFAULT 5.0,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- Quotations
    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL DEFAULT 1,
      customer_id INTEGER NOT NULL,
      quotation_number TEXT NOT NULL UNIQUE,
      quotation_date TEXT NOT NULL, -- Format YYYY-MM-DD
      valid_until TEXT NOT NULL,    -- Format YYYY-MM-DD
      reference_number TEXT,
      subtotal REAL NOT NULL DEFAULT 0.0,
      discount REAL NOT NULL DEFAULT 0.0,
      tax REAL NOT NULL DEFAULT 0.0,
      total REAL NOT NULL DEFAULT 0.0,
      status TEXT NOT NULL DEFAULT 'Draft', -- Draft, Sent, Accepted, Rejected, Expired, Converted
      notes TEXT,
      terms TEXT,
      converted_sale_id INTEGER,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (business_id) REFERENCES businesses(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    -- Quotation Items
    CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      description TEXT,
      quantity REAL NOT NULL,
      rate REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0.0,
      tax_rate REAL NOT NULL DEFAULT 5.0,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- Sales / Invoices
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL DEFAULT 1,
      customer_id INTEGER NOT NULL,
      quotation_id INTEGER,
      invoice_number TEXT NOT NULL UNIQUE,
      invoice_date TEXT NOT NULL, -- Format YYYY-MM-DD
      due_date TEXT NOT NULL,     -- Format YYYY-MM-DD
      reference_number TEXT,
      subtotal REAL NOT NULL DEFAULT 0.0,
      discount REAL NOT NULL DEFAULT 0.0,
      tax REAL NOT NULL DEFAULT 0.0,
      total REAL NOT NULL DEFAULT 0.0,
      paid_amount REAL NOT NULL DEFAULT 0.0,
      balance REAL NOT NULL DEFAULT 0.0,
      payment_status TEXT NOT NULL DEFAULT 'Pending', -- Paid, Partially Paid, Pending, Overdue
      status TEXT NOT NULL DEFAULT 'Active', -- Active, Draft, Void, Cancelled
      payment_method TEXT,
      notes TEXT,
      terms TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (business_id) REFERENCES businesses(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (quotation_id) REFERENCES quotations(id)
    );

    -- Sale Items
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      description TEXT,
      quantity REAL NOT NULL,
      rate REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0.0,
      tax_rate REAL NOT NULL DEFAULT 5.0,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- Payments Received
    CREATE TABLE IF NOT EXISTS payments_received (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL DEFAULT 1,
      customer_id INTEGER NOT NULL,
      sale_id INTEGER,
      payment_number TEXT NOT NULL UNIQUE,
      payment_date TEXT NOT NULL, -- Format YYYY-MM-DD
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL, -- Cash, Bank Transfer, Card, Cheque, Other
      reference_number TEXT,
      notes TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (business_id) REFERENCES businesses(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    );

    -- Expenditures
    CREATE TABLE IF NOT EXISTS expenditures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL DEFAULT 1,
      expense_number TEXT NOT NULL UNIQUE,
      expense_date TEXT NOT NULL, -- Format YYYY-MM-DD
      category TEXT NOT NULL, -- Rent, Utilities, Salaries, Transportation, Office Supplies, Marketing, Software, Maintenance, Travel, Other
      description TEXT NOT NULL,
      vendor TEXT,
      amount REAL NOT NULL,
      tax REAL NOT NULL DEFAULT 0.0,
      payment_method TEXT NOT NULL DEFAULT 'Bank Transfer',
      reference_number TEXT,
      notes TEXT,
      receipt_url TEXT,
      status TEXT NOT NULL DEFAULT 'Paid',
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (business_id) REFERENCES businesses(id)
    );

    -- Stock Movements
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL DEFAULT 1,
      product_id INTEGER NOT NULL,
      movement_date TEXT NOT NULL, -- Format YYYY-MM-DD
      movement_type TEXT NOT NULL, -- OPENING, PURCHASE, SALE, RETURN_IN, RETURN_OUT, ADJUSTMENT_IN, ADJUSTMENT_OUT
      reference_type TEXT, -- PURCHASE, SALE, ADJUSTMENT, INITIAL
      reference_id TEXT,   -- e.g. INV-000001, PUR-000001, etc.
      quantity REAL NOT NULL, -- Positive for in, negative for out
      unit_cost REAL NOT NULL DEFAULT 0.0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (business_id) REFERENCES businesses(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- Document Sequences for auto-generating serials
    CREATE TABLE IF NOT EXISTS document_sequences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL DEFAULT 1,
      doc_type TEXT NOT NULL, -- INV, PUR, QUO, PAY, EXP
      prefix TEXT NOT NULL,
      next_number INTEGER NOT NULL DEFAULT 1,
      UNIQUE(business_id, doc_type)
    );

    -- Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL DEFAULT 1,
      user_id INTEGER DEFAULT 1,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      old_values TEXT,
      new_values TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Settings / App State
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Create Indexes for fast querying
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
    CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(invoice_date);
    CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
    CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_quotations_date ON quotations(quotation_date);
    CREATE INDEX IF NOT EXISTS idx_payments_date ON payments_received(payment_date);
    CREATE INDEX IF NOT EXISTS idx_expenditures_date ON expenditures(expense_date);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_prod ON stock_movements(product_id);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(movement_date);
  `);

  // Ensure default sequences exist
  const initSeq = db.prepare(`
    INSERT OR IGNORE INTO document_sequences (business_id, doc_type, prefix, next_number)
    VALUES (?, ?, ?, ?)
  `);
  initSeq.run(1, 'INV', 'INV-', 1);
  initSeq.run(1, 'PUR', 'PUR-', 1);
  initSeq.run(1, 'QUO', 'QUO-', 1);
  initSeq.run(1, 'PAY', 'PAY-', 1);
  initSeq.run(1, 'EXP', 'EXP-', 1);
}

// Function to generate the next document sequence number atomically
function getNextDocNumber(dbInstance, businessId = 1, docType) {
  const tableMap = {
    'INV': { table: 'sales', col: 'invoice_number' },
    'PUR': { table: 'purchases', col: 'purchase_number' },
    'QUO': { table: 'quotations', col: 'quotation_number' },
    'PAY': { table: 'payments_received', col: 'payment_number' },
    'EXP': { table: 'expenditures', col: 'expense_number' }
  };

  const getStmt = dbInstance.prepare(`
    SELECT prefix, next_number FROM document_sequences
    WHERE business_id = ? AND doc_type = ?
  `);
  const seq = getStmt.get(businessId, docType);
  if (!seq) {
    throw new Error(`Sequence not found for doc_type ${docType}`);
  }

  let num = seq.next_number;
  let formattedNum = `${seq.prefix}${String(num).padStart(6, '0')}`;

  const mapping = tableMap[docType];
  if (mapping) {
    while (true) {
      formattedNum = `${seq.prefix}${String(num).padStart(6, '0')}`;
      const exists = dbInstance.prepare(`SELECT id FROM ${mapping.table} WHERE ${mapping.col} = ?`).get(formattedNum);
      if (!exists) break;
      num++;
    }
  }

  dbInstance.prepare(`
    UPDATE document_sequences
    SET next_number = ?
    WHERE business_id = ? AND doc_type = ?
  `).run(num + 1, businessId, docType);

  return formattedNum;
}

// Audit logger helper
function logAudit(dbInstance, { businessId = 1, userId = 1, action, entityType, entityId, oldValues = null, newValues = null }) {
  try {
    dbInstance.prepare(`
      INSERT INTO audit_logs (business_id, user_id, action, entity_type, entity_id, old_values, new_values, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      businessId,
      userId,
      action,
      entityType,
      String(entityId || ''),
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null
    );
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

// Helper to recalculate customer balance
function recalculateCustomerBalance(dbInstance, customerId) {
  const customer = dbInstance.prepare('SELECT opening_balance FROM customers WHERE id = ?').get(customerId);
  if (!customer) return;

  const salesSum = dbInstance.prepare(`
    SELECT COALESCE(SUM(total), 0) as total_sales, COALESCE(SUM(paid_amount), 0) as total_paid
    FROM sales
    WHERE customer_id = ? AND is_deleted = 0 AND status != 'Void'
  `).get(customerId);

  const paymentsSum = dbInstance.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_received
    FROM payments_received
    WHERE customer_id = ? AND is_deleted = 0
  `).get(customerId);

  // Outstanding is (Opening Balance + Total Invoiced) - Total Payments Received
  const outstanding = (customer.opening_balance + salesSum.total_sales) - paymentsSum.total_received;
  dbInstance.prepare("UPDATE customers SET outstanding_balance = ?, updated_at = datetime('now') WHERE id = ?")
    .run(Math.max(0, outstanding), customerId);
}

// Helper to recalculate supplier balance
function recalculateSupplierBalance(dbInstance, supplierId) {
  const supplier = dbInstance.prepare('SELECT opening_balance FROM suppliers WHERE id = ?').get(supplierId);
  if (!supplier) return;

  const purchasesSum = dbInstance.prepare(`
    SELECT COALESCE(SUM(total), 0) as total_purchased, COALESCE(SUM(paid_amount), 0) as total_paid
    FROM purchases
    WHERE supplier_id = ? AND is_deleted = 0 AND status != 'Cancelled'
  `).get(supplierId);

  const outstanding = (supplier.opening_balance + purchasesSum.total_purchased) - purchasesSum.total_paid;
  dbInstance.prepare("UPDATE suppliers SET outstanding_balance = ?, updated_at = datetime('now') WHERE id = ?")
    .run(Math.max(0, outstanding), supplierId);
}

// Helper to recalculate product stock
function recalculateProductStock(dbInstance, productId) {
  const prod = dbInstance.prepare('SELECT opening_stock FROM products WHERE id = ?').get(productId);
  if (!prod) return;

  const movements = dbInstance.prepare(`
    SELECT COALESCE(SUM(quantity), 0) as total_movement
    FROM stock_movements
    WHERE product_id = ? AND movement_type != 'OPENING'
  `).get(productId);

  const current = prod.opening_stock + movements.total_movement;
  dbInstance.prepare("UPDATE products SET current_stock = ?, updated_at = datetime('now') WHERE id = ?")
    .run(current, productId);
}

initDatabase();

module.exports = {
  db,
  initDatabase,
  getNextDocNumber,
  logAudit,
  recalculateCustomerBalance,
  recalculateSupplierBalance,
  recalculateProductStock
};

const express = require('express');
const router = express.Router();
const { db, logAudit, recalculateProductStock } = require('../db');

// GET /api/products/summary
router.get('/summary', (req, res) => {
  try {
    const summary = db.prepare(`
      SELECT 
        COUNT(id) as total_products,
        COALESCE(SUM(current_stock * purchase_price), 0) as total_stock_value,
        COALESCE(SUM(CASE WHEN current_stock <= reorder_level AND current_stock > 0 THEN 1 ELSE 0 END), 0) as low_stock_count,
        COALESCE(SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END), 0) as out_of_stock_count,
        COALESCE(SUM(CASE WHEN current_stock > reorder_level THEN 1 ELSE 0 END), 0) as in_stock_count
      FROM products
      WHERE is_deleted = 0 AND is_active = 1
    `).get();

    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/products
router.get('/', (req, res) => {
  try {
    const { search, category, status, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT 
        id, sku, barcode, name, category, unit, purchase_price, selling_price,
        opening_stock, current_stock, reorder_level, tax_rate, description, is_active,
        created_at, updated_at,
        CASE
          WHEN current_stock <= 0 THEN 'Out of Stock'
          WHEN current_stock <= reorder_level THEN 'Low Stock'
          ELSE 'In Stock'
        END as stock_status
      FROM products
      WHERE is_deleted = 0
    `;
    const params = [];

    if (search) {
      query += ` AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ? OR category LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (category && category !== 'All') {
      query += ` AND category = ?`;
      params.push(category);
    }

    if (status === 'in_stock') {
      query += ` AND current_stock > reorder_level`;
    } else if (status === 'low_stock') {
      query += ` AND current_stock <= reorder_level AND current_stock > 0`;
    } else if (status === 'out_of_stock') {
      query += ` AND current_stock <= 0`;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const totalCount = db.prepare(countQuery).get(...params).total;

    query += ` ORDER BY name ASC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const products = db.prepare(query).all(...params);

    // Get unique categories for dropdown filter
    const categories = db.prepare(`
      SELECT DISTINCT category FROM products WHERE is_deleted = 0 ORDER BY category ASC
    `).all().map(r => r.category);

    res.json({
      success: true,
      data: products,
      pagination: {
        total: totalCount,
        limit: Number(limit),
        offset: Number(offset)
      },
      categories
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  try {
    const product = db.prepare(`
      SELECT 
        id, sku, barcode, name, category, unit, purchase_price, selling_price,
        opening_stock, current_stock, reorder_level, tax_rate, description, is_active,
        created_at, updated_at,
        CASE
          WHEN current_stock <= 0 THEN 'Out of Stock'
          WHEN current_stock <= reorder_level THEN 'Low Stock'
          ELSE 'In Stock'
        END as stock_status
      FROM products
      WHERE id = ? AND is_deleted = 0
    `).get(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Get recent stock movements
    const movements = db.prepare(`
      SELECT id, movement_date, movement_type, reference_type, reference_id, quantity, unit_cost, notes, created_at
      FROM stock_movements
      WHERE product_id = ?
      ORDER BY movement_date DESC, id DESC
      LIMIT 20
    `).all(req.params.id);

    res.json({ success: true, data: { ...product, movements } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/products/:id/movements
router.get('/:id/movements', (req, res) => {
  try {
    const movements = db.prepare(`
      SELECT id, movement_date, movement_type, reference_type, reference_id, quantity, unit_cost, notes, created_at
      FROM stock_movements
      WHERE product_id = ?
      ORDER BY movement_date DESC, id DESC
    `).all(req.params.id);

    res.json({ success: true, data: movements });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/products
router.post('/', (req, res) => {
  try {
    const {
      sku, barcode, name, category, unit = 'units',
      purchase_price = 0, selling_price = 0, opening_stock = 0,
      reorder_level = 5, tax_rate = 5, description
    } = req.body;

    if (!sku || !name || !category) {
      return res.status(400).json({ success: false, error: 'SKU, Product Name, and Category are required.' });
    }

    // Check SKU duplicate
    const existing = db.prepare('SELECT id FROM products WHERE sku = ? AND is_deleted = 0').get(sku);
    if (existing) {
      return res.status(400).json({ success: false, error: `SKU '${sku}' already exists.` });
    }

    const createTx = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO products (
          business_id, sku, barcode, name, category, unit, purchase_price, selling_price,
          opening_stock, current_stock, reorder_level, tax_rate, description
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sku.trim(),
        barcode ? barcode.trim() : null,
        name.trim(),
        category.trim(),
        unit.trim(),
        Number(purchase_price) || 0,
        Number(selling_price) || 0,
        Number(opening_stock) || 0,
        Number(opening_stock) || 0,
        Number(reorder_level) || 0,
        Number(tax_rate) || 0,
        description ? description.trim() : null
      );

      const productId = info.lastInsertRowid;

      if (Number(opening_stock) > 0) {
        const today = new Date().toISOString().split('T')[0];
        db.prepare(`
          INSERT INTO stock_movements (business_id, product_id, movement_date, movement_type, reference_type, reference_id, quantity, unit_cost, notes)
          VALUES (1, ?, ?, 'OPENING', 'INITIAL', 'INIT', ?, ?, 'Initial opening stock')
        `).run(productId, today, Number(opening_stock), Number(purchase_price) || 0);
      }

      logAudit(db, {
        action: 'CREATE',
        entityType: 'PRODUCT',
        entityId: productId,
        newValues: { sku, name, category, selling_price, opening_stock }
      });

      return productId;
    });

    const newId = createTx();
    const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(newId);

    res.status(201).json({ success: true, data: newProduct, message: 'Product created successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/products/:id
router.put('/:id', (req, res) => {
  try {
    const {
      sku, barcode, name, category, unit,
      purchase_price, selling_price, reorder_level, tax_rate, description, is_active
    } = req.body;

    const oldProduct = db.prepare('SELECT * FROM products WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!oldProduct) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Check SKU conflict with another product
    if (sku && sku !== oldProduct.sku) {
      const conflict = db.prepare('SELECT id FROM products WHERE sku = ? AND id != ? AND is_deleted = 0').get(sku, req.params.id);
      if (conflict) {
        return res.status(400).json({ success: false, error: `SKU '${sku}' is already used by another product.` });
      }
    }

    db.prepare(`
      UPDATE products
      SET sku = COALESCE(?, sku),
          barcode = ?,
          name = COALESCE(?, name),
          category = COALESCE(?, category),
          unit = COALESCE(?, unit),
          purchase_price = COALESCE(?, purchase_price),
          selling_price = COALESCE(?, selling_price),
          reorder_level = COALESCE(?, reorder_level),
          tax_rate = COALESCE(?, tax_rate),
          description = ?,
          is_active = COALESCE(?, is_active),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      sku ? sku.trim() : null,
      barcode !== undefined ? (barcode ? barcode.trim() : null) : oldProduct.barcode,
      name ? name.trim() : null,
      category ? category.trim() : null,
      unit ? unit.trim() : null,
      purchase_price !== undefined ? Number(purchase_price) : null,
      selling_price !== undefined ? Number(selling_price) : null,
      reorder_level !== undefined ? Number(reorder_level) : null,
      tax_rate !== undefined ? Number(tax_rate) : null,
      description !== undefined ? (description ? description.trim() : null) : oldProduct.description,
      is_active !== undefined ? Number(is_active) : null,
      req.params.id
    );

    logAudit(db, {
      action: 'UPDATE',
      entityType: 'PRODUCT',
      entityId: req.params.id,
      oldValues: oldProduct,
      newValues: req.body
    });

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated, message: 'Product updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/products/:id/adjust (Stock Adjustment)
router.post('/:id/adjust', (req, res) => {
  try {
    const { adjustment_type, quantity, date, reason, notes, unit_cost } = req.body;
    // adjustment_type: 'ADJUSTMENT_IN' or 'ADJUSTMENT_OUT'

    if (!quantity || Number(quantity) <= 0) {
      return res.status(400).json({ success: false, error: 'Adjustment quantity must be greater than 0.' });
    }

    const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const qtyNumber = Number(quantity);
    const movementQty = adjustment_type === 'ADJUSTMENT_OUT' ? -qtyNumber : qtyNumber;
    const movementDate = date || new Date().toISOString().split('T')[0];
    const cost = unit_cost ? Number(unit_cost) : product.purchase_price;

    const adjustTx = db.transaction(() => {
      // 1. Log stock movement
      db.prepare(`
        INSERT INTO stock_movements (business_id, product_id, movement_date, movement_type, reference_type, reference_id, quantity, unit_cost, notes)
        VALUES (1, ?, ?, ?, 'ADJUSTMENT', ?, ?, ?, ?)
      `).run(
        product.id,
        movementDate,
        adjustment_type,
        reason || 'Manual Adjustment',
        movementQty,
        cost,
        notes || (adjustment_type === 'ADJUSTMENT_IN' ? 'Stock Added' : 'Stock Written Off')
      );

      // 2. Recalculate current stock
      recalculateProductStock(db, product.id);

      // 3. Log audit
      logAudit(db, {
        action: 'STOCK_ADJUST',
        entityType: 'PRODUCT',
        entityId: product.id,
        newValues: { adjustment_type, quantity: movementQty, reason, notes }
      });
    });

    adjustTx();

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(product.id);
    res.json({ success: true, data: updated, message: 'Stock adjusted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/products/:id (Soft delete)
router.delete('/:id', (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    db.prepare('UPDATE products SET is_deleted = 1, updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id);

    logAudit(db, {
      action: 'DELETE',
      entityType: 'PRODUCT',
      entityId: req.params.id,
      oldValues: product
    });

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

/**
 * Ledgerly Stock / Inventory Module
 */
const StockView = {
  products: [],
  summary: {},
  categories: [],
  search: '',
  selectedCategory: 'All',
  selectedStatus: 'All',
  limit: 50,
  offset: 0,
  total: 0,

  async render() {
    Topbar.updateTitle('Stock', [{ label: 'Stock' }]);
    const contentEl = document.getElementById('app-content');

    contentEl.innerHTML = `
      <div class="content-container">
        <div style="display:flex; justify-content:center; padding: 40px; color:var(--text-muted);">
          Loading stock inventory...
        </div>
      </div>
    `;

    try {
      const [sumRes, prodRes] = await Promise.all([
        API.get('/products/summary'),
        API.get('/products', {
          search: this.search,
          category: this.selectedCategory,
          status: this.selectedStatus === 'All' ? '' : this.selectedStatus,
          limit: this.limit,
          offset: this.offset
        })
      ]);

      this.summary = sumRes.data || {};
      this.products = prodRes.data || [];
      this.categories = prodRes.categories || [];
      this.total = prodRes.pagination?.total || 0;

      // Update badge in sidebar
      const badgeEl = document.getElementById('badge-stock-count');
      if (badgeEl) badgeEl.textContent = this.summary.total_products || this.products.length;

      this.renderContent();
    } catch (e) {
      contentEl.innerHTML = `<div class="card" style="padding: 24px; color:var(--danger);">Error loading stock: ${e.message}</div>`;
    }
  },

  renderContent() {
    const currency = State.business.currency || 'AED';
    const contentEl = document.getElementById('app-content');

    contentEl.innerHTML = `
      <div class="content-container">
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
          <div>
            <h1 style="font-size:20px; font-weight:700; color:var(--text-primary);">Stock</h1>
            <p style="font-size:13px; color:var(--text-secondary);">Manage your products and inventory.</p>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="StockView.exportCSV()">Export CSV</button>
            <button class="btn btn-primary btn-sm" onclick="StockView.openProductModal()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>+ Add Product</span>
            </button>
          </div>
        </div>

        <!-- Stock Summary Cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-title">Total Products</span>
            <div class="kpi-value">${this.summary.total_products || 0}</div>
            <div class="kpi-trend"><span class="text-muted">Unique SKUs active</span></div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">In Stock</span>
            <div class="kpi-value" style="color:var(--success);">${this.summary.in_stock_count || 0}</div>
            <div class="kpi-trend"><span class="text-muted">Healthy inventory level</span></div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">Low Stock</span>
            <div class="kpi-value" style="color:var(--warning);">${this.summary.low_stock_count || 0}</div>
            <div class="kpi-trend"><span class="text-muted">At or below reorder limit</span></div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">Out of Stock</span>
            <div class="kpi-value" style="color:var(--danger);">${this.summary.out_of_stock_count || 0}</div>
            <div class="kpi-trend"><span class="text-muted">Zero units available</span></div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">Stock Value</span>
            <div class="kpi-value">${Utils.formatCurrency(this.summary.total_stock_value || 0, currency)}</div>
            <div class="kpi-trend"><span class="text-muted">Total inventory at cost</span></div>
          </div>
        </div>

        <!-- Filter Bar -->
        ${FilterBar.render({
          searchPlaceholder: 'Search product name, SKU, barcode...',
          searchValue: this.search,
          onSearch: 'StockView.onSearch(this.value)',
          showDateFilter: false,
          statusOptions: [
            { value: 'All', label: 'All Stock Levels' },
            { value: 'in_stock', label: '🟢 In Stock' },
            { value: 'low_stock', label: '🟠 Low Stock' },
            { value: 'out_of_stock', label: '🔴 Out of Stock' }
          ],
          selectedStatus: this.selectedStatus,
          onStatusChange: 'StockView.onStatusFilter(this.value)',
          showExport: false
        })}

        <!-- Product Table -->
        ${Table.render({
          columns: [
            { label: 'SKU', key: 'sku', render: (val) => `<strong style="color:var(--primary);">${val}</strong>` },
            { label: 'Product', key: 'name', render: (val, r) => `<div><strong>${val}</strong>${r.barcode ? `<div style="font-size:11px; color:var(--text-muted);">Barcode: ${r.barcode}</div>` : ''}</div>` },
            { label: 'Category', key: 'category', render: (val) => `<span class="badge badge-neutral">${val}</span>` },
            { label: 'Purchase Price', key: 'purchase_price', align: 'right', render: (val) => Utils.formatCurrency(val, currency) },
            { label: 'Selling Price', key: 'selling_price', align: 'right', render: (val) => `<span class="font-semibold">${Utils.formatCurrency(val, currency)}</span>` },
            { label: 'Stock', key: 'current_stock', align: 'right', render: (val, r) => `<strong>${val}</strong> <span style="font-size:11px; color:var(--text-muted);">${r.unit}</span>` },
            { label: 'Reorder Level', key: 'reorder_level', align: 'center', render: (val) => val },
            { label: 'Status', key: 'stock_status', render: (val) => Utils.renderStatusBadge(val) },
            {
              label: 'Actions',
              key: 'id',
              align: 'right',
              render: (val, r) => `
                <div class="table-actions">
                  <button class="btn btn-secondary btn-sm" onclick="StockView.openAdjustModal(${r.id})" title="Adjust Stock">Adjust</button>
                  <button class="btn btn-secondary btn-sm" onclick="StockView.openMovementsDrawer(${r.id})" title="History">History</button>
                  <button class="btn btn-secondary btn-sm" onclick="StockView.openProductModal(${r.id})" title="Edit">Edit</button>
                  <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="StockView.deleteProduct(${r.id}, '${r.name.replace(/'/g, "\\'")}')" title="Delete">✕</button>
                </div>
              `
            }
          ],
          data: this.products,
          emptyTitle: 'No products in stock',
          emptyMessage: 'Add your first product to start tracking inventory and stock movements.',
          emptyActionLabel: '+ Add Product',
          onEmptyAction: 'StockView.openProductModal()',
          pagination: {
            total: this.total,
            limit: this.limit,
            offset: this.offset
          }
        })}
      </div>
    `;
  },

  onSearch: Utils.debounce(function(val) {
    StockView.search = val;
    StockView.offset = 0;
    StockView.render();
  }, 250),

  onStatusFilter(val) {
    this.selectedStatus = val;
    this.offset = 0;
    this.render();
  },

  exportCSV() {
    Utils.exportToCSV('stock_inventory', this.products.map(p => ({
      SKU: p.sku,
      Name: p.name,
      Category: p.category,
      Unit: p.unit,
      PurchasePrice: p.purchase_price,
      SellingPrice: p.selling_price,
      CurrentStock: p.current_stock,
      ReorderLevel: p.reorder_level,
      TaxRate: p.tax_rate,
      Status: p.stock_status
    })));
  },

  async openProductModal(productId = null) {
    let product = {
      sku: `PRD-0${Math.floor(100 + Math.random() * 900)}`,
      barcode: '',
      name: '',
      category: 'Electronics',
      unit: 'pcs',
      purchase_price: 0,
      selling_price: 0,
      opening_stock: 0,
      reorder_level: 5,
      tax_rate: 5,
      description: ''
    };

    if (productId) {
      try {
        const res = await API.get(`/products/${productId}`);
        product = res.data;
      } catch (e) {
        return;
      }
    }

    const isEdit = !!productId;

    Modal.open({
      title: isEdit ? `Edit Product: ${product.name}` : 'Add New Product',
      size: 'lg',
      bodyHtml: `
        <form id="product-form" onsubmit="StockView.saveProduct(event, ${productId || 'null'})">
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Product Name <span class="required">*</span></label>
              <input type="text" name="name" class="form-control" placeholder="e.g. Wireless Keyboard" value="${product.name || ''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">SKU <span class="required">*</span></label>
              <input type="text" name="sku" class="form-control" placeholder="e.g. PRD-001" value="${product.sku || ''}" required>
            </div>
          </div>

          <div class="form-grid-3">
            <div class="form-group">
              <label class="form-label">Category <span class="required">*</span></label>
              <input type="text" name="category" class="form-control" placeholder="Electronics, Stationery..." value="${product.category || ''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Unit</label>
              <input type="text" name="unit" class="form-control" placeholder="pcs, sets, boxes..." value="${product.unit || 'pcs'}">
            </div>
            <div class="form-group">
              <label class="form-label">Barcode</label>
              <input type="text" name="barcode" class="form-control" placeholder="EAN/UPC barcode" value="${product.barcode || ''}">
            </div>
          </div>

          <div class="form-grid-3">
            <div class="form-group">
              <label class="form-label">Purchase Price (Cost)</label>
              <input type="number" step="0.01" name="purchase_price" class="form-control" placeholder="0.00" value="${product.purchase_price || 0}">
            </div>
            <div class="form-group">
              <label class="form-label">Selling Price</label>
              <input type="number" step="0.01" name="selling_price" class="form-control" placeholder="0.00" value="${product.selling_price || 0}">
            </div>
            <div class="form-group">
              <label class="form-label">Tax Rate (%)</label>
              <input type="number" step="0.01" name="tax_rate" class="form-control" placeholder="5" value="${product.tax_rate !== undefined ? product.tax_rate : 5}">
            </div>
          </div>

          <div class="form-grid-2">
            ${!isEdit ? `
              <div class="form-group">
                <label class="form-label">Opening Stock</label>
                <input type="number" name="opening_stock" class="form-control" placeholder="0" value="${product.opening_stock || 0}">
              </div>
            ` : ''}
            <div class="form-group">
              <label class="form-label">Reorder Level Alert</label>
              <input type="number" name="reorder_level" class="form-control" placeholder="5" value="${product.reorder_level || 5}">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Product Description</label>
            <textarea name="description" class="form-control" placeholder="Optional notes, specifications...">${product.description || ''}</textarea>
          </div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-secondary btn-sm" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="document.getElementById('product-form').requestSubmit()">${isEdit ? 'Update Product' : 'Save Product'}</button>
      `
    });
  },

  async saveProduct(event, productId) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const body = Object.fromEntries(formData.entries());

    try {
      if (productId) {
        await API.put(`/products/${productId}`, body);
        Toast.success('Product updated successfully');
      } else {
        await API.post('/products', body);
        Toast.success('Product created successfully');
      }
      Modal.close();
      this.render();
    } catch (e) {
      // Handled by API client
    }
  },

  openAdjustModal(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    Modal.open({
      title: `Stock Adjustment: ${product.name}`,
      bodyHtml: `
        <form id="adjust-form" onsubmit="StockView.saveAdjustment(event, ${productId})">
          <div style="padding:10px 14px; background:var(--surface-hover); border-radius:var(--radius-md); margin-bottom:16px; font-size:13px;">
            Current Stock: <strong>${product.current_stock} ${product.unit}</strong>
          </div>

          <div class="form-group">
            <label class="form-label">Adjustment Type <span class="required">*</span></label>
            <select name="adjustment_type" class="form-control" required>
              <option value="ADJUSTMENT_IN">➕ Stock In / Quantity Added (Count surplus)</option>
              <option value="ADJUSTMENT_OUT">➖ Stock Out / Quantity Deducted (Damage, loss, write-off)</option>
            </select>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Adjustment Quantity <span class="required">*</span></label>
              <input type="number" name="quantity" class="form-control" min="1" step="1" placeholder="e.g. 5" required>
            </div>
            <div class="form-group">
              <label class="form-label">Date <span class="required">*</span></label>
              <input type="date" name="date" class="form-control" value="${Utils.todayISO()}" required>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Reason / Reference</label>
            <input type="text" name="reason" class="form-control" placeholder="e.g. Annual inventory audit reconciliation">
          </div>

          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea name="notes" class="form-control" placeholder="Optional details..."></textarea>
          </div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-secondary btn-sm" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="document.getElementById('adjust-form').requestSubmit()">Save Adjustment</button>
      `
    });
  },

  async saveAdjustment(event, productId) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const body = Object.fromEntries(formData.entries());

    try {
      await API.post(`/products/${productId}/adjust`, body);
      Toast.success('Stock adjustment saved and inventory updated');
      Modal.close();
      this.render();
    } catch (e) {}
  },

  async openMovementsDrawer(productId) {
    try {
      const res = await API.get(`/products/${productId}`);
      const product = res.data;
      const movements = product.movements || [];

      Drawer.open({
        title: `Stock Ledger: ${product.name}`,
        size: 'lg',
        bodyHtml: `
          <div style="display:flex; justify-content:space-between; margin-bottom:16px; font-size:13px;">
            <div>SKU: <strong>${product.sku}</strong></div>
            <div>Current Stock: <strong style="color:var(--primary); font-size:15px;">${product.current_stock} ${product.unit}</strong></div>
          </div>
          ${Table.render({
            columns: [
              { label: 'Date', key: 'movement_date', render: (val) => Utils.formatDate(val) },
              { label: 'Type', key: 'movement_type', render: (val) => Utils.renderStatusBadge(val) },
              { label: 'Reference', key: 'reference_id', render: (val) => `<strong>${val || '—'}</strong>` },
              {
                label: 'Quantity',
                key: 'quantity',
                align: 'right',
                render: (val) => val > 0 ? `<span style="color:var(--success); font-weight:600;">+${val}</span>` : `<span style="color:var(--danger); font-weight:600;">${val}</span>`
              },
              { label: 'Notes', key: 'notes' }
            ],
            data: movements,
            emptyTitle: 'No stock movements recorded'
          })}
        `,
        footerHtml: `
          <button class="btn btn-secondary btn-sm" onclick="Drawer.close()">Close</button>
        `
      });
    } catch (e) {}
  },

  deleteProduct(productId, name) {
    Modal.open({
      title: 'Delete Product',
      bodyHtml: `
        <p style="font-size:13.5px; color:var(--text-secondary);">
          Are you sure you want to remove <strong>${name}</strong> from your stock inventory?
        </p>
      `,
      footerHtml: `
        <button class="btn btn-secondary btn-sm" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-danger btn-sm" onclick="StockView.confirmDelete(${productId})">Delete</button>
      `
    });
  },

  async confirmDelete(productId) {
    try {
      await API.delete(`/products/${productId}`);
      Toast.success('Product deleted successfully');
      Modal.close();
      this.render();
    } catch (e) {}
  }
};

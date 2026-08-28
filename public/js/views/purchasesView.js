/**
 * Ledgerly Purchases Module
 */
const PurchasesView = {
  purchases: [],
  summary: {},
  suppliers: [],
  products: [],
  search: '',
  selectedStatus: 'All',
  selectedPaymentStatus: 'All',
  limit: 50,
  offset: 0,
  total: 0,

  async render() {
    Topbar.updateTitle('Purchases', [{ label: 'Purchases' }]);
    const contentEl = document.getElementById('app-content');

    contentEl.innerHTML = `
      <div class="content-container">
        <div style="display:flex; justify-content:center; padding: 40px; color:var(--text-muted);">
          Loading purchases...
        </div>
      </div>
    `;

    try {
      const [sumRes, purchRes, suppRes, prodRes] = await Promise.all([
        API.get('/purchases/summary'),
        API.get('/purchases', {
          search: this.search,
          status: this.selectedStatus === 'All' ? '' : this.selectedStatus,
          payment_status: this.selectedPaymentStatus === 'All' ? '' : this.selectedPaymentStatus,
          limit: this.limit,
          offset: this.offset
        }),
        API.get('/suppliers'),
        API.get('/products')
      ]);

      this.summary = sumRes.data || {};
      this.purchases = purchRes.data || [];
      this.total = purchRes.pagination?.total || 0;
      this.suppliers = suppRes.data || [];
      this.products = prodRes.data || [];

      this.renderContent();
    } catch (e) {
      contentEl.innerHTML = `<div class="card" style="padding: 24px; color:var(--danger);">Error loading purchases: ${e.message}</div>`;
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
            <h1 style="font-size:20px; font-weight:700; color:var(--text-primary);">Purchases</h1>
            <p style="font-size:13px; color:var(--text-secondary);">Manage your vendor bills, stock purchase orders, and supplier payments.</p>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="PurchasesView.exportCSV()">Export CSV</button>
            <button class="btn btn-primary btn-sm" onclick="PurchasesView.openNewPurchaseModal()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>+ New Purchase</span>
            </button>
          </div>
        </div>

        <!-- KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-title">Total Purchases</span>
            <div class="kpi-value">${Utils.formatCurrency(this.summary.total_purchases || 0, currency)}</div>
            <div class="kpi-trend"><span class="text-muted">${this.summary.total_count || 0} purchase orders</span></div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">Paid to Vendors</span>
            <div class="kpi-value" style="color:var(--success);">${Utils.formatCurrency(this.summary.total_paid || 0, currency)}</div>
            <div class="kpi-trend"><span class="text-muted">Settled payments</span></div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">Vendor Payables (Balance)</span>
            <div class="kpi-value" style="color:var(--danger);">${Utils.formatCurrency(this.summary.total_outstanding || 0, currency)}</div>
            <div class="kpi-trend"><span class="text-muted">${this.summary.pending_payment_count || 0} pending orders</span></div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">Received Orders</span>
            <div class="kpi-value">${this.summary.received_count || 0}</div>
            <div class="kpi-trend"><span class="text-muted">Stock received in warehouse</span></div>
          </div>
        </div>

        <!-- Filter Bar -->
        ${FilterBar.render({
          searchPlaceholder: 'Search purchase #, supplier, reference...',
          searchValue: this.search,
          onSearch: 'PurchasesView.onSearch(this.value)',
          showDateFilter: false,
          statusOptions: [
            { value: 'All', label: 'All Statuses' },
            { value: 'Received', label: 'Received' },
            { value: 'Draft', label: 'Draft' },
            { value: 'Cancelled', label: 'Cancelled' }
          ],
          selectedStatus: this.selectedStatus,
          onStatusChange: 'PurchasesView.onStatusFilter(this.value)',
          showExport: false
        })}

        <!-- Purchases Table -->
        ${Table.render({
          columns: [
            { label: 'Purchase #', key: 'purchase_number', render: (val, r) => `<strong style="color:var(--primary); cursor:pointer;" onclick="PurchasesView.viewPurchase(${r.id})">${val}</strong>` },
            { label: 'Date', key: 'purchase_date', render: (val) => Utils.formatDate(val) },
            { label: 'Supplier', key: 'supplier_name', render: (val, r) => `<div><strong>${val}</strong>${r.supplier_company ? `<div style="font-size:11px; color:var(--text-muted);">${r.supplier_company}</div>` : ''}</div>` },
            { label: 'Items', key: 'item_count', align: 'center', render: (val) => `${val || 1} items` },
            { label: 'Total', key: 'total', align: 'right', render: (val) => `<span class="font-semibold">${Utils.formatCurrency(val, currency)}</span>` },
            { label: 'Paid', key: 'paid_amount', align: 'right', render: (val) => Utils.formatCurrency(val, currency) },
            { label: 'Balance', key: 'balance', align: 'right', render: (val) => `<span style="color:${val > 0 ? 'var(--danger)' : 'var(--text-secondary)'};">${Utils.formatCurrency(val, currency)}</span>` },
            { label: 'Status', key: 'status', render: (val) => Utils.renderStatusBadge(val) },
            { label: 'Payment', key: 'payment_status', render: (val) => Utils.renderStatusBadge(val) },
            {
              label: 'Actions',
              key: 'id',
              align: 'right',
              render: (val, r) => `
                <div class="table-actions">
                  <button class="btn btn-secondary btn-sm" onclick="PurchasesView.viewPurchase(${r.id})">View</button>
                  ${r.status !== 'Cancelled' ? `<button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="PurchasesView.cancelPurchase(${r.id})" title="Cancel & Reverse Stock">Cancel</button>` : ''}
                </div>
              `
            }
          ],
          data: this.purchases,
          emptyTitle: 'No purchases found',
          emptyMessage: 'Create your first purchase order to replenish stock and track supplier payables.',
          emptyActionLabel: '+ New Purchase',
          onEmptyAction: 'PurchasesView.openNewPurchaseModal()',
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
    PurchasesView.search = val;
    PurchasesView.offset = 0;
    PurchasesView.render();
  }, 250),

  onStatusFilter(val) {
    this.selectedStatus = val;
    this.offset = 0;
    this.render();
  },

  exportCSV() {
    Utils.exportToCSV('purchases', this.purchases.map(p => ({
      PurchaseNumber: p.purchase_number,
      Date: p.purchase_date,
      Supplier: p.supplier_name,
      Reference: p.reference_number || '',
      Total: p.total,
      Paid: p.paid_amount,
      Balance: p.balance,
      Status: p.status,
      PaymentStatus: p.payment_status
    })));
  },

  openNewPurchaseModal() {
    const suppliersOpts = this.suppliers.map(s => `<option value="${s.id}">${s.name} (${s.company_name || 'Individual'})</option>`).join('');
    const productsOpts = this.products.map(p => `<option value="${p.id}" data-cost="${p.purchase_price}" data-tax="${p.tax_rate}">${p.name} (SKU: ${p.sku} • AED ${p.purchase_price})</option>`).join('');

    Modal.open({
      title: 'New Purchase Order / Bill',
      size: 'lg',
      bodyHtml: `
        <form id="new-purchase-form" onsubmit="PurchasesView.savePurchase(event)">
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Supplier <span class="required">*</span></label>
              <select name="supplier_id" class="form-control" required>
                <option value="">Select a supplier...</option>
                ${suppliersOpts}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Purchase Date <span class="required">*</span></label>
              <input type="date" name="purchase_date" class="form-control" value="${Utils.todayISO()}" required>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Reference / Vendor Invoice #</label>
              <input type="text" name="reference_number" class="form-control" placeholder="e.g. PO-89021">
            </div>
            <div class="form-group">
              <label class="form-label">Payment Terms</label>
              <select name="payment_terms" class="form-control">
                <option value="Due on Receipt">Due on Receipt</option>
                <option value="Net 15">Net 15 Days</option>
                <option value="Net 30">Net 30 Days</option>
                <option value="Net 60">Net 60 Days</option>
              </select>
            </div>
          </div>

          <!-- Dynamic Line Items -->
          <div style="margin: 16px 0;">
            <label class="form-label" style="font-weight:600;">Purchase Items</label>
            <table class="line-items-table" id="purchase-line-items">
              <thead>
                <tr>
                  <th style="width:35%;">Product</th>
                  <th style="width:15%;">Qty</th>
                  <th style="width:18%;">Unit Cost</th>
                  <th style="width:12%;">Tax %</th>
                  <th style="width:15%;">Amount</th>
                  <th style="width:5%;"></th>
                </tr>
              </thead>
              <tbody id="purchase-items-body">
                <tr class="item-row">
                  <td>
                    <select class="form-control prod-select" onchange="PurchasesView.onProductChange(this)" required>
                      <option value="">Select product...</option>
                      ${productsOpts}
                    </select>
                  </td>
                  <td><input type="number" min="1" step="1" value="1" class="form-control qty-input" oninput="PurchasesView.recalcPurchaseTotals()" required></td>
                  <td><input type="number" step="0.01" value="0.00" class="form-control rate-input" oninput="PurchasesView.recalcPurchaseTotals()" required></td>
                  <td><input type="number" step="0.01" value="5" class="form-control tax-input" oninput="PurchasesView.recalcPurchaseTotals()"></td>
                  <td class="text-right font-semibold line-amount">AED 0.00</td>
                  <td class="text-center"><button type="button" class="btn btn-secondary btn-sm" onclick="PurchasesView.removeRow(this)">✕</button></td>
                </tr>
              </tbody>
            </table>
            <button type="button" class="btn btn-secondary btn-sm" onclick="PurchasesView.addRow()">+ Add Line Item</button>
          </div>

          <!-- Calculation Summary Box -->
          <div class="calculation-summary-box">
            <div class="calc-row"><span>Subtotal:</span><span id="purch-subtotal">AED 0.00</span></div>
            <div class="calc-row"><span>Tax (VAT):</span><span id="purch-tax">AED 0.00</span></div>
            <div class="calc-row total"><span>Grand Total:</span><span id="purch-grand-total">AED 0.00</span></div>
          </div>

          <!-- Payment settlement option -->
          <div class="form-grid-2" style="margin-top: 16px;">
            <div class="form-group">
              <label class="form-label">Initial Paid Amount (Optional)</label>
              <input type="number" step="0.01" name="paid_amount" id="purch-paid-input" class="form-control" placeholder="0.00" value="0">
            </div>
            <div class="form-group">
              <label class="form-label">Payment Method</label>
              <select name="payment_method" class="form-control">
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Card">Card</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Notes / Instructions</label>
            <textarea name="notes" class="form-control" placeholder="Optional notes for record keeping..."></textarea>
          </div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-secondary btn-sm" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="document.getElementById('new-purchase-form').requestSubmit()">Save Purchase</button>
      `
    });

    this.recalcPurchaseTotals();
  },

  addRow() {
    const productsOpts = this.products.map(p => `<option value="${p.id}" data-cost="${p.purchase_price}" data-tax="${p.tax_rate}">${p.name} (SKU: ${p.sku} • AED ${p.purchase_price})</option>`).join('');
    const tbody = document.getElementById('purchase-items-body');
    const tr = document.createElement('tr');
    tr.className = 'item-row';
    tr.innerHTML = `
      <td>
        <select class="form-control prod-select" onchange="PurchasesView.onProductChange(this)" required>
          <option value="">Select product...</option>
          ${productsOpts}
        </select>
      </td>
      <td><input type="number" min="1" step="1" value="1" class="form-control qty-input" oninput="PurchasesView.recalcPurchaseTotals()" required></td>
      <td><input type="number" step="0.01" value="0.00" class="form-control rate-input" oninput="PurchasesView.recalcPurchaseTotals()" required></td>
      <td><input type="number" step="0.01" value="5" class="form-control tax-input" oninput="PurchasesView.recalcPurchaseTotals()"></td>
      <td class="text-right font-semibold line-amount">AED 0.00</td>
      <td class="text-center"><button type="button" class="btn btn-secondary btn-sm" onclick="PurchasesView.removeRow(this)">✕</button></td>
    `;
    tbody.appendChild(tr);
  },

  removeRow(btn) {
    const tbody = document.getElementById('purchase-items-body');
    if (tbody.querySelectorAll('.item-row').length > 1) {
      btn.closest('tr').remove();
      this.recalcPurchaseTotals();
    } else {
      Toast.info('At least one item row is required.');
    }
  },

  onProductChange(select) {
    const opt = select.options[select.selectedIndex];
    const cost = opt.dataset.cost || 0;
    const tax = opt.dataset.tax || 5;
    const row = select.closest('tr');
    row.querySelector('.rate-input').value = cost;
    row.querySelector('.tax-input').value = tax;
    this.recalcPurchaseTotals();
  },

  recalcPurchaseTotals() {
    const rows = document.querySelectorAll('#purchase-items-body .item-row');
    let subtotal = 0;
    let totalTax = 0;

    rows.forEach(r => {
      const qty = Number(r.querySelector('.qty-input')?.value) || 0;
      const rate = Number(r.querySelector('.rate-input')?.value) || 0;
      const taxRate = Number(r.querySelector('.tax-input')?.value) || 0;

      const lineSub = qty * rate;
      const lineTax = (lineSub * taxRate) / 100;
      const lineTotal = lineSub + lineTax;

      subtotal += lineSub;
      totalTax += lineTax;

      const amtEl = r.querySelector('.line-amount');
      if (amtEl) amtEl.textContent = `AED ${lineTotal.toFixed(2)}`;
    });

    const grandTotal = subtotal + totalTax;

    const subEl = document.getElementById('purch-subtotal');
    const taxEl = document.getElementById('purch-tax');
    const grandEl = document.getElementById('purch-grand-total');

    if (subEl) subEl.textContent = `AED ${subtotal.toFixed(2)}`;
    if (taxEl) taxEl.textContent = `AED ${totalTax.toFixed(2)}`;
    if (grandEl) grandEl.textContent = `AED ${grandTotal.toFixed(2)}`;
  },

  async savePurchase(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const supplier_id = formData.get('supplier_id');
    const purchase_date = formData.get('purchase_date');
    const reference_number = formData.get('reference_number');
    const payment_terms = formData.get('payment_terms');
    const paid_amount = Number(formData.get('paid_amount')) || 0;
    const payment_method = formData.get('payment_method');
    const notes = formData.get('notes');

    const items = [];
    const rows = document.querySelectorAll('#purchase-items-body .item-row');
    rows.forEach(r => {
      const prodId = r.querySelector('.prod-select')?.value;
      const qty = Number(r.querySelector('.qty-input')?.value) || 1;
      const rate = Number(r.querySelector('.rate-input')?.value) || 0;
      const tax_rate = Number(r.querySelector('.tax-input')?.value) || 0;

      if (prodId) {
        items.push({
          product_id: Number(prodId),
          quantity: qty,
          rate,
          tax_rate,
          discount: 0
        });
      }
    });

    if (!items.length) {
      Toast.error('Please select at least one valid product item.');
      return;
    }

    try {
      await API.post('/purchases', {
        supplier_id: Number(supplier_id),
        purchase_date,
        reference_number,
        payment_terms,
        items,
        paid_amount,
        payment_method,
        notes
      });

      Toast.success('Purchase order created & stock incremented successfully');
      Modal.close();
      this.render();
    } catch (e) {}
  },

  async viewPurchase(id) {
    try {
      const res = await API.get(`/purchases/${id}`);
      const p = res.data;
      const business = p.business || State.business;
      const currency = business.currency || 'AED';

      const itemsRows = (p.items || []).map((it, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${it.product_name}</strong><div style="font-size:11px; color:#64748b;">SKU: ${it.product_sku}</div></td>
          <td class="text-center">${it.quantity} ${it.product_unit}</td>
          <td class="text-right">${Utils.formatCurrency(it.rate, currency)}</td>
          <td class="text-center">${it.tax_rate}%</td>
          <td class="text-right font-semibold">${Utils.formatCurrency(it.amount, currency)}</td>
        </tr>
      `).join('');

      Modal.open({
        title: `Purchase Order: ${p.purchase_number}`,
        size: 'lg',
        bodyHtml: `
          <div class="printable-document" id="printable-purchase-doc">
            <div class="doc-header">
              <div>
                <div class="doc-logo-title">${business.name}</div>
                <div style="font-size:12px; color:#475569; margin-top:4px;">
                  ${business.address || 'Dubai, UAE'}<br>
                  TRN / Tax #: ${business.tax_number || '100293847500003'}<br>
                  Phone: ${business.phone || '+971 4 398 2200'}
                </div>
              </div>
              <div class="text-right">
                <div class="doc-type-title">PURCHASE ORDER</div>
                <div style="font-size:14px; font-weight:700; color:#2563eb; margin-top:4px;">${p.purchase_number}</div>
                <div style="font-size:12px; color:#475569; margin-top:2px;">Date: ${Utils.formatDate(p.purchase_date)}</div>
                <div style="font-size:12px; color:#475569;">Terms: ${p.payment_terms || 'Due on Receipt'}</div>
              </div>
            </div>

            <div class="doc-meta-grid">
              <div class="doc-party-box">
                <h4>Vendor / Supplier</h4>
                <div class="doc-party-name">${p.supplier_name}</div>
                <div class="doc-party-details">
                  ${p.supplier_company ? `${p.supplier_company}<br>` : ''}
                  ${p.supplier_address || ''}<br>
                  TRN / Tax #: ${p.supplier_tax || 'N/A'}<br>
                  Email: ${p.supplier_email || 'N/A'} • Phone: ${p.supplier_phone || 'N/A'}
                </div>
              </div>
              <div class="doc-party-box text-right">
                <h4>Status & References</h4>
                <div style="margin-top:4px;">Order Status: ${Utils.renderStatusBadge(p.status)}</div>
                <div style="margin-top:4px;">Payment: ${Utils.renderStatusBadge(p.payment_status)}</div>
                ${p.reference_number ? `<div style="font-size:12px; color:#64748b; margin-top:4px;">Vendor Ref: <strong>${p.reference_number}</strong></div>` : ''}
              </div>
            </div>

            <table class="doc-table">
              <thead>
                <tr>
                  <th style="width:5%;">#</th>
                  <th style="width:45%;">Item & Description</th>
                  <th style="width:12%;" class="text-center">Qty</th>
                  <th style="width:15%;" class="text-right">Unit Rate</th>
                  <th style="width:10%;" class="text-center">Tax</th>
                  <th style="width:18%;" class="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>

            <div class="doc-totals-box">
              <div class="doc-totals-row"><span>Subtotal:</span><span>${Utils.formatCurrency(p.subtotal, currency)}</span></div>
              <div class="doc-totals-row"><span>Tax (VAT):</span><span>${Utils.formatCurrency(p.tax, currency)}</span></div>
              <div class="doc-totals-row grand-total"><span>Grand Total:</span><span>${Utils.formatCurrency(p.total, currency)}</span></div>
              <div class="doc-totals-row"><span>Amount Paid:</span><span style="color:#16a34a;">${Utils.formatCurrency(p.paid_amount, currency)}</span></div>
              <div class="doc-totals-row font-semibold"><span>Balance Due:</span><span style="color:${p.balance > 0 ? '#dc2626' : '#16a34a'};">${Utils.formatCurrency(p.balance, currency)}</span></div>
            </div>

            ${p.notes ? `
              <div class="doc-footer-notes">
                <strong>Notes:</strong> ${p.notes}
              </div>
            ` : ''}
          </div>
        `,
        footerHtml: `
          <button class="btn btn-secondary btn-sm" onclick="Modal.close()">Close</button>
          <button class="btn btn-primary btn-sm" onclick="Utils.printDocument('printable-purchase-doc')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            <span>Print Order</span>
          </button>
        `
      });
    } catch (e) {}
  },

  async cancelPurchase(id) {
    if (!confirm('Are you sure you want to cancel this purchase order? Received stock will be reversed and supplier balance updated.')) return;
    try {
      await API.post(`/purchases/${id}/cancel`);
      Toast.success('Purchase cancelled and stock reversed');
      this.render();
    } catch (e) {}
  }
};

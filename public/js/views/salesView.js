/**
 * Ledgerly Sales / Invoices Module
 */
const SalesView = {
  sales: [],
  summary: {},
  customers: [],
  products: [],
  search: '',
  selectedPaymentStatus: 'All',
  limit: 50,
  offset: 0,
  total: 0,

  async render() {
    Topbar.updateTitle('Sales & Invoices', [{ label: 'Sales' }]);
    const contentEl = document.getElementById('app-content');

    contentEl.innerHTML = `
      <div class="content-container">
        <div style="display:flex; justify-content:center; padding: 40px; color:var(--text-muted);">
          Loading sales invoices...
        </div>
      </div>
    `;

    try {
      const [sumRes, salesRes, custRes, prodRes] = await Promise.all([
        API.get('/sales/summary'),
        API.get('/sales', {
          search: this.search,
          payment_status: this.selectedPaymentStatus === 'All' ? '' : this.selectedPaymentStatus,
          limit: this.limit,
          offset: this.offset
        }),
        API.get('/customers'),
        API.get('/products')
      ]);

      this.summary = sumRes.data || {};
      this.sales = salesRes.data || [];
      this.total = salesRes.pagination?.total || 0;
      this.customers = custRes.data || [];
      this.products = prodRes.data || [];

      this.renderContent();
    } catch (e) {
      contentEl.innerHTML = `<div class="card" style="padding: 24px; color:var(--danger);">Error loading sales: ${e.message}</div>`;
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
            <h1 style="font-size:20px; font-weight:700; color:var(--text-primary);">Sales & Invoices</h1>
            <p style="font-size:13px; color:var(--text-secondary);">Manage customer invoices, track collections, and monitor receivables.</p>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="SalesView.exportCSV()">Export CSV</button>
            <button class="btn btn-primary btn-sm" onclick="SalesView.openNewSaleModal()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>+ New Sale</span>
            </button>
          </div>
        </div>

        <!-- KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-title">Total Sales</span>
            <div class="kpi-value">${Utils.formatCurrency(this.summary.total_sales || 0, currency)}</div>
            <div class="kpi-trend"><span class="text-muted">${this.summary.total_invoices || 0} total invoices</span></div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">Total Collected</span>
            <div class="kpi-value" style="color:var(--success);">${Utils.formatCurrency(this.summary.total_paid || 0, currency)}</div>
            <div class="kpi-trend"><span class="text-muted">${this.summary.paid_count || 0} fully paid</span></div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">Pending Receivables</span>
            <div class="kpi-value" style="color:var(--warning);">${Utils.formatCurrency(this.summary.total_outstanding || 0, currency)}</div>
            <div class="kpi-trend"><span class="text-muted">${(this.summary.pending_count || 0) + (this.summary.partial_count || 0)} awaiting payment</span></div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">Overdue Invoices</span>
            <div class="kpi-value" style="color:var(--danger);">${this.summary.overdue_count || 0}</div>
            <div class="kpi-trend"><span class="text-muted">Requires follow-up</span></div>
          </div>
        </div>

        <!-- Filter Bar -->
        ${FilterBar.render({
          searchPlaceholder: 'Search invoice #, customer, reference...',
          searchValue: this.search,
          onSearch: 'SalesView.onSearch(this.value)',
          showDateFilter: false,
          statusOptions: [
            { value: 'All', label: 'All Payment Statuses' },
            { value: 'Paid', label: '🟢 Paid' },
            { value: 'Pending', label: '🟡 Pending' },
            { value: 'Partially Paid', label: '🟠 Partially Paid' },
            { value: 'Overdue', label: '🔴 Overdue' },
            { value: 'Draft', label: '⚪ Draft' }
          ],
          selectedStatus: this.selectedPaymentStatus,
          onStatusChange: 'SalesView.onStatusFilter(this.value)',
          showExport: false
        })}

        <!-- Sales Table -->
        ${Table.render({
          columns: [
            { label: 'Invoice #', key: 'invoice_number', render: (val, r) => `<strong style="color:var(--primary); cursor:pointer;" onclick="SalesView.viewSale(${r.id})">${val}</strong>` },
            { label: 'Date', key: 'invoice_date', render: (val) => Utils.formatDate(val) },
            { label: 'Customer', key: 'customer_name', render: (val, r) => `<div><strong>${val}</strong>${r.customer_company ? `<div style="font-size:11px; color:var(--text-muted);">${r.customer_company}</div>` : ''}</div>` },
            { label: 'Due Date', key: 'due_date', render: (val) => Utils.formatDate(val) },
            { label: 'Amount', key: 'total', align: 'right', render: (val) => `<span class="font-semibold">${Utils.formatCurrency(val, currency)}</span>` },
            { label: 'Paid', key: 'paid_amount', align: 'right', render: (val) => Utils.formatCurrency(val, currency) },
            { label: 'Balance', key: 'balance', align: 'right', render: (val) => `<span style="color:${val > 0 ? 'var(--danger)' : 'var(--text-secondary)'};">${Utils.formatCurrency(val, currency)}</span>` },
            { label: 'Status', key: 'payment_status', render: (val) => Utils.renderStatusBadge(val) },
            {
              label: 'Actions',
              key: 'id',
              align: 'right',
              render: (val, r) => `
                <div class="table-actions">
                  <button class="btn btn-secondary btn-sm" onclick="SalesView.viewSale(${r.id})">View</button>
                  ${r.balance > 0 ? `<button class="btn btn-outline btn-sm" onclick="SalesView.quickRecordPayment(${r.id}, ${r.customer_id}, ${r.balance}, '${r.invoice_number}')">Pay</button>` : ''}
                  ${r.status !== 'Void' ? `<button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="SalesView.voidSale(${r.id}, '${r.invoice_number}')" title="Void Invoice">Void</button>` : ''}
                </div>
              `
            }
          ],
          data: this.sales,
          emptyTitle: 'No invoices found',
          emptyMessage: 'Create your first sales invoice to bill customers and manage receivables.',
          emptyActionLabel: '+ New Sale',
          onEmptyAction: 'SalesView.openNewSaleModal()',
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
    SalesView.search = val;
    SalesView.offset = 0;
    SalesView.render();
  }, 250),

  onStatusFilter(val) {
    this.selectedPaymentStatus = val;
    this.offset = 0;
    this.render();
  },

  exportCSV() {
    Utils.exportToCSV('sales_invoices', this.sales.map(s => ({
      InvoiceNumber: s.invoice_number,
      Date: s.invoice_date,
      DueDate: s.due_date,
      Customer: s.customer_name,
      Reference: s.reference_number || '',
      Total: s.total,
      Paid: s.paid_amount,
      Balance: s.balance,
      PaymentStatus: s.payment_status,
      Status: s.status
    })));
  },

  openNewSaleModal(prefilledCustomerId = null) {
    const customersOpts = this.customers.map(c => `
      <option value="${c.id}" ${c.id === prefilledCustomerId ? 'selected' : ''}>${c.name} (${c.company_name || 'Individual'})</option>
    `).join('');

    const productsOpts = this.products.map(p => `
      <option value="${p.id}" data-price="${p.selling_price}" data-tax="${p.tax_rate}" data-stock="${p.current_stock}">${p.name} (SKU: ${p.sku} • AED ${p.selling_price} • ${p.current_stock} in stock)</option>
    `).join('');

    Modal.open({
      title: 'New Sales Invoice',
      size: 'lg',
      bodyHtml: `
        <form id="new-sale-form" onsubmit="SalesView.saveSale(event)">
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Customer <span class="required">*</span></label>
              <select name="customer_id" class="form-control" required>
                <option value="">Select a customer...</option>
                ${customersOpts}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Invoice Date <span class="required">*</span></label>
              <input type="date" name="invoice_date" class="form-control" value="${Utils.todayISO()}" required>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Due Date <span class="required">*</span></label>
              <input type="date" name="due_date" class="form-control" value="${Utils.futureDateISO(15)}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Customer Order / Ref #</label>
              <input type="text" name="reference_number" class="form-control" placeholder="e.g. PO-CUST-104">
            </div>
          </div>

          <!-- Dynamic Line Items -->
          <div style="margin: 16px 0;">
            <label class="form-label" style="font-weight:600;">Invoice Line Items</label>
            <table class="line-items-table" id="sale-line-items">
              <thead>
                <tr>
                  <th style="width:35%;">Product / Service</th>
                  <th style="width:12%;">Qty</th>
                  <th style="width:18%;">Unit Rate</th>
                  <th style="width:12%;">Discount</th>
                  <th style="width:10%;">Tax %</th>
                  <th style="width:13%;">Amount</th>
                  <th style="width:5%;"></th>
                </tr>
              </thead>
              <tbody id="sale-items-body">
                <tr class="item-row">
                  <td>
                    <select class="form-control prod-select" onchange="SalesView.onProductChange(this)" required>
                      <option value="">Select product...</option>
                      ${productsOpts}
                    </select>
                  </td>
                  <td><input type="number" min="1" step="1" value="1" class="form-control qty-input" oninput="SalesView.recalcSaleTotals()" required></td>
                  <td><input type="number" step="0.01" value="0.00" class="form-control rate-input" oninput="SalesView.recalcSaleTotals()" required></td>
                  <td><input type="number" step="0.01" value="0.00" class="form-control disc-input" oninput="SalesView.recalcSaleTotals()"></td>
                  <td><input type="number" step="0.01" value="5" class="form-control tax-input" oninput="SalesView.recalcSaleTotals()"></td>
                  <td class="text-right font-semibold line-amount">AED 0.00</td>
                  <td class="text-center"><button type="button" class="btn btn-secondary btn-sm" onclick="SalesView.removeRow(this)">✕</button></td>
                </tr>
              </tbody>
            </table>
            <button type="button" class="btn btn-secondary btn-sm" onclick="SalesView.addRow()">+ Add Line Item</button>
          </div>

          <!-- Summary Box -->
          <div class="calculation-summary-box">
            <div class="calc-row"><span>Subtotal:</span><span id="sale-subtotal">AED 0.00</span></div>
            <div class="calc-row"><span>Discount:</span><span id="sale-discount">AED 0.00</span></div>
            <div class="calc-row"><span>Tax (VAT 5%):</span><span id="sale-tax">AED 0.00</span></div>
            <div class="calc-row total"><span>Grand Total:</span><span id="sale-grand-total">AED 0.00</span></div>
          </div>

          <!-- Initial Payment Entry -->
          <div class="form-grid-2" style="margin-top: 16px;">
            <div class="form-group">
              <label class="form-label">Payment Received Now (Optional)</label>
              <input type="number" step="0.01" name="paid_amount" class="form-control" placeholder="0.00" value="0">
            </div>
            <div class="form-group">
              <label class="form-label">Payment Method</label>
              <select name="payment_method" class="form-control">
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Card">Credit/Debit Card</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Customer Notes</label>
              <textarea name="notes" class="form-control">Thank you for your business. Please make payments via bank transfer.</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Terms & Conditions</label>
              <textarea name="terms" class="form-control">Payment is due within invoice terms. Goods covered by standard warranty.</textarea>
            </div>
          </div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-secondary btn-sm" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="document.getElementById('new-sale-form').requestSubmit()">Save Invoice</button>
      `
    });

    this.recalcSaleTotals();
  },

  addRow() {
    const productsOpts = this.products.map(p => `
      <option value="${p.id}" data-price="${p.selling_price}" data-tax="${p.tax_rate}" data-stock="${p.current_stock}">${p.name} (AED ${p.selling_price})</option>
    `).join('');
    const tbody = document.getElementById('sale-items-body');
    const tr = document.createElement('tr');
    tr.className = 'item-row';
    tr.innerHTML = `
      <td>
        <select class="form-control prod-select" onchange="SalesView.onProductChange(this)" required>
          <option value="">Select product...</option>
          ${productsOpts}
        </select>
      </td>
      <td><input type="number" min="1" step="1" value="1" class="form-control qty-input" oninput="SalesView.recalcSaleTotals()" required></td>
      <td><input type="number" step="0.01" value="0.00" class="form-control rate-input" oninput="SalesView.recalcSaleTotals()" required></td>
      <td><input type="number" step="0.01" value="0.00" class="form-control disc-input" oninput="SalesView.recalcSaleTotals()"></td>
      <td><input type="number" step="0.01" value="5" class="form-control tax-input" oninput="SalesView.recalcSaleTotals()"></td>
      <td class="text-right font-semibold line-amount">AED 0.00</td>
      <td class="text-center"><button type="button" class="btn btn-secondary btn-sm" onclick="SalesView.removeRow(this)">✕</button></td>
    `;
    tbody.appendChild(tr);
  },

  removeRow(btn) {
    const tbody = document.getElementById('sale-items-body');
    if (tbody.querySelectorAll('.item-row').length > 1) {
      btn.closest('tr').remove();
      this.recalcSaleTotals();
    } else {
      Toast.info('At least one item row is required.');
    }
  },

  onProductChange(select) {
    const opt = select.options[select.selectedIndex];
    const price = opt.dataset.price || 0;
    const tax = opt.dataset.tax || 5;
    const row = select.closest('tr');
    row.querySelector('.rate-input').value = price;
    row.querySelector('.tax-input').value = tax;
    this.recalcSaleTotals();
  },

  recalcSaleTotals() {
    const rows = document.querySelectorAll('#sale-items-body .item-row');
    let subtotal = 0;
    let totalDisc = 0;
    let totalTax = 0;

    rows.forEach(r => {
      const qty = Number(r.querySelector('.qty-input')?.value) || 0;
      const rate = Number(r.querySelector('.rate-input')?.value) || 0;
      const disc = Number(r.querySelector('.disc-input')?.value) || 0;
      const taxRate = Number(r.querySelector('.tax-input')?.value) || 0;

      const lineSub = qty * rate;
      const lineTaxable = Math.max(0, lineSub - disc);
      const lineTax = (lineTaxable * taxRate) / 100;
      const lineTotal = lineTaxable + lineTax;

      subtotal += lineSub;
      totalDisc += disc;
      totalTax += lineTax;

      const amtEl = r.querySelector('.line-amount');
      if (amtEl) amtEl.textContent = `AED ${lineTotal.toFixed(2)}`;
    });

    const grandTotal = subtotal - totalDisc + totalTax;

    const subEl = document.getElementById('sale-subtotal');
    const discEl = document.getElementById('sale-discount');
    const taxEl = document.getElementById('sale-tax');
    const grandEl = document.getElementById('sale-grand-total');

    if (subEl) subEl.textContent = `AED ${subtotal.toFixed(2)}`;
    if (discEl) discEl.textContent = `AED ${totalDisc.toFixed(2)}`;
    if (taxEl) taxEl.textContent = `AED ${totalTax.toFixed(2)}`;
    if (grandEl) grandEl.textContent = `AED ${grandTotal.toFixed(2)}`;
  },

  async saveSale(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const customer_id = formData.get('customer_id');
    const invoice_date = formData.get('invoice_date');
    const due_date = formData.get('due_date');
    const reference_number = formData.get('reference_number');
    const paid_amount = Number(formData.get('paid_amount')) || 0;
    const payment_method = formData.get('payment_method');
    const notes = formData.get('notes');
    const terms = formData.get('terms');

    const items = [];
    const rows = document.querySelectorAll('#sale-items-body .item-row');
    rows.forEach(r => {
      const prodId = r.querySelector('.prod-select')?.value;
      const qty = Number(r.querySelector('.qty-input')?.value) || 1;
      const rate = Number(r.querySelector('.rate-input')?.value) || 0;
      const disc = Number(r.querySelector('.disc-input')?.value) || 0;
      const tax_rate = Number(r.querySelector('.tax-input')?.value) || 0;

      if (prodId) {
        items.push({
          product_id: Number(prodId),
          quantity: qty,
          rate,
          discount: disc,
          tax_rate
        });
      }
    });

    if (!items.length) {
      Toast.error('Please select at least one valid product line.');
      return;
    }

    try {
      const res = await API.post('/sales', {
        customer_id: Number(customer_id),
        invoice_date,
        due_date,
        reference_number,
        items,
        paid_amount,
        payment_method,
        notes,
        terms
      });

      Toast.success(res.message);
      Modal.close();
      this.render();
      if (res.data?.id) {
        this.viewSale(res.data.id);
      }
    } catch (e) {}
  },

  async viewSale(id) {
    try {
      const res = await API.get(`/sales/${id}`);
      const s = res.data;
      const business = s.business || State.business;
      const currency = business.currency || 'AED';

      const itemsRows = (s.items || []).map((it, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${it.product_name}</strong><div style="font-size:11px; color:#64748b;">SKU: ${it.product_sku}</div></td>
          <td class="text-center">${it.quantity} ${it.product_unit}</td>
          <td class="text-right">${Utils.formatCurrency(it.rate, currency)}</td>
          <td class="text-right">${it.discount > 0 ? Utils.formatCurrency(it.discount, currency) : '—'}</td>
          <td class="text-center">${it.tax_rate}%</td>
          <td class="text-right font-semibold">${Utils.formatCurrency(it.amount, currency)}</td>
        </tr>
      `).join('');

      const paymentsHistory = (s.payments || []).map(p => `
        <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #e2e8f0; font-size:12px;">
          <div>${p.payment_number} (${Utils.formatDate(p.payment_date)}) via ${p.payment_method}</div>
          <div style="font-weight:600; color:#16a34a;">${Utils.formatCurrency(p.amount, currency)}</div>
        </div>
      `).join('');

      Modal.open({
        title: `Tax Invoice: ${s.invoice_number}`,
        size: 'lg',
        bodyHtml: `
          <div class="printable-document" id="printable-invoice-doc">
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
                <div class="doc-type-title">TAX INVOICE</div>
                <div style="font-size:14px; font-weight:700; color:#2563eb; margin-top:4px;">${s.invoice_number}</div>
                <div style="font-size:12px; color:#475569; margin-top:2px;">Invoice Date: ${Utils.formatDate(s.invoice_date)}</div>
                <div style="font-size:12px; color:#475569;">Due Date: ${Utils.formatDate(s.due_date)}</div>
              </div>
            </div>

            <div class="doc-meta-grid">
              <div class="doc-party-box">
                <h4>Bill To (Customer)</h4>
                <div class="doc-party-name">${s.customer_name}</div>
                <div class="doc-party-details">
                  ${s.customer_company ? `${s.customer_company}<br>` : ''}
                  ${s.customer_address || ''}<br>
                  TRN / Tax #: ${s.customer_tax || 'N/A'}<br>
                  Email: ${s.customer_email || 'N/A'} • Phone: ${s.customer_phone || 'N/A'}
                </div>
              </div>
              <div class="doc-party-box text-right">
                <h4>Payment Status</h4>
                <div style="margin-top:4px;">${Utils.renderStatusBadge(s.payment_status)}</div>
                ${s.reference_number ? `<div style="font-size:12px; color:#64748b; margin-top:4px;">Customer PO: <strong>${s.reference_number}</strong></div>` : ''}
              </div>
            </div>

            <table class="doc-table">
              <thead>
                <tr>
                  <th style="width:5%;">#</th>
                  <th style="width:40%;">Item Description</th>
                  <th style="width:10%;" class="text-center">Qty</th>
                  <th style="width:13%;" class="text-right">Rate</th>
                  <th style="width:12%;" class="text-right">Discount</th>
                  <th style="width:8%;" class="text-center">Tax</th>
                  <th style="width:15%;" class="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>

            <div class="doc-totals-box">
              <div class="doc-totals-row"><span>Subtotal:</span><span>${Utils.formatCurrency(s.subtotal, currency)}</span></div>
              ${s.discount > 0 ? `<div class="doc-totals-row"><span>Discount:</span><span style="color:#16a34a;">-${Utils.formatCurrency(s.discount, currency)}</span></div>` : ''}
              <div class="doc-totals-row"><span>Tax (VAT 5%):</span><span>${Utils.formatCurrency(s.tax, currency)}</span></div>
              <div class="doc-totals-row grand-total"><span>Total Amount:</span><span>${Utils.formatCurrency(s.total, currency)}</span></div>
              <div class="doc-totals-row"><span>Amount Paid:</span><span style="color:#16a34a;">${Utils.formatCurrency(s.paid_amount, currency)}</span></div>
              <div class="doc-totals-row font-semibold"><span>Balance Due:</span><span style="color:${s.balance > 0 ? '#dc2626' : '#16a34a'};">${Utils.formatCurrency(s.balance, currency)}</span></div>
            </div>

            ${s.payments && s.payments.length ? `
              <div style="margin: 20px 0; background:#f8fafc; padding:12px 16px; border-radius:6px; border:1px solid #e2e8f0;">
                <div style="font-size:12px; font-weight:700; text-transform:uppercase; color:#475569; margin-bottom:6px;">Payment History</div>
                ${paymentsHistory}
              </div>
            ` : ''}

            <div class="doc-footer-notes">
              ${s.notes ? `<div><strong>Notes:</strong> ${s.notes}</div>` : ''}
              ${s.terms ? `<div style="margin-top:4px;"><strong>Terms:</strong> ${s.terms}</div>` : ''}
            </div>
          </div>
        `,
        footerHtml: `
          <button class="btn btn-secondary btn-sm" onclick="Modal.close()">Close</button>
          ${s.balance > 0 ? `
            <button class="btn btn-outline btn-sm" onclick="SalesView.quickRecordPayment(${s.id}, ${s.customer_id}, ${s.balance}, '${s.invoice_number}')">Record Payment</button>
          ` : ''}
          <button class="btn btn-primary btn-sm" onclick="Utils.printDocument('printable-invoice-doc')">Print Invoice</button>
        `
      });
    } catch (e) {}
  },

  quickRecordPayment(saleId, customerId, balance, invoiceNumber) {
    Modal.close();
    PaymentsView.openRecordPaymentModal({ saleId, customerId, balance, invoiceNumber });
  },

  async voidSale(id, invoiceNumber) {
    if (!confirm(`Are you sure you want to void invoice ${invoiceNumber}? Stock will be restored and customer outstanding balance reduced.`)) return;
    try {
      await API.post(`/sales/${id}/void`);
      Toast.success(`Invoice ${invoiceNumber} voided successfully`);
      this.render();
    } catch (e) {}
  }
};

/**
 * Ledgerly Quotations Module
 */
const QuotationsView = {
  quotations: [],
  summary: {},
  customers: [],
  products: [],
  search: '',
  selectedStatus: 'All',
  limit: 50,
  offset: 0,
  total: 0,

  async render() {
    Topbar.updateTitle('Quotations', [{ label: 'Quotations' }]);
    const contentEl = document.getElementById('app-content');

    contentEl.innerHTML = `
      <div class="content-container">
        <div style="display:flex; justify-content:center; padding: 40px; color:var(--text-muted);">
          Loading quotations...
        </div>
      </div>
    `;

    try {
      const [sumRes, quoRes, custRes, prodRes] = await Promise.all([
        API.get('/quotations/summary'),
        API.get('/quotations', {
          search: this.search,
          status: this.selectedStatus === 'All' ? '' : this.selectedStatus,
          limit: this.limit,
          offset: this.offset
        }),
        API.get('/customers'),
        API.get('/products')
      ]);

      this.summary = sumRes.data || {};
      this.quotations = quoRes.data || [];
      this.total = quoRes.pagination?.total || 0;
      this.customers = custRes.data || [];
      this.products = prodRes.data || [];

      this.renderContent();
    } catch (e) {
      contentEl.innerHTML = `<div class="card" style="padding: 24px; color:var(--danger);">Error loading quotations: ${e.message}</div>`;
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
            <h1 style="font-size:20px; font-weight:700; color:var(--text-primary);">Quotations</h1>
            <p style="font-size:13px; color:var(--text-secondary);">Send estimates and quotes to potential clients and convert them to invoices with 1-click.</p>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="QuotationsView.exportCSV()">Export CSV</button>
            <button class="btn btn-primary btn-sm" onclick="QuotationsView.openNewQuotationModal()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>+ New Quotation</span>
            </button>
          </div>
        </div>

        <!-- KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-title">Total Estimates</span>
            <div class="kpi-value">${Utils.formatCurrency(this.summary.total_amount || 0, currency)}</div>
            <div class="kpi-trend"><span class="text-muted">${this.summary.total_count || 0} total quotations</span></div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">Sent & Accepted</span>
            <div class="kpi-value" style="color:var(--primary);">${(this.summary.sent_count || 0) + (this.summary.accepted_count || 0)}</div>
            <div class="kpi-trend"><span class="text-muted">Awaiting client decision</span></div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">Converted to Sales</span>
            <div class="kpi-value" style="color:var(--success);">${this.summary.converted_count || 0}</div>
            <div class="kpi-trend"><span class="text-muted">Turned into revenue invoices</span></div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">Drafts</span>
            <div class="kpi-value">${this.summary.draft_count || 0}</div>
            <div class="kpi-trend"><span class="text-muted">Work in progress</span></div>
          </div>
        </div>

        <!-- Filter Bar -->
        ${FilterBar.render({
          searchPlaceholder: 'Search quote #, customer, reference...',
          searchValue: this.search,
          onSearch: 'QuotationsView.onSearch(this.value)',
          showDateFilter: false,
          statusOptions: [
            { value: 'All', label: 'All Statuses' },
            { value: 'Draft', label: 'Draft' },
            { value: 'Sent', label: 'Sent' },
            { value: 'Accepted', label: 'Accepted' },
            { value: 'Converted', label: 'Converted' },
            { value: 'Expired', label: 'Expired' }
          ],
          selectedStatus: this.selectedStatus,
          onStatusChange: 'QuotationsView.onStatusFilter(this.value)',
          showExport: false
        })}

        <!-- Quotations Table -->
        ${Table.render({
          columns: [
            { label: 'Quote #', key: 'quotation_number', render: (val, r) => `<strong style="color:var(--primary); cursor:pointer;" onclick="QuotationsView.viewQuotation(${r.id})">${val}</strong>` },
            { label: 'Date', key: 'quotation_date', render: (val) => Utils.formatDate(val) },
            { label: 'Customer', key: 'customer_name', render: (val, r) => `<div><strong>${val}</strong>${r.customer_company ? `<div style="font-size:11px; color:var(--text-muted);">${r.customer_company}</div>` : ''}</div>` },
            { label: 'Valid Until', key: 'valid_until', render: (val) => Utils.formatDate(val) },
            { label: 'Amount', key: 'total', align: 'right', render: (val) => `<span class="font-semibold">${Utils.formatCurrency(val, currency)}</span>` },
            { label: 'Status', key: 'status', render: (val) => Utils.renderStatusBadge(val) },
            {
              label: 'Actions',
              key: 'id',
              align: 'right',
              render: (val, r) => `
                <div class="table-actions">
                  <button class="btn btn-secondary btn-sm" onclick="QuotationsView.viewQuotation(${r.id})">View</button>
                  ${r.status !== 'Converted' ? `
                    <button class="btn btn-primary btn-sm" onclick="QuotationsView.convertToSale(${r.id})" title="Convert to Invoice">Convert to Sale</button>
                  ` : `<span class="badge badge-success">Converted</span>`}
                </div>
              `
            }
          ],
          data: this.quotations,
          emptyTitle: 'No quotations found',
          emptyMessage: 'Create your first quotation to pitch your products or services to clients.',
          emptyActionLabel: '+ New Quotation',
          onEmptyAction: 'QuotationsView.openNewQuotationModal()',
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
    QuotationsView.search = val;
    QuotationsView.offset = 0;
    QuotationsView.render();
  }, 250),

  onStatusFilter(val) {
    this.selectedStatus = val;
    this.offset = 0;
    this.render();
  },

  exportCSV() {
    Utils.exportToCSV('quotations', this.quotations.map(q => ({
      QuoteNumber: q.quotation_number,
      Date: q.quotation_date,
      Customer: q.customer_name,
      ValidUntil: q.valid_until,
      Reference: q.reference_number || '',
      Total: q.total,
      Status: q.status
    })));
  },

  openNewQuotationModal() {
    const customersOpts = this.customers.map(c => `<option value="${c.id}">${c.name} (${c.company_name || 'Individual'})</option>`).join('');
    const productsOpts = this.products.map(p => `<option value="${p.id}" data-price="${p.selling_price}" data-tax="${p.tax_rate}">${p.name} (AED ${p.selling_price})</option>`).join('');

    Modal.open({
      title: 'New Quotation / Estimate',
      size: 'lg',
      bodyHtml: `
        <form id="new-quote-form" onsubmit="QuotationsView.saveQuotation(event)">
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Customer <span class="required">*</span></label>
              <select name="customer_id" class="form-control" required>
                <option value="">Select a customer...</option>
                ${customersOpts}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Quotation Date <span class="required">*</span></label>
              <input type="date" name="quotation_date" class="form-control" value="${Utils.todayISO()}" required>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Valid Until Date <span class="required">*</span></label>
              <input type="date" name="valid_until" class="form-control" value="${Utils.futureDateISO(30)}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Reference Number (RFQ #)</label>
              <input type="text" name="reference_number" class="form-control" placeholder="e.g. RFQ-9901">
            </div>
          </div>

          <!-- Dynamic Line Items -->
          <div style="margin: 16px 0;">
            <label class="form-label" style="font-weight:600;">Products / Services</label>
            <table class="line-items-table" id="quote-line-items">
              <thead>
                <tr>
                  <th style="width:35%;">Product / Service</th>
                  <th style="width:15%;">Qty</th>
                  <th style="width:18%;">Unit Rate</th>
                  <th style="width:12%;">Tax %</th>
                  <th style="width:15%;">Amount</th>
                  <th style="width:5%;"></th>
                </tr>
              </thead>
              <tbody id="quote-items-body">
                <tr class="item-row">
                  <td>
                    <select class="form-control prod-select" onchange="QuotationsView.onProductChange(this)" required>
                      <option value="">Select product...</option>
                      ${productsOpts}
                    </select>
                  </td>
                  <td><input type="number" min="1" step="1" value="1" class="form-control qty-input" oninput="QuotationsView.recalcQuoteTotals()" required></td>
                  <td><input type="number" step="0.01" value="0.00" class="form-control rate-input" oninput="QuotationsView.recalcQuoteTotals()" required></td>
                  <td><input type="number" step="0.01" value="5" class="form-control tax-input" oninput="QuotationsView.recalcQuoteTotals()"></td>
                  <td class="text-right font-semibold line-amount">AED 0.00</td>
                  <td class="text-center"><button type="button" class="btn btn-secondary btn-sm" onclick="QuotationsView.removeRow(this)">✕</button></td>
                </tr>
              </tbody>
            </table>
            <button type="button" class="btn btn-secondary btn-sm" onclick="QuotationsView.addRow()">+ Add Line Item</button>
          </div>

          <!-- Summary Box -->
          <div class="calculation-summary-box">
            <div class="calc-row"><span>Subtotal:</span><span id="quo-subtotal">AED 0.00</span></div>
            <div class="calc-row"><span>Tax (VAT 5%):</span><span id="quo-tax">AED 0.00</span></div>
            <div class="calc-row total"><span>Quotation Total:</span><span id="quo-grand-total">AED 0.00</span></div>
          </div>

          <div class="form-grid-2" style="margin-top:16px;">
            <div class="form-group">
              <label class="form-label">Notes</label>
              <textarea name="notes" class="form-control">Valid for 30 days. Standard UAE warranty included.</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Terms & Conditions</label>
              <textarea name="terms" class="form-control">Payment 50% advance, 50% on delivery.</textarea>
            </div>
          </div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-secondary btn-sm" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="document.getElementById('new-quote-form').requestSubmit()">Save Quotation</button>
      `
    });

    this.recalcQuoteTotals();
  },

  addRow() {
    const productsOpts = this.products.map(p => `<option value="${p.id}" data-price="${p.selling_price}" data-tax="${p.tax_rate}">${p.name} (AED ${p.selling_price})</option>`).join('');
    const tbody = document.getElementById('quote-items-body');
    const tr = document.createElement('tr');
    tr.className = 'item-row';
    tr.innerHTML = `
      <td>
        <select class="form-control prod-select" onchange="QuotationsView.onProductChange(this)" required>
          <option value="">Select product...</option>
          ${productsOpts}
        </select>
      </td>
      <td><input type="number" min="1" step="1" value="1" class="form-control qty-input" oninput="QuotationsView.recalcQuoteTotals()" required></td>
      <td><input type="number" step="0.01" value="0.00" class="form-control rate-input" oninput="QuotationsView.recalcQuoteTotals()" required></td>
      <td><input type="number" step="0.01" value="5" class="form-control tax-input" oninput="QuotationsView.recalcQuoteTotals()"></td>
      <td class="text-right font-semibold line-amount">AED 0.00</td>
      <td class="text-center"><button type="button" class="btn btn-secondary btn-sm" onclick="QuotationsView.removeRow(this)">✕</button></td>
    `;
    tbody.appendChild(tr);
  },

  removeRow(btn) {
    const tbody = document.getElementById('quote-items-body');
    if (tbody.querySelectorAll('.item-row').length > 1) {
      btn.closest('tr').remove();
      this.recalcQuoteTotals();
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
    this.recalcQuoteTotals();
  },

  recalcQuoteTotals() {
    const rows = document.querySelectorAll('#quote-items-body .item-row');
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

    const subEl = document.getElementById('quo-subtotal');
    const taxEl = document.getElementById('quo-tax');
    const grandEl = document.getElementById('quo-grand-total');

    if (subEl) subEl.textContent = `AED ${subtotal.toFixed(2)}`;
    if (taxEl) taxEl.textContent = `AED ${totalTax.toFixed(2)}`;
    if (grandEl) grandEl.textContent = `AED ${grandTotal.toFixed(2)}`;
  },

  async saveQuotation(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const customer_id = formData.get('customer_id');
    const quotation_date = formData.get('quotation_date');
    const valid_until = formData.get('valid_until');
    const reference_number = formData.get('reference_number');
    const notes = formData.get('notes');
    const terms = formData.get('terms');

    const items = [];
    const rows = document.querySelectorAll('#quote-items-body .item-row');
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
      Toast.error('Please add at least one valid product line.');
      return;
    }

    try {
      await API.post('/quotations', {
        customer_id: Number(customer_id),
        quotation_date,
        valid_until,
        reference_number,
        items,
        notes,
        terms,
        status: 'Sent'
      });

      Toast.success('Quotation created successfully');
      Modal.close();
      this.render();
    } catch (e) {}
  },

  async convertToSale(quoteId) {
    if (!confirm('Convert this Quotation into a finalized Sales Invoice? This will deduct stock and update customer account balance.')) return;
    try {
      const res = await API.post(`/quotations/${quoteId}/convert`);
      Toast.success(res.message);
      this.render();
      if (res.data?.saleId) {
        SalesView.viewSale(res.data.saleId);
      }
    } catch (e) {}
  },

  async viewQuotation(id) {
    try {
      const res = await API.get(`/quotations/${id}`);
      const q = res.data;
      const business = q.business || State.business;
      const currency = business.currency || 'AED';

      const itemsRows = (q.items || []).map((it, idx) => `
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
        title: `Quotation: ${q.quotation_number}`,
        size: 'lg',
        bodyHtml: `
          <div class="printable-document" id="printable-quote-doc">
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
                <div class="doc-type-title">QUOTATION</div>
                <div style="font-size:14px; font-weight:700; color:#2563eb; margin-top:4px;">${q.quotation_number}</div>
                <div style="font-size:12px; color:#475569; margin-top:2px;">Date: ${Utils.formatDate(q.quotation_date)}</div>
                <div style="font-size:12px; color:#475569;">Valid Until: ${Utils.formatDate(q.valid_until)}</div>
              </div>
            </div>

            <div class="doc-meta-grid">
              <div class="doc-party-box">
                <h4>Quotation For</h4>
                <div class="doc-party-name">${q.customer_name}</div>
                <div class="doc-party-details">
                  ${q.customer_company ? `${q.customer_company}<br>` : ''}
                  ${q.customer_address || ''}<br>
                  TRN / Tax #: ${q.customer_tax || 'N/A'}<br>
                  Email: ${q.customer_email || 'N/A'} • Phone: ${q.customer_phone || 'N/A'}
                </div>
              </div>
              <div class="doc-party-box text-right">
                <h4>Quote Status</h4>
                <div style="margin-top:4px;">${Utils.renderStatusBadge(q.status)}</div>
                ${q.reference_number ? `<div style="font-size:12px; color:#64748b; margin-top:4px;">Ref #: <strong>${q.reference_number}</strong></div>` : ''}
              </div>
            </div>

            <table class="doc-table">
              <thead>
                <tr>
                  <th style="width:5%;">#</th>
                  <th style="width:45%;">Item Description</th>
                  <th style="width:12%;" class="text-center">Qty</th>
                  <th style="width:15%;" class="text-right">Rate</th>
                  <th style="width:10%;" class="text-center">Tax</th>
                  <th style="width:18%;" class="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>

            <div class="doc-totals-box">
              <div class="doc-totals-row"><span>Subtotal:</span><span>${Utils.formatCurrency(q.subtotal, currency)}</span></div>
              <div class="doc-totals-row"><span>Tax (VAT 5%):</span><span>${Utils.formatCurrency(q.tax, currency)}</span></div>
              <div class="doc-totals-row grand-total"><span>Total Estimate:</span><span>${Utils.formatCurrency(q.total, currency)}</span></div>
            </div>

            <div class="doc-footer-notes">
              ${q.notes ? `<div><strong>Notes:</strong> ${q.notes}</div>` : ''}
              ${q.terms ? `<div style="margin-top:4px;"><strong>Terms:</strong> ${q.terms}</div>` : ''}
            </div>
          </div>
        `,
        footerHtml: `
          <button class="btn btn-secondary btn-sm" onclick="Modal.close()">Close</button>
          ${q.status !== 'Converted' ? `
            <button class="btn btn-outline btn-sm" onclick="QuotationsView.convertToSale(${q.id})">Convert to Sale</button>
          ` : ''}
          <button class="btn btn-primary btn-sm" onclick="Utils.printDocument('printable-quote-doc')">Print Quotation</button>
        `
      });
    } catch (e) {}
  }
};

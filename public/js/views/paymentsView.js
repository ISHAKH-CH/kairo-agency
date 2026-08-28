/**
 * Ledgerly Payments Received Module
 */
const PaymentsView = {
  payments: [],
  summary: {},
  customers: [],
  search: '',
  selectedMethod: 'All',
  limit: 50,
  offset: 0,
  total: 0,

  async render() {
    Topbar.updateTitle('Payments Received', [{ label: 'Payments' }]);
    const contentEl = document.getElementById('app-content');

    contentEl.innerHTML = `
      <div class="content-container">
        <div style="display:flex; justify-content:center; padding: 40px; color:var(--text-muted);">
          Loading payment records...
        </div>
      </div>
    `;

    try {
      const [sumRes, payRes, custRes] = await Promise.all([
        API.get('/payments/summary'),
        API.get('/payments', {
          search: this.search,
          payment_method: this.selectedMethod === 'All' ? '' : this.selectedMethod,
          limit: this.limit,
          offset: this.offset
        }),
        API.get('/customers')
      ]);

      this.summary = sumRes.data || {};
      this.payments = payRes.data || [];
      this.total = payRes.pagination?.total || 0;
      this.customers = custRes.data || [];

      this.renderContent();
    } catch (e) {
      contentEl.innerHTML = `<div class="card" style="padding: 24px; color:var(--danger);">Error loading payments: ${e.message}</div>`;
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
            <h1 style="font-size:20px; font-weight:700; color:var(--text-primary);">Payments Received</h1>
            <p style="font-size:13px; color:var(--text-secondary);">Record and track collections from clients against open invoices.</p>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="PaymentsView.exportCSV()">Export CSV</button>
            <button class="btn btn-primary btn-sm" onclick="PaymentsView.openRecordPaymentModal()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>+ Record Payment</span>
            </button>
          </div>
        </div>

        <!-- KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-title">Total Received</span>
            <div class="kpi-value" style="color:var(--success);">${Utils.formatCurrency(this.summary.total_received || 0, currency)}</div>
            <div class="kpi-trend"><span class="text-muted">${this.summary.total_payments || 0} total receipts</span></div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">This Month Collections</span>
            <div class="kpi-value">${Utils.formatCurrency(this.summary.this_month_received || 0, currency)}</div>
            <div class="kpi-trend"><span class="text-muted">Current billing period</span></div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">Pending Receivables</span>
            <div class="kpi-value" style="color:var(--warning);">${Utils.formatCurrency(this.summary.pending_receivables || 0, currency)}</div>
            <div class="kpi-trend"><span class="text-muted">Awaiting receipt</span></div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">Overdue Receivables</span>
            <div class="kpi-value" style="color:var(--danger);">${Utils.formatCurrency(this.summary.overdue_receivables || 0, currency)}</div>
            <div class="kpi-trend"><span class="text-muted">Past invoice due dates</span></div>
          </div>
        </div>

        <!-- Filter Bar -->
        ${FilterBar.render({
          searchPlaceholder: 'Search payment #, customer, reference...',
          searchValue: this.search,
          onSearch: 'PaymentsView.onSearch(this.value)',
          showDateFilter: false,
          statusOptions: [
            { value: 'All', label: 'All Payment Methods' },
            { value: 'Bank Transfer', label: 'Bank Transfer' },
            { value: 'Card', label: 'Card' },
            { value: 'Cash', label: 'Cash' },
            { value: 'Cheque', label: 'Cheque' }
          ],
          selectedStatus: this.selectedMethod,
          onStatusChange: 'PaymentsView.onMethodFilter(this.value)',
          showExport: false
        })}

        <!-- Table -->
        ${Table.render({
          columns: [
            { label: 'Payment #', key: 'payment_number', render: (val, r) => `<strong style="color:var(--primary); cursor:pointer;" onclick="PaymentsView.viewPayment(${r.id})">${val}</strong>` },
            { label: 'Date', key: 'payment_date', render: (val) => Utils.formatDate(val) },
            { label: 'Customer', key: 'customer_name', render: (val, r) => `<div><strong>${val}</strong>${r.customer_company ? `<div style="font-size:11px; color:var(--text-muted);">${r.customer_company}</div>` : ''}</div>` },
            { label: 'Invoice #', key: 'invoice_number', render: (val) => val ? `<span class="badge badge-neutral">${val}</span>` : 'General Receipt' },
            { label: 'Payment Method', key: 'payment_method', render: (val) => `<span class="badge badge-info">${val}</span>` },
            { label: 'Amount Received', key: 'amount', align: 'right', render: (val) => `<strong style="color:var(--success); font-size:13.5px;">${Utils.formatCurrency(val, currency)}</strong>` },
            { label: 'Reference', key: 'reference_number', render: (val) => val || '—' },
            {
              label: 'Actions',
              key: 'id',
              align: 'right',
              render: (val, r) => `
                <div class="table-actions">
                  <button class="btn btn-secondary btn-sm" onclick="PaymentsView.viewPayment(${r.id})">Receipt</button>
                  <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="PaymentsView.deletePayment(${r.id}, '${r.payment_number}')" title="Delete">✕</button>
                </div>
              `
            }
          ],
          data: this.payments,
          emptyTitle: 'No payments recorded',
          emptyMessage: 'Record payment settlements against outstanding customer invoices.',
          emptyActionLabel: '+ Record Payment',
          onEmptyAction: 'PaymentsView.openRecordPaymentModal()',
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
    PaymentsView.search = val;
    PaymentsView.offset = 0;
    PaymentsView.render();
  }, 250),

  onMethodFilter(val) {
    this.selectedMethod = val;
    this.offset = 0;
    this.render();
  },

  exportCSV() {
    Utils.exportToCSV('payments_received', this.payments.map(p => ({
      PaymentNumber: p.payment_number,
      Date: p.payment_date,
      Customer: p.customer_name,
      Invoice: p.invoice_number || 'General',
      Method: p.payment_method,
      Amount: p.amount,
      Reference: p.reference_number || ''
    })));
  },

  async openRecordPaymentModal(prefill = {}) {
    const custOpts = this.customers.map(c => `
      <option value="${c.id}" ${prefill.customerId === c.id ? 'selected' : ''}>${c.name} (${c.company_name || 'Individual'})</option>
    `).join('');

    Modal.open({
      title: 'Record Payment Received',
      size: 'md',
      bodyHtml: `
        <form id="record-payment-form" onsubmit="PaymentsView.savePayment(event)">
          <div class="form-group">
            <label class="form-label">Customer <span class="required">*</span></label>
            <select name="customer_id" id="payment-customer-select" class="form-control" onchange="PaymentsView.onCustomerSelected(this.value)" required>
              <option value="">Select customer...</option>
              ${custOpts}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Apply to Invoice (Optional)</label>
            <select name="sale_id" id="payment-invoice-select" class="form-control" onchange="PaymentsView.onInvoiceSelected(this)">
              <option value="">General Customer Payment (Account credit)</option>
              ${prefill.saleId ? `<option value="${prefill.saleId}" data-bal="${prefill.balance}" selected>${prefill.invoiceNumber} — Outstanding AED ${prefill.balance}</option>` : ''}
            </select>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Payment Date <span class="required">*</span></label>
              <input type="date" name="payment_date" class="form-control" value="${Utils.todayISO()}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Amount Received <span class="required">*</span></label>
              <input type="number" step="0.01" name="amount" id="payment-amount-input" class="form-control" placeholder="0.00" value="${prefill.balance || ''}" required>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Payment Method <span class="required">*</span></label>
              <select name="payment_method" class="form-control" required>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Card">Credit/Debit Card</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Reference / Transaction ID</label>
              <input type="text" name="reference_number" class="form-control" placeholder="e.g. TXN-99823">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea name="notes" class="form-control" placeholder="Optional settlement remarks..."></textarea>
          </div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-secondary btn-sm" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="document.getElementById('record-payment-form').requestSubmit()">Save Payment</button>
      `
    });

    if (prefill.customerId && !prefill.saleId) {
      this.onCustomerSelected(prefill.customerId);
    }
  },

  async onCustomerSelected(customerId) {
    if (!customerId) return;
    try {
      const res = await API.get(`/customers/${customerId}`);
      const unpaidInvoices = (res.data?.sales || []).filter(s => s.balance > 0);
      const invoiceSelect = document.getElementById('payment-invoice-select');
      if (!invoiceSelect) return;

      let html = '<option value="">General Customer Payment (Account credit)</option>';
      unpaidInvoices.forEach(inv => {
        html += `<option value="${inv.id}" data-bal="${inv.balance}">${inv.invoice_number} (${Utils.formatDate(inv.invoice_date)}) — Bal: AED ${inv.balance}</option>`;
      });

      invoiceSelect.innerHTML = html;
    } catch (e) {}
  },

  onInvoiceSelected(select) {
    const opt = select.options[select.selectedIndex];
    const bal = opt.dataset.bal;
    if (bal) {
      const amtInput = document.getElementById('payment-amount-input');
      if (amtInput) amtInput.value = bal;
    }
  },

  async savePayment(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const body = Object.fromEntries(formData.entries());

    try {
      const res = await API.post('/payments', body);
      Toast.success(res.message);
      Modal.close();
      this.render();
      if (res.data?.id) {
        this.viewPayment(res.data.id);
      }
    } catch (e) {}
  },

  async viewPayment(id) {
    try {
      const res = await API.get(`/payments/${id}`);
      const p = res.data;
      const business = p.business || State.business;
      const currency = business.currency || 'AED';

      Modal.open({
        title: `Payment Receipt: ${p.payment_number}`,
        size: 'md',
        bodyHtml: `
          <div class="printable-document" id="printable-receipt-doc">
            <div class="doc-header">
              <div>
                <div class="doc-logo-title">${business.name}</div>
                <div style="font-size:12px; color:#475569; margin-top:4px;">
                  ${business.address || 'Dubai, UAE'}<br>
                  TRN / Tax #: ${business.tax_number || '100293847500003'}
                </div>
              </div>
              <div class="text-right">
                <div class="doc-type-title" style="color:#16a34a;">PAYMENT RECEIPT</div>
                <div style="font-size:14px; font-weight:700; color:#0f172a; margin-top:4px;">${p.payment_number}</div>
                <div style="font-size:12px; color:#475569;">Date: ${Utils.formatDate(p.payment_date)}</div>
              </div>
            </div>

            <div style="margin-bottom:24px; padding:16px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
              <div style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:600;">Received From</div>
              <div style="font-size:16px; font-weight:700; color:#0f172a; margin-top:2px;">${p.customer_name}</div>
              <div style="font-size:13px; color:#475569;">${p.customer_company || ''} • TRN: ${p.customer_tax || 'N/A'}</div>
            </div>

            <table class="doc-table">
              <thead>
                <tr>
                  <th>Description / Allocation</th>
                  <th class="text-center">Method</th>
                  <th class="text-right">Amount Received</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    ${p.invoice_number ? `Payment applied to Invoice <strong>${p.invoice_number}</strong>` : 'Direct Account Settlement'}
                    ${p.reference_number ? `<div style="font-size:11px; color:#64748b;">Ref: ${p.reference_number}</div>` : ''}
                  </td>
                  <td class="text-center"><span class="badge badge-info">${p.payment_method}</span></td>
                  <td class="text-right font-semibold" style="color:#16a34a; font-size:15px;">${Utils.formatCurrency(p.amount, currency)}</td>
                </tr>
              </tbody>
            </table>

            ${p.notes ? `
              <div class="doc-footer-notes">
                <strong>Notes:</strong> ${p.notes}
              </div>
            ` : ''}
          </div>
        `,
        footerHtml: `
          <button class="btn btn-secondary btn-sm" onclick="Modal.close()">Close</button>
          <button class="btn btn-primary btn-sm" onclick="Utils.printDocument('printable-receipt-doc')">Print Receipt</button>
        `
      });
    } catch (e) {}
  },

  async deletePayment(id, num) {
    if (!confirm(`Are you sure you want to delete receipt ${num}? This will restore the open invoice balance and customer outstanding balance.`)) return;
    try {
      await API.delete(`/payments/${id}`);
      Toast.success('Payment deleted and balances adjusted');
      this.render();
    } catch (e) {}
  }
};

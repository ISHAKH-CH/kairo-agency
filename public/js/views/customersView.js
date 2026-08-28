/**
 * Ledgerly Customers Module
 */
const CustomersView = {
  customers: [],
  summary: {},
  search: '',
  selectedStatus: 'all',
  limit: 50,
  offset: 0,
  total: 0,
  activeCustomerId: null,
  activeTab: 'overview',

  async render(customerId = null) {
    if (customerId) {
      this.activeCustomerId = customerId;
      return this.renderProfile(customerId);
    }

    this.activeCustomerId = null;
    Topbar.updateTitle('Customers', [{ label: 'Customers' }]);
    const contentEl = document.getElementById('app-content');

    contentEl.innerHTML = `
      <div class="content-container">
        <div style="display:flex; justify-content:center; padding: 40px; color:var(--text-muted);">
          Loading customer directory...
        </div>
      </div>
    `;

    try {
      const [sumRes, custRes] = await Promise.all([
        API.get('/customers/summary'),
        API.get('/customers', {
          search: this.search,
          status: this.selectedStatus === 'all' ? '' : this.selectedStatus,
          limit: this.limit,
          offset: this.offset
        })
      ]);

      this.summary = sumRes.data || {};
      this.customers = custRes.data || [];
      this.total = custRes.pagination?.total || 0;

      this.renderContent();
    } catch (e) {
      contentEl.innerHTML = `<div class="card" style="padding: 24px; color:var(--danger);">Error loading customers: ${e.message}</div>`;
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
            <h1 style="font-size:20px; font-weight:700; color:var(--text-primary);">Customers</h1>
            <p style="font-size:13px; color:var(--text-secondary);">Manage client profiles, transaction ledgers, and account statements.</p>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="CustomersView.exportCSV()">Export CSV</button>
            <button class="btn btn-primary btn-sm" onclick="CustomersView.openCustomerModal()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>+ Add Customer</span>
            </button>
          </div>
        </div>

        <!-- KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-title">Total Customers</span>
            <div class="kpi-value">${this.summary.total_customers || 0}</div>
            <div class="kpi-trend"><span class="text-muted">Registered accounts</span></div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">Active Clients</span>
            <div class="kpi-value" style="color:var(--success);">${this.summary.active_customers || 0}</div>
            <div class="kpi-trend"><span class="text-muted">In regular trading</span></div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">Outstanding Receivables</span>
            <div class="kpi-value" style="color:var(--danger);">${Utils.formatCurrency(this.summary.total_outstanding || 0, currency)}</div>
            <div class="kpi-trend"><span class="text-muted">Total unpaid balances</span></div>
          </div>
        </div>

        <!-- Filter Bar -->
        ${FilterBar.render({
          searchPlaceholder: 'Search customer name, company, email, phone...',
          searchValue: this.search,
          onSearch: 'CustomersView.onSearch(this.value)',
          showDateFilter: false,
          statusOptions: [
            { value: 'all', label: 'All Customers' },
            { value: 'outstanding', label: 'With Outstanding Balance' },
            { value: 'active', label: 'Active Only' }
          ],
          selectedStatus: this.selectedStatus,
          onStatusChange: 'CustomersView.onStatusFilter(this.value)',
          showExport: false
        })}

        <!-- Customers Table -->
        ${Table.render({
          columns: [
            {
              label: 'Customer',
              key: 'name',
              render: (val, r) => `
                <div>
                  <strong style="color:var(--primary); cursor:pointer;" onclick="window.location.hash = '#/customers/${r.id}'">${val}</strong>
                  ${r.company_name ? `<div style="font-size:11px; color:var(--text-muted);">${r.company_name}</div>` : ''}
                </div>
              `
            },
            { label: 'Phone', key: 'phone', render: (val) => val || '—' },
            { label: 'Email', key: 'email', render: (val) => val || '—' },
            { label: 'Total Sales', key: 'total_sales', align: 'right', render: (val) => `<span class="font-semibold">${Utils.formatCurrency(val, currency)}</span>` },
            { label: 'Paid', key: 'total_paid', align: 'right', render: (val) => Utils.formatCurrency(val, currency) },
            {
              label: 'Outstanding',
              key: 'outstanding_balance',
              align: 'right',
              render: (val) => `<strong style="color:${val > 0 ? 'var(--danger)' : 'var(--success)'};">${Utils.formatCurrency(val, currency)}</strong>`
            },
            { label: 'Status', key: 'is_active', render: (val) => val ? '<span class="badge badge-success"><span class="badge-dot"></span>Active</span>' : '<span class="badge badge-neutral">Inactive</span>' },
            {
              label: 'Actions',
              key: 'id',
              align: 'right',
              render: (val, r) => `
                <div class="table-actions">
                  <button class="btn btn-secondary btn-sm" onclick="window.location.hash = '#/customers/${r.id}'">Profile</button>
                  <button class="btn btn-outline btn-sm" onclick="SalesView.openNewSaleModal(${r.id})">+ Sale</button>
                  <button class="btn btn-secondary btn-sm" onclick="CustomersView.openCustomerModal(${r.id})">Edit</button>
                  <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="CustomersView.deleteCustomer(${r.id}, '${r.name.replace(/'/g, "\\'")}')">✕</button>
                </div>
              `
            }
          ],
          data: this.customers,
          emptyTitle: 'No customers yet',
          emptyMessage: 'Add your first customer to start tracking sales and payments.',
          emptyActionLabel: '+ Add Customer',
          onEmptyAction: 'CustomersView.openCustomerModal()',
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
    CustomersView.search = val;
    CustomersView.offset = 0;
    CustomersView.render();
  }, 250),

  onStatusFilter(val) {
    this.selectedStatus = val;
    this.offset = 0;
    this.render();
  },

  exportCSV() {
    Utils.exportToCSV('customers', this.customers.map(c => ({
      Name: c.name,
      Company: c.company_name || '',
      Phone: c.phone || '',
      Email: c.email || '',
      Address: c.address || '',
      TaxNumber: c.tax_number || '',
      TotalSales: c.total_sales,
      TotalPaid: c.total_paid,
      OutstandingBalance: c.outstanding_balance
    })));
  },

  async renderProfile(customerId) {
    const contentEl = document.getElementById('app-content');
    contentEl.innerHTML = `
      <div class="content-container">
        <div style="display:flex; justify-content:center; padding: 40px; color:var(--text-muted);">
          Loading customer profile...
        </div>
      </div>
    `;

    try {
      const res = await API.get(`/customers/${customerId}`);
      const c = res.data;
      const metrics = c.metrics || {};
      const currency = State.business.currency || 'AED';

      Topbar.updateTitle(c.name, [
        { label: 'Customers', url: '#/customers' },
        { label: c.name }
      ]);

      contentEl.innerHTML = `
        <div class="content-container">
          <!-- Profile Top Header -->
          <div class="customer-profile-card">
            <div class="customer-profile-header">
              <div class="customer-title-group">
                <h2>${c.name}</h2>
                <div style="font-size:14px; color:var(--text-secondary); margin-top:2px;">${c.company_name || 'Individual Customer'}</div>
                <div class="customer-contact-meta">
                  ${c.phone ? `<span>📞 ${c.phone}</span>` : ''}
                  ${c.email ? `<span>✉️ ${c.email}</span>` : ''}
                  ${c.address ? `<span>📍 ${c.address}</span>` : ''}
                  ${c.tax_number ? `<span>🏷️ TRN: ${c.tax_number}</span>` : ''}
                </div>
              </div>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary btn-sm" onclick="CustomersView.openCustomerModal(${c.id})">Edit Profile</button>
                <button class="btn btn-primary btn-sm" onclick="SalesView.openNewSaleModal(${c.id})">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  <span>+ New Sale</span>
                </button>
              </div>
            </div>

            <!-- 4 Customer KPI Cards -->
            <div class="kpi-grid">
              <div class="kpi-card">
                <span class="kpi-title">Total Invoiced</span>
                <div class="kpi-value">${Utils.formatCurrency(metrics.totalSales, currency)}</div>
                <div class="kpi-trend"><span class="text-muted">${metrics.invoiceCount} total sales</span></div>
              </div>
              <div class="kpi-card">
                <span class="kpi-title">Total Paid</span>
                <div class="kpi-value" style="color:var(--success);">${Utils.formatCurrency(metrics.totalPaid, currency)}</div>
                <div class="kpi-trend"><span class="text-muted">Received collections</span></div>
              </div>
              <div class="kpi-card">
                <span class="kpi-title">Outstanding Balance</span>
                <div class="kpi-value" style="color:${metrics.outstanding > 0 ? 'var(--danger)' : 'var(--success)'};">${Utils.formatCurrency(metrics.outstanding, currency)}</div>
                <div class="kpi-trend"><span class="text-muted">Due currently</span></div>
              </div>
              <div class="kpi-card">
                <span class="kpi-title">Last Transaction</span>
                <div class="kpi-value" style="font-size:16px;">${Utils.formatDate(metrics.lastTransaction)}</div>
                <div class="kpi-trend"><span class="text-muted">Most recent billing</span></div>
              </div>
            </div>
          </div>

          <!-- Profile Tabs -->
          <div class="tab-strip">
            <button class="tab-btn ${this.activeTab === 'overview' ? 'active' : ''}" onclick="CustomersView.switchTab('overview', ${c.id})">Sales History (${c.sales?.length || 0})</button>
            <button class="tab-btn ${this.activeTab === 'payments' ? 'active' : ''}" onclick="CustomersView.switchTab('payments', ${c.id})">Payments Received (${c.payments?.length || 0})</button>
            <button class="tab-btn ${this.activeTab === 'quotations' ? 'active' : ''}" onclick="CustomersView.switchTab('quotations', ${c.id})">Quotations (${c.quotations?.length || 0})</button>
            <button class="tab-btn ${this.activeTab === 'statement' ? 'active' : ''}" onclick="CustomersView.switchTab('statement', ${c.id})">Account Statement</button>
          </div>

          <!-- Tab Content Area -->
          <div id="customer-tab-content">
            ${this.renderTabContent(c)}
          </div>
        </div>
      `;

      if (this.activeTab === 'statement') {
        this.loadStatement(c.id);
      }
    } catch (e) {
      contentEl.innerHTML = `<div class="card" style="padding: 24px; color:var(--danger);">Error loading customer: ${e.message}</div>`;
    }
  },

  switchTab(tab, customerId) {
    this.activeTab = tab;
    this.renderProfile(customerId);
  },

  renderTabContent(c) {
    const currency = State.business.currency || 'AED';

    if (this.activeTab === 'payments') {
      return Table.render({
        columns: [
          { label: 'Payment #', key: 'payment_number', render: (val, r) => `<strong style="color:var(--primary); cursor:pointer;" onclick="PaymentsView.viewPayment(${r.id})">${val}</strong>` },
          { label: 'Date', key: 'payment_date', render: (val) => Utils.formatDate(val) },
          { label: 'Invoice Ref', key: 'invoice_number', render: (val) => val || 'General Receipt' },
          { label: 'Method', key: 'payment_method', render: (val) => `<span class="badge badge-neutral">${val}</span>` },
          { label: 'Amount Received', key: 'amount', align: 'right', render: (val) => `<strong style="color:var(--success);">${Utils.formatCurrency(val, currency)}</strong>` }
        ],
        data: c.payments || [],
        emptyTitle: 'No payments recorded',
        emptyMessage: 'No payment receipts logged for this customer.'
      });
    }

    if (this.activeTab === 'quotations') {
      return Table.render({
        columns: [
          { label: 'Quote #', key: 'quotation_number', render: (val, r) => `<strong style="color:var(--primary); cursor:pointer;" onclick="QuotationsView.viewQuotation(${r.id})">${val}</strong>` },
          { label: 'Date', key: 'quotation_date', render: (val) => Utils.formatDate(val) },
          { label: 'Valid Until', key: 'valid_until', render: (val) => Utils.formatDate(val) },
          { label: 'Total', key: 'total', align: 'right', render: (val) => Utils.formatCurrency(val, currency) },
          { label: 'Status', key: 'status', render: (val) => Utils.renderStatusBadge(val) },
          {
            label: 'Actions',
            key: 'id',
            align: 'right',
            render: (val, r) => `
              <div class="table-actions">
                <button class="btn btn-secondary btn-sm" onclick="QuotationsView.viewQuotation(${r.id})">View</button>
                ${r.status !== 'Converted' ? `<button class="btn btn-primary btn-sm" onclick="QuotationsView.convertToSale(${r.id})">Convert</button>` : ''}
              </div>
            `
          }
        ],
        data: c.quotations || [],
        emptyTitle: 'No quotations found'
      });
    }

    if (this.activeTab === 'statement') {
      return `
        <div id="statement-container" style="padding:20px; text-align:center; color:var(--text-muted);">
          Generating customer statement...
        </div>
      `;
    }

    // Default: Sales tab
    return Table.render({
      columns: [
        { label: 'Invoice #', key: 'invoice_number', render: (val, r) => `<strong style="color:var(--primary); cursor:pointer;" onclick="SalesView.viewSale(${r.id})">${val}</strong>` },
        { label: 'Date', key: 'invoice_date', render: (val) => Utils.formatDate(val) },
        { label: 'Due Date', key: 'due_date', render: (val) => Utils.formatDate(val) },
        { label: 'Amount', key: 'total', align: 'right', render: (val) => Utils.formatCurrency(val, currency) },
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
              ${r.balance > 0 ? `<button class="btn btn-outline btn-sm" onclick="SalesView.quickRecordPayment(${r.id}, ${c.id}, ${r.balance}, '${r.invoice_number}')">Pay</button>` : ''}
            </div>
          `
        }
      ],
      data: c.sales || [],
      emptyTitle: 'No sales recorded',
      emptyMessage: 'No invoices created for this customer yet.',
      emptyActionLabel: '+ New Sale',
      onEmptyAction: `SalesView.openNewSaleModal(${c.id})`
    });
  },

  async loadStatement(customerId) {
    const from = '2026-01-01';
    const to = '2026-12-31';

    try {
      const res = await API.get(`/customers/${customerId}/statement`, { from, to });
      const stmt = res.data;
      const currency = stmt.business?.currency || 'AED';

      const rowsHtml = (stmt.transactions || []).map((t, idx) => `
        <tr>
          <td>${Utils.formatDate(t.date)}</td>
          <td><span class="badge ${t.type === 'Invoice' ? 'badge-info' : 'badge-success'}">${t.type}</span></td>
          <td><strong>${t.reference}</strong></td>
          <td class="text-right">${t.debit > 0 ? Utils.formatCurrency(t.debit, currency) : '—'}</td>
          <td class="text-right" style="color:#16a34a;">${t.credit > 0 ? Utils.formatCurrency(t.credit, currency) : '—'}</td>
          <td class="text-right font-semibold">${Utils.formatCurrency(t.balance, currency)}</td>
        </tr>
      `).join('');

      const cont = document.getElementById('statement-container');
      if (!cont) return;

      cont.innerHTML = `
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:16px;">
          <button class="btn btn-primary btn-sm" onclick="Utils.printDocument('statement-sheet-doc')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            <span>Print Statement</span>
          </button>
        </div>

        <div class="statement-sheet" id="statement-sheet-doc">
          <div class="statement-company-header">
            <div>
              <h2 style="font-size:20px; font-weight:800; color:#2563eb;">${stmt.business?.name}</h2>
              <div style="font-size:12px; color:#475569; margin-top:4px;">
                ${stmt.business?.address}<br>
                TRN / Tax #: ${stmt.business?.tax_number}<br>
                Phone: ${stmt.business?.phone}
              </div>
            </div>
            <div class="text-right">
              <h3 style="font-size:22px; font-weight:700; color:#0f172a;">STATEMENT OF ACCOUNT</h3>
              <div style="font-size:12px; color:#475569; margin-top:4px;">Statement Period: ${Utils.formatDate(from)} – ${Utils.formatDate(to)}</div>
              <div style="font-size:12px; color:#475569;">Generated: ${Utils.formatDate(Utils.todayISO())}</div>
            </div>
          </div>

          <div style="margin-bottom:24px; padding:12px 16px; background:#f8fafc; border-radius:6px; border:1px solid #e2e8f0;">
            <div style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:600;">Statement For</div>
            <div style="font-size:15px; font-weight:700; color:#0f172a; margin-top:2px;">${stmt.customer?.name}</div>
            <div style="font-size:12px; color:#475569;">${stmt.customer?.company_name || ''} • TRN: ${stmt.customer?.tax_number || 'N/A'} • ${stmt.customer?.phone || ''}</div>
          </div>

          <table class="doc-table">
            <thead>
              <tr>
                <th style="width:15%;">Date</th>
                <th style="width:12%;">Type</th>
                <th style="width:23%;">Reference</th>
                <th style="width:16%;" class="text-right">Invoiced (+)</th>
                <th style="width:16%;" class="text-right">Paid (-)</th>
                <th style="width:18%;" class="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background:#f8fafc; font-style:italic;">
                <td>${Utils.formatDate(from)}</td>
                <td colspan="4"><strong>Opening Balance</strong></td>
                <td class="text-right font-semibold">${Utils.formatCurrency(stmt.openingBalance, currency)}</td>
              </tr>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="doc-totals-box">
            <div class="doc-totals-row"><span>Total Invoiced:</span><span>${Utils.formatCurrency(stmt.totalDebits, currency)}</span></div>
            <div class="doc-totals-row"><span>Total Received:</span><span style="color:#16a34a;">${Utils.formatCurrency(stmt.totalCredits, currency)}</span></div>
            <div class="doc-totals-row grand-total"><span>Ending Balance:</span><span style="color:${stmt.closingBalance > 0 ? '#dc2626' : '#16a34a'};">${Utils.formatCurrency(stmt.closingBalance, currency)}</span></div>
          </div>
        </div>
      `;
    } catch (e) {}
  },

  async openCustomerModal(customerId = null) {
    let customer = {
      name: '',
      company_name: '',
      email: '',
      phone: '',
      address: '',
      tax_number: '',
      opening_balance: 0
    };

    if (customerId) {
      try {
        const res = await API.get(`/customers/${customerId}`);
        customer = res.data;
      } catch (e) { return; }
    }

    const isEdit = !!customerId;

    Modal.open({
      title: isEdit ? `Edit Customer: ${customer.name}` : 'Add New Customer',
      size: 'md',
      bodyHtml: `
        <form id="customer-form" onsubmit="CustomersView.saveCustomer(event, ${customerId || 'null'})">
          <div class="form-group">
            <label class="form-label">Contact / Individual Name <span class="required">*</span></label>
            <input type="text" name="name" class="form-control" placeholder="e.g. Ahmed Al Mansoori" value="${customer.name || ''}" required>
          </div>

          <div class="form-group">
            <label class="form-label">Company Name</label>
            <input type="text" name="company_name" class="form-control" placeholder="e.g. Al Noor Trading LLC" value="${customer.company_name || ''}">
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Phone Number</label>
              <input type="tel" name="phone" class="form-control" placeholder="+971 50 123 4567" value="${customer.phone || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" name="email" class="form-control" placeholder="client@company.ae" value="${customer.email || ''}">
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Tax / VAT TRN Number</label>
              <input type="text" name="tax_number" class="form-control" placeholder="100998877600003" value="${customer.tax_number || ''}">
            </div>
            ${!isEdit ? `
              <div class="form-group">
                <label class="form-label">Opening Balance</label>
                <input type="number" step="0.01" name="opening_balance" class="form-control" placeholder="0.00" value="${customer.opening_balance || 0}">
              </div>
            ` : ''}
          </div>

          <div class="form-group">
            <label class="form-label">Billing Address</label>
            <textarea name="address" class="form-control" placeholder="Street, Building, City, Country...">${customer.address || ''}</textarea>
          </div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-secondary btn-sm" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="document.getElementById('customer-form').requestSubmit()">${isEdit ? 'Update Customer' : 'Save Customer'}</button>
      `
    });
  },

  async saveCustomer(event, customerId) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const body = Object.fromEntries(formData.entries());

    try {
      if (customerId) {
        await API.put(`/customers/${customerId}`, body);
        Toast.success('Customer updated successfully');
      } else {
        await API.post('/customers', body);
        Toast.success('Customer added successfully');
      }
      Modal.close();
      this.render(this.activeCustomerId);
    } catch (e) {}
  },

  deleteCustomer(customerId, name) {
    Modal.open({
      title: 'Delete Customer',
      bodyHtml: `<p style="font-size:13.5px; color:var(--text-secondary);">Are you sure you want to delete customer <strong>${name}</strong>?</p>`,
      footerHtml: `
        <button class="btn btn-secondary btn-sm" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-danger btn-sm" onclick="CustomersView.confirmDelete(${customerId})">Delete</button>
      `
    });
  },

  async confirmDelete(customerId) {
    try {
      await API.delete(`/customers/${customerId}`);
      Toast.success('Customer deleted successfully');
      Modal.close();
      this.render();
    } catch (e) {}
  }
};

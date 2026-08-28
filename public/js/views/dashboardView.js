/**
 * Ledgerly Dashboard View
 */
const DashboardView = {
  data: null,
  activeTimeframe: '30d',
  activeRange: 'month',

  async render() {
    Topbar.updateTitle('Dashboard', [{ label: 'Dashboard' }]);

    const contentEl = document.getElementById('app-content');
    contentEl.innerHTML = `
      <div class="content-container">
        <div style="display:flex; justify-content:center; padding: 40px; color:var(--text-muted);">
          Loading live business dashboard...
        </div>
      </div>
    `;

    try {
      this.data = await API.get('/dashboard', {
        range: this.activeRange,
        timeframe: this.activeTimeframe
      });

      this.renderContent();
    } catch (err) {
      contentEl.innerHTML = `
        <div class="content-container">
          <div class="card" style="padding: 24px; color: var(--danger);">
            Failed to load dashboard: ${err.message}
          </div>
        </div>
      `;
    }
  },

  renderContent() {
    const { kpis, chart, recentTransactions, business } = this.data;
    const currency = business?.currency || 'AED';
    const contentEl = document.getElementById('app-content');

    const userName = State.user.name.split(' ')[0] || 'Business Owner';

    contentEl.innerHTML = `
      <div class="content-container">
        <!-- Dashboard Header -->
        <div class="dashboard-header">
          <div class="dashboard-greeting">
            <h1>Good morning, ${userName}</h1>
            <p>Here's how your business is doing today.</p>
          </div>

          <div style="display:flex; align-items:center; gap:10px;">
            <select class="filter-select" id="dashboard-date-range-select" onchange="DashboardView.onRangeChange(this.value)">
              <option value="today" ${this.activeRange === 'today' ? 'selected' : ''}>Today</option>
              <option value="week" ${this.activeRange === 'week' ? 'selected' : ''}>This Week</option>
              <option value="month" ${this.activeRange === 'month' ? 'selected' : ''}>This Month</option>
              <option value="last_month" ${this.activeRange === 'last_month' ? 'selected' : ''}>Last Month</option>
              <option value="year" ${this.activeRange === 'year' ? 'selected' : ''}>This Year</option>
            </select>
          </div>
        </div>

        <!-- 5 Compact KPI Cards -->
        <div class="kpi-grid">
          <!-- Total Sales -->
          <div class="kpi-card" onclick="window.location.hash = '#/sales'" style="cursor:pointer;">
            <div class="kpi-header">
              <span class="kpi-title">Total Sales</span>
              <span class="kpi-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </span>
            </div>
            <div class="kpi-value">${Utils.formatCurrency(kpis.totalSales, currency)}</div>
            <div class="kpi-trend positive">
              <span>↑ 12.5%</span> <span class="text-muted">from last period</span>
            </div>
          </div>

          <!-- Purchases -->
          <div class="kpi-card" onclick="window.location.hash = '#/purchases'" style="cursor:pointer;">
            <div class="kpi-header">
              <span class="kpi-title">Purchases</span>
              <span class="kpi-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
              </span>
            </div>
            <div class="kpi-value">${Utils.formatCurrency(kpis.purchases, currency)}</div>
            <div class="kpi-trend negative">
              <span>↓ 4.2%</span> <span class="text-muted">from last period</span>
            </div>
          </div>

          <!-- Payments Received -->
          <div class="kpi-card" onclick="window.location.hash = '#/payments'" style="cursor:pointer;">
            <div class="kpi-header">
              <span class="kpi-title">Payments Received</span>
              <span class="kpi-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                  <line x1="1" y1="10" x2="23" y2="10"></line>
                </svg>
              </span>
            </div>
            <div class="kpi-value">${Utils.formatCurrency(kpis.paymentsReceived, currency)}</div>
            <div class="kpi-trend positive">
              <span>↑ 8.7%</span> <span class="text-muted">collected</span>
            </div>
          </div>

          <!-- Expenses -->
          <div class="kpi-card" onclick="window.location.hash = '#/expenditure'" style="cursor:pointer;">
            <div class="kpi-header">
              <span class="kpi-title">Expenses</span>
              <span class="kpi-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                  <line x1="7" y1="7" x2="7.01" y2="7"></line>
                </svg>
              </span>
            </div>
            <div class="kpi-value">${Utils.formatCurrency(kpis.expenses, currency)}</div>
            <div class="kpi-trend warning">
              <span>↑ 2.1%</span> <span class="text-muted">operating costs</span>
            </div>
          </div>

          <!-- Outstanding Receivables -->
          <div class="kpi-card" onclick="window.location.hash = '#/customers'" style="cursor:pointer;">
            <div class="kpi-header">
              <span class="kpi-title">Outstanding</span>
              <span class="kpi-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                </svg>
              </span>
            </div>
            <div class="kpi-value" style="color:var(--danger);">${Utils.formatCurrency(kpis.outstanding, currency)}</div>
            <div class="kpi-trend">
              <span class="text-muted">Pending from customers</span>
            </div>
          </div>
        </div>

        <!-- Quick Actions Section -->
        <div class="quick-actions-card">
          <div class="quick-actions-title">Quick Actions</div>
          <div class="quick-actions-grid">
            <button class="quick-action-btn" onclick="App.openCreateSaleModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              <span>+ New Sale</span>
            </button>
            <button class="quick-action-btn" onclick="App.openCreatePurchaseModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
              <span>+ New Purchase</span>
            </button>
            <button class="quick-action-btn" onclick="App.openCreateQuotationModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              <span>+ New Quotation</span>
            </button>
            <button class="quick-action-btn" onclick="App.openCreateCustomerModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
              <span>+ Add Customer</span>
            </button>
            <button class="quick-action-btn" onclick="App.openRecordPaymentModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
              <span>+ Record Payment</span>
            </button>
            <button class="quick-action-btn" onclick="App.openCreateExpenseModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path></svg>
              <span>+ Add Expense</span>
            </button>
            <button class="quick-action-btn" onclick="window.location.hash = '#/stock'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
              <span>Check Stock</span>
            </button>
          </div>
        </div>

        <!-- Sales Overview Chart -->
        <div class="chart-card">
          <div class="chart-header">
            <div>
              <h3 class="card-title">Sales Overview</h3>
              <p style="font-size:12px; color:var(--text-secondary);">Sales vs collections comparison</p>
            </div>
            <div class="chart-timeframe-controls">
              <button class="chart-timeframe-btn ${this.activeTimeframe === '7d' ? 'active' : ''}" onclick="DashboardView.onTimeframeChange('7d')">7 Days</button>
              <button class="chart-timeframe-btn ${this.activeTimeframe === '30d' ? 'active' : ''}" onclick="DashboardView.onTimeframeChange('30d')">30 Days</button>
              <button class="chart-timeframe-btn ${this.activeTimeframe === '3m' ? 'active' : ''}" onclick="DashboardView.onTimeframeChange('3m')">3 Months</button>
              <button class="chart-timeframe-btn ${this.activeTimeframe === '12m' ? 'active' : ''}" onclick="DashboardView.onTimeframeChange('12m')">12 Months</button>
            </div>
          </div>

          <div class="chart-canvas-wrapper">
            ${Charts.renderBarChart({ data: chart.data, height: 230 })}
          </div>

          <!-- Below chart metrics -->
          <div class="chart-metrics-summary">
            <div class="metric-item">
              <span class="metric-item-label">Total Sales</span>
              <span class="metric-item-value">${Utils.formatCurrency(chart.summary.totalSales, currency)}</span>
            </div>
            <div class="metric-item">
              <span class="metric-item-label">Paid</span>
              <span class="metric-item-value" style="color:var(--success);">${Utils.formatCurrency(chart.summary.paid, currency)}</span>
            </div>
            <div class="metric-item">
              <span class="metric-item-label">Pending</span>
              <span class="metric-item-value" style="color:var(--warning);">${Utils.formatCurrency(chart.summary.pending, currency)}</span>
            </div>
            <div class="metric-item">
              <span class="metric-item-label">Overdue</span>
              <span class="metric-item-value" style="color:var(--danger);">${Utils.formatCurrency(chart.summary.overdue, currency)}</span>
            </div>
          </div>
        </div>

        <!-- Recent Transactions Table -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Recent Transactions</h3>
            <a href="#/sales" class="btn btn-secondary btn-sm">View All Sales</a>
          </div>
          ${Table.render({
            columns: [
              { label: 'Date', key: 'transaction_date', render: (val) => Utils.formatDate(val) },
              { label: 'Type', key: 'type', render: (val) => `<span class="badge badge-neutral">${val}</span>` },
              { label: 'Reference', key: 'reference', render: (val, r) => `<strong style="color:var(--primary);">${val}</strong>` },
              { label: 'Customer / Supplier', key: 'party_name', render: (val, r) => `<div><strong>${val}</strong>${r.party_company ? `<div style="font-size:11px; color:var(--text-muted);">${r.party_company}</div>` : ''}</div>` },
              { label: 'Amount', key: 'amount', align: 'right', render: (val) => `<span class="font-semibold">${Utils.formatCurrency(val, currency)}</span>` },
              { label: 'Status', key: 'status', render: (val) => Utils.renderStatusBadge(val) }
            ],
            data: recentTransactions,
            emptyTitle: 'No recent transactions',
            emptyMessage: 'Record your first sale or purchase to see recent activity.'
          })}
        </div>
      </div>
    `;
  },

  onTimeframeChange(tf) {
    this.activeTimeframe = tf;
    this.render();
  },

  onRangeChange(range) {
    this.activeRange = range;
    this.render();
  }
};

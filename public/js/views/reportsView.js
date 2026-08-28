/**
 * Ledgerly Reporting Engine & Analytics Module
 */
const ReportsView = {
  activeReport: 'sales-summary',
  from: '2026-01-01',
  to: '2026-12-31',
  reportData: null,

  reportsList: [
    {
      category: 'Sales Reports',
      items: [
        { id: 'sales-summary', name: 'Sales Summary', desc: 'Overall sales, taxes, discounts, and payments' },
        { id: 'sales-by-customer', name: 'Sales by Customer', desc: 'Revenue breakdown by individual customer' },
        { id: 'sales-by-product', name: 'Sales by Product', desc: 'Top selling products and revenue generated' },
        { id: 'sales-by-date', name: 'Sales by Date', desc: 'Daily and chronological revenue trends' },
        { id: 'outstanding-sales', name: 'Outstanding Receivables (Aging)', desc: 'Aging report of unpaid customer balances' }
      ]
    },
    {
      category: 'Purchase Reports',
      items: [
        { id: 'purchases-summary', name: 'Purchase Summary', desc: 'Total inventory purchases, taxes, and supplier payables' },
        { id: 'purchases-by-supplier', name: 'Purchases by Supplier', desc: 'Spend breakdown per vendor / supplier' },
        { id: 'purchases-by-product', name: 'Purchases by Product', desc: 'Quantity and spend per replenished product' }
      ]
    },
    {
      category: 'Inventory Reports',
      items: [
        { id: 'stock-summary', name: 'Stock Summary', desc: 'Current quantities on hand and SKU status' },
        { id: 'low-stock', name: 'Low Stock Alert', desc: 'Items at or below reorder threshold' },
        { id: 'stock-valuation', name: 'Stock Valuation', desc: 'Inventory value at cost vs potential retail margin' },
        { id: 'stock-movements', name: 'Stock Movement Ledger', desc: 'Detailed log of all stock ins and outs' }
      ]
    },
    {
      category: 'Financial Reports',
      items: [
        { id: 'income-expense', name: 'Profit & Loss (Income & Expense)', desc: 'Gross revenue, COGS, expenses, and net profit' },
        { id: 'payments-received', name: 'Payments Received', desc: 'Collections by payment method' },
        { id: 'expense-summary', name: 'Expense Breakdown', desc: 'Operating expenses by category and vendor' }
      ]
    }
  ],

  async render() {
    Topbar.updateTitle('Reports', [{ label: 'Reports' }]);
    const contentEl = document.getElementById('app-content');

    contentEl.innerHTML = `
      <div class="content-container">
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
          <div>
            <h1 style="font-size:20px; font-weight:700; color:var(--text-primary);">Reports</h1>
            <p style="font-size:13px; color:var(--text-secondary);">Understand your business at a glance with real-time financial and inventory reports.</p>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <select class="filter-select" id="report-date-filter" onchange="ReportsView.onDatePresetChange(this.value)">
              <option value="year">This Year (2026)</option>
              <option value="month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="all">All Time</option>
            </select>
            <button class="btn btn-secondary btn-sm" onclick="ReportsView.exportCurrentReport()">Export CSV</button>
            <button class="btn btn-primary btn-sm" onclick="Utils.printDocument('report-print-container')">Print Report</button>
          </div>
        </div>

        <!-- Two Column Layout: Reports Picker & Preview -->
        <div style="display:grid; grid-template-columns: 280px 1fr; gap: 20px; align-items:flex-start;">
          <!-- Reports Sidebar Menu -->
          <div class="card" style="padding: 12px;">
            ${this.renderReportsNav()}
          </div>

          <!-- Active Report Content Sheet -->
          <div class="card" id="report-print-container" style="padding: 24px;">
            <div id="report-active-content" style="display:flex; justify-content:center; padding: 40px; color:var(--text-muted);">
              Loading report...
            </div>
          </div>
        </div>
      </div>
    `;

    this.loadActiveReport();
  },

  renderReportsNav() {
    return this.reportsList.map(cat => `
      <div style="margin-bottom: 12px;">
        <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--text-muted); padding:6px 8px; letter-spacing:0.5px;">
          ${cat.category}
        </div>
        <div style="display:flex; flex-direction:column; gap:2px;">
          ${cat.items.map(item => `
            <button 
              class="nav-item ${item.id === this.activeReport ? 'active' : ''}" 
              style="border:none; text-align:left; width:100%; cursor:pointer; font-size:13px;"
              onclick="ReportsView.selectReport('${item.id}')"
            >
              <span class="nav-label">${item.name}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `).join('');
  },

  selectReport(reportId) {
    this.activeReport = reportId;
    this.render();
  },

  onDatePresetChange(preset) {
    if (preset === 'month') {
      this.from = '2026-08-01';
      this.to = '2026-08-31';
    } else if (preset === 'last_month') {
      this.from = '2026-07-01';
      this.to = '2026-07-31';
    } else if (preset === 'year') {
      this.from = '2026-01-01';
      this.to = '2026-12-31';
    } else {
      this.from = '2020-01-01';
      this.to = '2030-12-31';
    }
    this.loadActiveReport();
  },

  async loadActiveReport() {
    const cont = document.getElementById('report-active-content');
    if (!cont) return;

    cont.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">Calculating report data from database...</div>';

    try {
      const res = await API.get(`/reports/${this.activeReport}`, { from: this.from, to: this.to });
      this.reportData = res;
      this.renderReportSheet(cont, res);
    } catch (e) {
      cont.innerHTML = `<div style="color:var(--danger); padding:20px;">Error calculating report: ${e.message}</div>`;
    }
  },

  renderReportSheet(container, res) {
    const currency = State.business.currency || 'AED';
    const biz = State.business;

    let title = this.activeReport.replace(/-/g, ' ').toUpperCase();
    let innerHtml = '';

    if (this.activeReport === 'sales-summary') {
      const s = res.summary || {};
      innerHtml = `
        <div class="kpi-grid" style="margin-bottom:20px;">
          <div class="kpi-card"><span class="kpi-title">Gross Sales</span><div class="kpi-value">${Utils.formatCurrency(s.gross_sales, currency)}</div></div>
          <div class="kpi-card"><span class="kpi-title">Tax (VAT)</span><div class="kpi-value">${Utils.formatCurrency(s.total_tax, currency)}</div></div>
          <div class="kpi-card"><span class="kpi-title">Net Sales</span><div class="kpi-value font-semibold" style="color:var(--primary);">${Utils.formatCurrency(s.net_sales, currency)}</div></div>
          <div class="kpi-card"><span class="kpi-title">Total Collected</span><div class="kpi-value" style="color:var(--success);">${Utils.formatCurrency(s.total_paid, currency)}</div></div>
        </div>
        ${Table.render({
          columns: [
            { label: 'Date', key: 'invoice_date', render: (val) => Utils.formatDate(val) },
            { label: 'Invoice #', key: 'invoice_number', render: (val) => `<strong>${val}</strong>` },
            { label: 'Customer', key: 'customer_name' },
            { label: 'Subtotal', key: 'subtotal', align: 'right', render: (val) => Utils.formatCurrency(val, currency) },
            { label: 'Tax', key: 'tax', align: 'right', render: (val) => Utils.formatCurrency(val, currency) },
            { label: 'Total', key: 'total', align: 'right', render: (val) => `<span class="font-semibold">${Utils.formatCurrency(val, currency)}</span>` },
            { label: 'Status', key: 'payment_status', render: (val) => Utils.renderStatusBadge(val) }
          ],
          data: res.rows || []
        })}
      `;
    } else if (this.activeReport === 'sales-by-customer') {
      innerHtml = Table.render({
        columns: [
          { label: 'Customer Name', key: 'customer_name', render: (val, r) => `<strong>${val}</strong>${r.company_name ? `<div style="font-size:11px; color:var(--text-muted);">${r.company_name}</div>` : ''}` },
          { label: 'Invoices', key: 'invoice_count', align: 'center' },
          { label: 'Gross Sales', key: 'subtotal', align: 'right', render: (val) => Utils.formatCurrency(val, currency) },
          { label: 'VAT (5%)', key: 'total_tax', align: 'right', render: (val) => Utils.formatCurrency(val, currency) },
          { label: 'Net Sales', key: 'total_sales', align: 'right', render: (val) => `<span class="font-semibold">${Utils.formatCurrency(val, currency)}</span>` },
          { label: 'Paid', key: 'total_paid', align: 'right', render: (val) => Utils.formatCurrency(val, currency) },
          { label: 'Balance Due', key: 'balance', align: 'right', render: (val) => `<span style="color:${val > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight:600;">${Utils.formatCurrency(val, currency)}</span>` }
        ],
        data: res.rows || []
      });
    } else if (this.activeReport === 'sales-by-product') {
      innerHtml = Table.render({
        columns: [
          { label: 'SKU', key: 'sku', render: (val) => `<strong>${val}</strong>` },
          { label: 'Product Name', key: 'product_name' },
          { label: 'Category', key: 'category', render: (val) => `<span class="badge badge-neutral">${val}</span>` },
          { label: 'Quantity Sold', key: 'quantity_sold', align: 'right', render: (val, r) => `<strong>${val}</strong> ${r.unit}` },
          { label: 'Avg Rate', key: 'average_selling_rate', align: 'right', render: (val) => Utils.formatCurrency(val, currency) },
          { label: 'Total Revenue', key: 'total_revenue', align: 'right', render: (val) => `<span class="font-semibold" style="color:var(--primary);">${Utils.formatCurrency(val, currency)}</span>` }
        ],
        data: res.rows || []
      });
    } else if (this.activeReport === 'outstanding-sales') {
      const s = res.summary || {};
      innerHtml = `
        <div class="kpi-grid" style="margin-bottom:20px;">
          <div class="kpi-card"><span class="kpi-title">Total Outstanding</span><div class="kpi-value" style="color:var(--danger);">${Utils.formatCurrency(s.total_outstanding, currency)}</div></div>
          <div class="kpi-card"><span class="kpi-title">Current (Not Due)</span><div class="kpi-value">${Utils.formatCurrency(s.current, currency)}</div></div>
          <div class="kpi-card"><span class="kpi-title">1 - 30 Days Overdue</span><div class="kpi-value" style="color:var(--warning);">${Utils.formatCurrency(s.bucket_1_30, currency)}</div></div>
          <div class="kpi-card"><span class="kpi-title">30+ Days Overdue</span><div class="kpi-value" style="color:var(--danger);">${Utils.formatCurrency(s.bucket_31_60 + s.bucket_61_90 + s.bucket_90_plus, currency)}</div></div>
        </div>
        ${Table.render({
          columns: [
            { label: 'Invoice #', key: 'invoice_number', render: (val) => `<strong>${val}</strong>` },
            { label: 'Customer', key: 'customer_name' },
            { label: 'Due Date', key: 'due_date', render: (val) => Utils.formatDate(val) },
            { label: 'Days Overdue', key: 'days_overdue', align: 'center', render: (val) => val > 0 ? `<span style="color:var(--danger); font-weight:600;">${val} days</span>` : 'Current' },
            { label: 'Aging Bracket', key: 'aging_bracket', render: (val) => `<span class="badge ${val === 'Current' ? 'badge-neutral' : 'badge-danger'}">${val}</span>` },
            { label: 'Balance Due', key: 'balance', align: 'right', render: (val) => `<strong style="color:var(--danger);">${Utils.formatCurrency(val, currency)}</strong>` }
          ],
          data: res.rows || []
        })}
      `;
    } else if (this.activeReport === 'stock-valuation') {
      const g = res.grandTotals || {};
      innerHtml = `
        <div class="kpi-grid" style="margin-bottom:20px;">
          <div class="kpi-card"><span class="kpi-title">Total Products</span><div class="kpi-value">${g.product_count || 0}</div></div>
          <div class="kpi-card"><span class="kpi-title">Stock Valuation (Cost)</span><div class="kpi-value">${Utils.formatCurrency(g.cost_valuation, currency)}</div></div>
          <div class="kpi-card"><span class="kpi-title">Stock Valuation (Retail)</span><div class="kpi-value">${Utils.formatCurrency(g.retail_valuation, currency)}</div></div>
          <div class="kpi-card"><span class="kpi-title">Potential Profit Margin</span><div class="kpi-value" style="color:var(--success);">${Utils.formatCurrency(g.potential_margin, currency)}</div></div>
        </div>
        ${Table.render({
          columns: [
            { label: 'Category', key: 'category', render: (val) => `<span class="badge badge-neutral">${val}</span>` },
            { label: 'SKUs', key: 'product_count', align: 'center' },
            { label: 'Units On Hand', key: 'total_units', align: 'center' },
            { label: 'Valuation at Cost', key: 'cost_valuation', align: 'right', render: (val) => Utils.formatCurrency(val, currency) },
            { label: 'Retail Value', key: 'retail_valuation', align: 'right', render: (val) => Utils.formatCurrency(val, currency) },
            { label: 'Expected Margin', key: 'potential_margin', align: 'right', render: (val) => `<span class="font-semibold" style="color:var(--success);">${Utils.formatCurrency(val, currency)}</span>` }
          ],
          data: res.categories || []
        })}
      `;
    } else if (this.activeReport === 'income-expense') {
      const rev = res.revenue || {};
      const cogs = res.cogs || {};
      const exp = res.operatingExpenses || {};
      innerHtml = `
        <div style="max-width:700px; margin: 0 auto; display:flex; flex-direction:column; gap:16px;">
          <!-- P&L Table Box -->
          <div class="card" style="padding:20px;">
            <h3 style="font-size:16px; font-weight:700; margin-bottom:16px; border-bottom:1px solid var(--border); padding-bottom:8px;">
              Income & Expense Statement (P&L)
            </h3>
            <div style="display:flex; justify-content:space-between; padding:8px 0; font-size:13.5px;">
              <span>Total Sales Revenue (Invoiced):</span>
              <strong>${Utils.formatCurrency(rev.net_sales_revenue, currency)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; padding:8px 0; font-size:13.5px; border-bottom:1px solid var(--border);">
              <span>Less: Purchases / Cost of Goods (COGS):</span>
              <span style="color:var(--danger);">- ${Utils.formatCurrency(cogs.total_purchases, currency)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding:10px 0; font-size:15px; font-weight:700; color:var(--primary); background:var(--surface-hover); margin:8px -20px; padding-left:20px; padding-right:20px;">
              <span>Gross Profit:</span>
              <span>${Utils.formatCurrency(res.grossProfit, currency)}</span>
            </div>
            
            <div style="margin-top:12px;">
              <div style="font-size:12px; font-weight:600; text-transform:uppercase; color:var(--text-muted); margin-bottom:8px;">Operating Expenses:</div>
              ${(exp.breakdown || []).map(e => `
                <div style="display:flex; justify-content:space-between; padding:4px 0; font-size:13px; color:var(--text-secondary);">
                  <span>${e.category} (${e.count} vouchers):</span>
                  <span>${Utils.formatCurrency(e.amount, currency)}</span>
                </div>
              `).join('')}
              <div style="display:flex; justify-content:space-between; padding:8px 0; font-weight:600; border-top:1px dashed var(--border); margin-top:8px;">
                <span>Total Operating Expenses:</span>
                <span style="color:var(--danger);">- ${Utils.formatCurrency(exp.total, currency)}</span>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; padding:14px 0; font-size:17px; font-weight:800; border-top:2px solid var(--text-primary); margin-top:16px;">
              <span>Net Operating Profit:</span>
              <span style="color:${res.netProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">${Utils.formatCurrency(res.netProfit, currency)}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      // Generic table fallback for other report endpoints
      innerHtml = Table.render({
        columns: Object.keys((res.rows && res.rows[0]) || {}).map(k => ({
          label: k.replace(/_/g, ' ').toUpperCase(),
          key: k,
          render: (val) => typeof val === 'number' ? Utils.formatCurrency(val, currency) : (val || '—')
        })),
        data: res.rows || []
      });
    }

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:14px; margin-bottom:20px;">
        <div>
          <h2 style="font-size:18px; font-weight:700; color:var(--text-primary);">${biz.name}</h2>
          <div style="font-size:12px; color:var(--text-secondary);">${title} • Period: ${Utils.formatDate(this.from)} to ${Utils.formatDate(this.to)}</div>
        </div>
        <div style="font-size:11px; color:var(--text-muted);">Generated on ${Utils.formatDate(Utils.todayISO())}</div>
      </div>
      ${innerHtml}
    `;
  },

  exportCurrentReport() {
    if (!this.reportData) return;
    const rows = this.reportData.rows || this.reportData.categories || [];
    Utils.exportToCSV(`report_${this.activeReport}`, rows);
  }
};

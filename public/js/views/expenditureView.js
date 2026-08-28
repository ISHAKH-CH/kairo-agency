/**
 * Ledgerly Expenditure Module
 */
const ExpenditureView = {
  expenses: [],
  summary: {},
  categories: [],
  search: '',
  selectedCategory: 'All',
  limit: 50,
  offset: 0,
  total: 0,

  async render() {
    Topbar.updateTitle('Expenditure', [{ label: 'Expenditure' }]);
    const contentEl = document.getElementById('app-content');

    contentEl.innerHTML = `
      <div class="content-container">
        <div style="display:flex; justify-content:center; padding: 40px; color:var(--text-muted);">
          Loading expenditure records...
        </div>
      </div>
    `;

    try {
      const [sumRes, expRes] = await Promise.all([
        API.get('/expenditures/summary'),
        API.get('/expenditures', {
          search: this.search,
          category: this.selectedCategory === 'All' ? '' : this.selectedCategory,
          limit: this.limit,
          offset: this.offset
        })
      ]);

      this.summary = sumRes.data || {};
      this.categories = sumRes.data?.categories || [];
      this.expenses = expRes.data || [];
      this.total = expRes.pagination?.total || 0;

      this.renderContent();
    } catch (e) {
      contentEl.innerHTML = `<div class="card" style="padding: 24px; color:var(--danger);">Error loading expenses: ${e.message}</div>`;
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
            <h1 style="font-size:20px; font-weight:700; color:var(--text-primary);">Expenditure</h1>
            <p style="font-size:13px; color:var(--text-secondary);">Track daily operating expenses, overhead costs, and vendor bills.</p>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="ExpenditureView.exportCSV()">Export CSV</button>
            <button class="btn btn-primary btn-sm" onclick="ExpenditureView.openExpenseModal()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>+ Add Expense</span>
            </button>
          </div>
        </div>

        <!-- KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-title">Total Expenses</span>
            <div class="kpi-value">${Utils.formatCurrency(this.summary.total_expenses || 0, currency)}</div>
            <div class="kpi-trend"><span class="text-muted">${this.summary.total_expenses_count || 0} recorded expenses</span></div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">This Month</span>
            <div class="kpi-value" style="color:var(--warning);">${Utils.formatCurrency(this.summary.this_month_expenses || 0, currency)}</div>
            <div class="kpi-trend"><span class="text-muted">Current calendar month</span></div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">Largest Expense</span>
            <div class="kpi-value">${Utils.formatCurrency(this.summary.largest_expense || 0, currency)}</div>
            <div class="kpi-trend"><span class="text-muted">Highest single item</span></div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">Pending Approvals</span>
            <div class="kpi-value">${Utils.formatCurrency(this.summary.pending_expenses || 0, currency)}</div>
            <div class="kpi-trend"><span class="text-muted">Unsettled vouchers</span></div>
          </div>
        </div>

        <!-- Filter Bar -->
        ${FilterBar.render({
          searchPlaceholder: 'Search expense #, description, vendor...',
          searchValue: this.search,
          onSearch: 'ExpenditureView.onSearch(this.value)',
          showDateFilter: false,
          statusOptions: [
            { value: 'All', label: 'All Categories' },
            ...this.categories.map(c => ({ value: c, label: c }))
          ],
          selectedStatus: this.selectedCategory,
          onStatusChange: 'ExpenditureView.onCategoryFilter(this.value)',
          showExport: false
        })}

        <!-- Expenses Table -->
        ${Table.render({
          columns: [
            { label: 'Date', key: 'expense_date', render: (val) => Utils.formatDate(val) },
            { label: 'Expense #', key: 'expense_number', render: (val) => `<strong style="color:var(--primary);">${val}</strong>` },
            { label: 'Category', key: 'category', render: (val) => `<span class="badge badge-neutral">${val}</span>` },
            { label: 'Description', key: 'description', render: (val, r) => `<div><strong>${val}</strong>${r.notes ? `<div style="font-size:11px; color:var(--text-muted);">${r.notes}</div>` : ''}</div>` },
            { label: 'Vendor / Payee', key: 'vendor', render: (val) => val || 'General' },
            { label: 'Amount', key: 'amount', align: 'right', render: (val) => `<span class="font-semibold">${Utils.formatCurrency(val, currency)}</span>` },
            { label: 'Payment Method', key: 'payment_method', render: (val) => `<span class="badge badge-info">${val}</span>` },
            { label: 'Status', key: 'status', render: (val) => Utils.renderStatusBadge(val) },
            {
              label: 'Actions',
              key: 'id',
              align: 'right',
              render: (val, r) => `
                <div class="table-actions">
                  <button class="btn btn-secondary btn-sm" onclick="ExpenditureView.openExpenseModal(${r.id})">Edit</button>
                  <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="ExpenditureView.deleteExpense(${r.id}, '${r.expense_number}')">✕</button>
                </div>
              `
            }
          ],
          data: this.expenses,
          emptyTitle: 'No expenses recorded',
          emptyMessage: 'Add your operational expenses (rent, utilities, salaries, marketing) to track costs.',
          emptyActionLabel: '+ Add Expense',
          onEmptyAction: 'ExpenditureView.openExpenseModal()',
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
    ExpenditureView.search = val;
    ExpenditureView.offset = 0;
    ExpenditureView.render();
  }, 250),

  onCategoryFilter(val) {
    this.selectedCategory = val;
    this.offset = 0;
    this.render();
  },

  exportCSV() {
    Utils.exportToCSV('expenditures', this.expenses.map(e => ({
      ExpenseNumber: e.expense_number,
      Date: e.expense_date,
      Category: e.category,
      Description: e.description,
      Vendor: e.vendor || '',
      Amount: e.amount,
      Tax: e.tax,
      PaymentMethod: e.payment_method,
      Status: e.status
    })));
  },

  async openExpenseModal(expenseId = null) {
    let exp = {
      expense_date: Utils.todayISO(),
      category: 'Office Supplies',
      description: '',
      vendor: '',
      amount: '',
      tax: 0,
      payment_method: 'Card',
      reference_number: '',
      notes: '',
      status: 'Paid'
    };

    if (expenseId) {
      try {
        const res = await API.get(`/expenditures/${expenseId}`);
        exp = res.data;
      } catch (e) { return; }
    }

    const isEdit = !!expenseId;
    const catOpts = (this.categories.length ? this.categories : [
      'Rent', 'Utilities', 'Salaries', 'Transportation', 'Office Supplies',
      'Marketing', 'Software', 'Maintenance', 'Travel', 'Other'
    ]).map(c => `<option value="${c}" ${c === exp.category ? 'selected' : ''}>${c}</option>`).join('');

    Modal.open({
      title: isEdit ? `Edit Expense: ${exp.expense_number}` : 'Add New Expense',
      size: 'md',
      bodyHtml: `
        <form id="expense-form" onsubmit="ExpenditureView.saveExpense(event, ${expenseId || 'null'})">
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Expense Date <span class="required">*</span></label>
              <input type="date" name="expense_date" class="form-control" value="${exp.expense_date || Utils.todayISO()}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Category <span class="required">*</span></label>
              <select name="category" class="form-control" required>
                ${catOpts}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Description <span class="required">*</span></label>
            <input type="text" name="description" class="form-control" placeholder="e.g. Monthly cloud hosting / DEWA electricity" value="${exp.description || ''}" required>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Vendor / Payee</label>
              <input type="text" name="vendor" class="form-control" placeholder="e.g. DEWA / Amazon AWS" value="${exp.vendor || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Amount <span class="required">*</span></label>
              <input type="number" step="0.01" name="amount" class="form-control" placeholder="0.00" value="${exp.amount || ''}" required>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Tax / VAT Amount</label>
              <input type="number" step="0.01" name="tax" class="form-control" placeholder="0.00" value="${exp.tax || 0}">
            </div>
            <div class="form-group">
              <label class="form-label">Payment Method</label>
              <select name="payment_method" class="form-control">
                <option value="Card" ${exp.payment_method === 'Card' ? 'selected' : ''}>Card</option>
                <option value="Bank Transfer" ${exp.payment_method === 'Bank Transfer' ? 'selected' : ''}>Bank Transfer</option>
                <option value="Cash" ${exp.payment_method === 'Cash' ? 'selected' : ''}>Cash</option>
                <option value="Cheque" ${exp.payment_method === 'Cheque' ? 'selected' : ''}>Cheque</option>
                <option value="Other" ${exp.payment_method === 'Other' ? 'selected' : ''}>Other</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Reference / Receipt Number</label>
            <input type="text" name="reference_number" class="form-control" placeholder="e.g. REC-99120" value="${exp.reference_number || ''}">
          </div>

          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea name="notes" class="form-control" placeholder="Optional notes...">${exp.notes || ''}</textarea>
          </div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-secondary btn-sm" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="document.getElementById('expense-form').requestSubmit()">${isEdit ? 'Update Expense' : 'Save Expense'}</button>
      `
    });
  },

  async saveExpense(event, expenseId) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const body = Object.fromEntries(formData.entries());

    try {
      if (expenseId) {
        await API.put(`/expenditures/${expenseId}`, body);
        Toast.success('Expense updated successfully');
      } else {
        await API.post('/expenditures', body);
        Toast.success('Expense recorded successfully');
      }
      Modal.close();
      this.render();
    } catch (e) {}
  },

  deleteExpense(expenseId, expenseNum) {
    Modal.open({
      title: 'Delete Expense',
      bodyHtml: `<p style="font-size:13.5px; color:var(--text-secondary);">Are you sure you want to delete expense record <strong>${expenseNum}</strong>?</p>`,
      footerHtml: `
        <button class="btn btn-secondary btn-sm" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-danger btn-sm" onclick="ExpenditureView.confirmDelete(${expenseId})">Delete</button>
      `
    });
  },

  async confirmDelete(expenseId) {
    try {
      await API.delete(`/expenditures/${expenseId}`);
      Toast.success('Expense deleted successfully');
      Modal.close();
      this.render();
    } catch (e) {}
  }
};

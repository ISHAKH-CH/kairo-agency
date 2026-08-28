/**
 * Ledgerly Settings & Audit Trail View
 */
const SettingsView = {
  business: {},
  user: {},
  auditLogs: [],
  activeTab: 'business',

  async render() {
    Topbar.updateTitle('Settings', [{ label: 'Settings' }]);
    const contentEl = document.getElementById('app-content');

    contentEl.innerHTML = `
      <div class="content-container">
        <div style="display:flex; justify-content:center; padding: 40px; color:var(--text-muted);">
          Loading settings...
        </div>
      </div>
    `;

    try {
      const [bizRes, logsRes] = await Promise.all([
        API.get('/settings/business'),
        API.get('/settings/audit-logs', { limit: 50 })
      ]);

      this.business = bizRes.business || {};
      this.user = bizRes.user || {};
      this.auditLogs = logsRes.data || [];

      this.renderContent();
    } catch (e) {
      contentEl.innerHTML = `<div class="card" style="padding: 24px; color:var(--danger);">Error loading settings: ${e.message}</div>`;
    }
  },

  renderContent() {
    const b = this.business;
    const contentEl = document.getElementById('app-content');

    contentEl.innerHTML = `
      <div class="content-container">
        <!-- Header -->
        <div>
          <h1 style="font-size:20px; font-weight:700; color:var(--text-primary);">Business Settings & Preferences</h1>
          <p style="font-size:13px; color:var(--text-secondary);">Configure company identity, currency, tax rates, appearance, and inspect security audit trails.</p>
        </div>

        <!-- Tab Strip -->
        <div class="tab-strip">
          <button class="tab-btn ${this.activeTab === 'business' ? 'active' : ''}" onclick="SettingsView.switchTab('business')">Company Profile</button>
          <button class="tab-btn ${this.activeTab === 'appearance' ? 'active' : ''}" onclick="SettingsView.switchTab('appearance')">Appearance & Theme</button>
          <button class="tab-btn ${this.activeTab === 'audit' ? 'active' : ''}" onclick="SettingsView.switchTab('audit')">Audit Logs (${this.auditLogs.length})</button>
          <button class="tab-btn ${this.activeTab === 'backup' ? 'active' : ''}" onclick="SettingsView.switchTab('backup')">Database Backup & Reset</button>
        </div>

        <!-- Tab Content -->
        ${this.renderTabBody()}
      </div>
    `;
  },

  switchTab(tab) {
    this.activeTab = tab;
    this.render();
  },

  renderTabBody() {
    const b = this.business;

    if (this.activeTab === 'appearance') {
      const currentTheme = State.theme;
      return `
        <div class="card" style="max-width:600px; padding:24px;">
          <h3 class="card-title" style="margin-bottom:16px;">Theme Preference</h3>
          <p style="font-size:13px; color:var(--text-secondary); margin-bottom:20px;">
            Choose your preferred interface theme. Ledgerly supports clean light mode and carefully designed dark mode.
          </p>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
            <div 
              class="card" 
              style="padding:16px; cursor:pointer; border:2px solid ${currentTheme === 'light' ? 'var(--primary)' : 'var(--border)'}; background:#ffffff; color:#0f172a;"
              onclick="State.setTheme('light'); SettingsView.render();"
            >
              <div style="font-weight:700; margin-bottom:4px;">☀️ Light Mode</div>
              <div style="font-size:12px; color:#64748b;">Clean, crisp white and slate tones inspired by modern SaaS interfaces.</div>
            </div>

            <div 
              class="card" 
              style="padding:16px; cursor:pointer; border:2px solid ${currentTheme === 'dark' ? 'var(--primary)' : 'var(--border)'}; background:#0f172a; color:#f8fafc;"
              onclick="State.setTheme('dark'); SettingsView.render();"
            >
              <div style="font-weight:700; margin-bottom:4px;">🌙 Dark Mode</div>
              <div style="font-size:12px; color:#94a3b8;">High contrast dark theme optimized for low light and eye comfort.</div>
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'audit') {
      return Table.render({
        columns: [
          { label: 'Timestamp', key: 'created_at', render: (val) => Utils.formatDate(val) + ' ' + (val ? val.split(' ')[1] || '' : '') },
          { label: 'Action', key: 'action', render: (val) => `<span class="badge badge-info">${val}</span>` },
          { label: 'Entity Type', key: 'entity_type', render: (val) => `<strong style="font-size:12px;">${val}</strong>` },
          { label: 'Entity ID', key: 'entity_id', render: (val) => val || '—' },
          { label: 'User', key: 'user_name', render: (val) => val || 'System' },
          {
            label: 'Details / Payload',
            key: 'new_values',
            render: (val) => `<code style="font-size:11px; max-width:300px; display:inline-block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${val || '—'}</code>`
          }
        ],
        data: this.auditLogs,
        emptyTitle: 'No audit logs recorded'
      });
    }

    if (this.activeTab === 'backup') {
      return `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; max-width:900px;">
          <!-- Backup Export -->
          <div class="card" style="padding:24px;">
            <h3 class="card-title" style="margin-bottom:12px;">Export Database Backup</h3>
            <p style="font-size:13px; color:var(--text-secondary); margin-bottom:20px;">
              Download a complete JSON backup of all tables, products, customers, invoices, purchases, payments, expenses, and audit logs.
            </p>
            <a href="/api/settings/export-backup" class="btn btn-secondary btn-sm" download>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Download JSON Backup</span>
            </a>
          </div>

          <!-- Reset to Seed -->
          <div class="card" style="padding:24px; border-color:var(--danger-border);">
            <h3 class="card-title" style="margin-bottom:12px; color:var(--danger);">Reset Demo Data</h3>
            <p style="font-size:13px; color:var(--text-secondary); margin-bottom:20px;">
              Restore the database to the clean initial demo seed state (Acme Trading LLC with sample 2026 transactions).
            </p>
            <button class="btn btn-danger btn-sm" onclick="SettingsView.resetDatabase()">
              <span>Reset Database to Demo Seed</span>
            </button>
          </div>
        </div>
      `;
    }

    // Default: Business Profile Tab
    return `
      <div class="card" style="max-width:760px; padding:24px;">
        <form id="business-settings-form" onsubmit="SettingsView.saveBusiness(event)">
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Business / Company Name <span class="required">*</span></label>
              <input type="text" name="name" class="form-control" value="${b.name || ''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Tax / VAT TRN Number</label>
              <input type="text" name="tax_number" class="form-control" value="${b.tax_number || ''}">
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" name="email" class="form-control" value="${b.email || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Phone Number</label>
              <input type="tel" name="phone" class="form-control" value="${b.phone || ''}">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Business Address (Printed on Invoices)</label>
            <textarea name="address" class="form-control">${b.address || ''}</textarea>
          </div>

          <div class="form-grid-3">
            <div class="form-group">
              <label class="form-label">Base Currency</label>
              <select name="currency" class="form-control">
                <option value="AED" ${b.currency === 'AED' ? 'selected' : ''}>AED — UAE Dirham</option>
                <option value="USD" ${b.currency === 'USD' ? 'selected' : ''}>USD — US Dollar</option>
                <option value="EUR" ${b.currency === 'EUR' ? 'selected' : ''}>EUR — Euro</option>
                <option value="GBP" ${b.currency === 'GBP' ? 'selected' : ''}>GBP — British Pound</option>
                <option value="SAR" ${b.currency === 'SAR' ? 'selected' : ''}>SAR — Saudi Riyal</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Business Timezone</label>
              <select name="timezone" class="form-control">
                <option value="Asia/Dubai" ${b.timezone === 'Asia/Dubai' ? 'selected' : ''}>Asia/Dubai (GST +04:00)</option>
                <option value="Asia/Riyadh" ${b.timezone === 'Asia/Riyadh' ? 'selected' : ''}>Asia/Riyadh (AST +03:00)</option>
                <option value="Europe/London" ${b.timezone === 'Europe/London' ? 'selected' : ''}>Europe/London (GMT)</option>
                <option value="America/New_York" ${b.timezone === 'America/New_York' ? 'selected' : ''}>America/New York (EST)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Date Format</label>
              <select name="date_format" class="form-control">
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; margin-top:20px;">
            <button type="submit" class="btn btn-primary btn-sm">Save Business Profile</button>
          </div>
        </form>
      </div>
    `;
  },

  async saveBusiness(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const body = Object.fromEntries(formData.entries());

    try {
      const res = await API.put('/settings/business', body);
      Toast.success(res.message);
      State.business = res.business;
      const nameEl = document.getElementById('topbar-business-name');
      if (nameEl) nameEl.textContent = res.business.name;
      this.render();
    } catch (e) {}
  },

  async resetDatabase() {
    if (!confirm('Are you sure you want to reset the database to initial demo state? All current records will be re-seeded.')) return;

    try {
      await API.post('/settings/reset-database');
      Toast.success('Database reset to demo seed data');
      window.location.hash = '#/dashboard';
      window.location.reload();
    } catch (e) {}
  }
};

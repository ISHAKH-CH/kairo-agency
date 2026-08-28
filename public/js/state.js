/**
 * Ledgerly Global State Management
 */
const State = {
  currentRoute: 'dashboard',
  business: {
    name: 'Acme Trading LLC',
    currency: 'AED',
    currency_symbol: 'AED',
    timezone: 'Asia/Dubai'
  },
  user: {
    name: 'John Doe',
    email: 'john@acmetrading.ae',
    role: 'admin'
  },
  theme: localStorage.getItem('ledgerly_theme') || 'light',
  dateFilter: 'month',
  customDateRange: { from: null, to: null },
  listeners: {},

  init() {
    this.applyTheme(this.theme);
    this.loadBusinessProfile();
  },

  async loadBusinessProfile() {
    try {
      const res = await API.get('/settings/business');
      if (res.business) {
        this.business = res.business;
        const nameEl = document.getElementById('topbar-business-name');
        if (nameEl) nameEl.textContent = res.business.name;
      }
      if (res.user) {
        this.user = res.user;
        const initEl = document.getElementById('user-avatar-initials');
        if (initEl) {
          const parts = res.user.name.split(' ');
          initEl.textContent = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0][0];
        }
      }
    } catch (e) {
      console.warn('Failed to load business profile:', e);
    }
  },

  setTheme(theme) {
    this.theme = theme;
    localStorage.setItem('ledgerly_theme', theme);
    this.applyTheme(theme);
    this.emit('themeChange', theme);
  },

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const labelEl = document.getElementById('theme-toggle-label');
    const iconWrapper = document.getElementById('theme-icon-wrapper');
    if (labelEl) {
      labelEl.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
    }
    if (iconWrapper) {
      iconWrapper.innerHTML = theme === 'dark'
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
    }
  },

  toggleTheme() {
    this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
  },

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  },

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }
};

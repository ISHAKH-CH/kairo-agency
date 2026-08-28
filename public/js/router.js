/**
 * Ledgerly Client-Side Hash Router
 */
const Router = {
  routes: {
    'dashboard': () => DashboardView.render(),
    'stock': () => StockView.render(),
    'purchases': () => PurchasesView.render(),
    'quotations': () => QuotationsView.render(),
    'sales': () => SalesView.render(),
    'reports': () => ReportsView.render(),
    'customers': (param) => CustomersView.render(param),
    'payments': () => PaymentsView.render(),
    'expenditure': () => ExpenditureView.render(),
    'settings': () => SettingsView.render()
  },

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  },

  handleRoute() {
    const hash = window.location.hash.replace('#/', '').trim() || 'dashboard';
    const parts = hash.split('/');
    const mainRoute = parts[0];
    const param = parts[1] || null;

    State.currentRoute = mainRoute;
    Sidebar.setActive(mainRoute);

    const handler = this.routes[mainRoute];
    if (typeof handler === 'function') {
      handler(param);
    } else {
      window.location.hash = '#/dashboard';
    }
  }
};

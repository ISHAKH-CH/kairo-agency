/**
 * Ledgerly Application Entry & Global Dispatcher
 */
const App = {
  init() {
    console.log('--- Initializing Ledgerly App ---');

    // 1. Initialize State & Theme
    State.init();

    // 2. Initialize Core Components
    Sidebar.init();
    Topbar.init();
    SearchModal.init();
    Modal.init();
    Drawer.init();

    // 3. Global Escape key handler
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        Modal.close();
        Drawer.close();
        SearchModal.close();
      }
    });

    // 4. Initialize Router
    Router.init();
  },

  // Global Quick Action Shortcuts
  openCreateSaleModal(customerId = null) {
    SalesView.openNewSaleModal(customerId);
  },

  openCreatePurchaseModal() {
    PurchasesView.openNewPurchaseModal();
  },

  openCreateQuotationModal() {
    QuotationsView.openNewQuotationModal();
  },

  openCreateCustomerModal() {
    CustomersView.openCustomerModal();
  },

  openRecordPaymentModal(prefill = {}) {
    PaymentsView.openRecordPaymentModal(prefill);
  },

  openCreateExpenseModal() {
    ExpenditureView.openExpenseModal();
  },

  // Global Pagination handlers
  prevPage() {
    const route = State.currentRoute;
    if (route === 'stock' && StockView.offset > 0) {
      StockView.offset = Math.max(0, StockView.offset - StockView.limit);
      StockView.render();
    } else if (route === 'sales' && SalesView.offset > 0) {
      SalesView.offset = Math.max(0, SalesView.offset - SalesView.limit);
      SalesView.render();
    } else if (route === 'purchases' && PurchasesView.offset > 0) {
      PurchasesView.offset = Math.max(0, PurchasesView.offset - PurchasesView.limit);
      PurchasesView.render();
    } else if (route === 'customers' && CustomersView.offset > 0) {
      CustomersView.offset = Math.max(0, CustomersView.offset - CustomersView.limit);
      CustomersView.render();
    } else if (route === 'payments' && PaymentsView.offset > 0) {
      PaymentsView.offset = Math.max(0, PaymentsView.offset - PaymentsView.limit);
      PaymentsView.render();
    } else if (route === 'expenditure' && ExpenditureView.offset > 0) {
      ExpenditureView.offset = Math.max(0, ExpenditureView.offset - ExpenditureView.limit);
      ExpenditureView.render();
    }
  },

  nextPage() {
    const route = State.currentRoute;
    if (route === 'stock') {
      StockView.offset += StockView.limit;
      StockView.render();
    } else if (route === 'sales') {
      SalesView.offset += SalesView.limit;
      SalesView.render();
    } else if (route === 'purchases') {
      PurchasesView.offset += PurchasesView.limit;
      PurchasesView.render();
    } else if (route === 'customers') {
      CustomersView.offset += CustomersView.limit;
      CustomersView.render();
    } else if (route === 'payments') {
      PaymentsView.offset += PaymentsView.limit;
      PaymentsView.render();
    } else if (route === 'expenditure') {
      ExpenditureView.offset += ExpenditureView.limit;
      ExpenditureView.render();
    }
  }
};

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

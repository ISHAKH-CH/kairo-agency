/**
 * Ledgerly Sidebar Component
 */
const Sidebar = {
  sidebarEl: null,
  mobileOverlay: null,

  init() {
    this.sidebarEl = document.getElementById('sidebar');
    this.mobileOverlay = document.getElementById('mobile-overlay');

    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleCollapse());
    }

    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => State.toggleTheme());
    }

    if (this.mobileOverlay) {
      this.mobileOverlay.addEventListener('click', () => this.closeMobile());
    }
  },

  toggleCollapse() {
    if (this.sidebarEl) {
      this.sidebarEl.classList.toggle('collapsed');
    }
  },

  openMobile() {
    if (this.sidebarEl) {
      this.sidebarEl.classList.add('mobile-open');
    }
    if (this.mobileOverlay) {
      this.mobileOverlay.classList.add('active');
    }
  },

  closeMobile() {
    if (this.sidebarEl) {
      this.sidebarEl.classList.remove('mobile-open');
    }
    if (this.mobileOverlay) {
      this.mobileOverlay.classList.remove('active');
    }
  },

  setActive(route) {
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      if (item.dataset.route === route) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Close mobile drawer upon navigating
    this.closeMobile();
  }
};

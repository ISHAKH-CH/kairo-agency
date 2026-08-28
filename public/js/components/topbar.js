/**
 * Ledgerly Top Navigation Bar
 */
const Topbar = {
  init() {
    const searchTrigger = document.getElementById('global-search-trigger');
    if (searchTrigger) {
      searchTrigger.addEventListener('click', () => SearchModal.open());
    }

    const mobileBtn = document.getElementById('mobile-menu-btn');
    if (mobileBtn) {
      mobileBtn.addEventListener('click', () => Sidebar.openMobile());
    }

    const quickBtn = document.getElementById('quick-action-btn');
    const quickMenu = document.getElementById('quick-action-menu');
    if (quickBtn && quickMenu) {
      quickBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        quickMenu.style.display = quickMenu.style.display === 'none' ? 'block' : 'none';
      });

      document.addEventListener('click', () => {
        quickMenu.style.display = 'none';
      });
    }

    const bizPill = document.getElementById('business-pill');
    if (bizPill) {
      bizPill.addEventListener('click', () => {
        window.location.hash = '#/settings';
      });
    }

    const userPill = document.getElementById('user-profile-pill');
    if (userPill) {
      userPill.addEventListener('click', () => {
        window.location.hash = '#/settings';
      });
    }
  },

  updateTitle(title, breadcrumbs = []) {
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = title;

    const bcEl = document.getElementById('breadcrumbs');
    if (bcEl) {
      let html = '<a href="#/dashboard">Home</a>';
      for (const bc of breadcrumbs) {
        html += ` <span>/</span> ${bc.url ? `<a href="${bc.url}">${bc.label}</a>` : `<span>${bc.label}</span>`}`;
      }
      bcEl.innerHTML = html;
    }
  }
};

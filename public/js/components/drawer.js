/**
 * Ledgerly Slide-over Drawer Manager
 */
const Drawer = {
  backdrop: null,
  drawer: null,
  titleEl: null,
  bodyEl: null,
  footerEl: null,

  init() {
    this.backdrop = document.getElementById('drawer-backdrop');
    this.drawer = document.getElementById('side-drawer');
    this.titleEl = document.getElementById('side-drawer-title');
    this.bodyEl = document.getElementById('side-drawer-body');
    this.footerEl = document.getElementById('side-drawer-footer');

    if (this.backdrop) {
      this.backdrop.addEventListener('click', (e) => {
        if (e.target === this.backdrop) {
          this.close();
        }
      });
    }
  },

  open({ title, bodyHtml, footerHtml = '', size = 'md' }) {
    if (!this.backdrop) this.init();

    this.titleEl.textContent = title;
    this.bodyEl.innerHTML = bodyHtml;
    this.footerEl.innerHTML = footerHtml;

    if (size === 'lg') {
      this.drawer.classList.add('drawer-lg');
    } else {
      this.drawer.classList.remove('drawer-lg');
    }

    this.backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  close() {
    if (this.backdrop) {
      this.backdrop.classList.remove('active');
      document.body.style.overflow = '';
    }
  }
};

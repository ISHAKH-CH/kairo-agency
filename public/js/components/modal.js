/**
 * Ledgerly Modal Manager
 */
const Modal = {
  backdrop: null,
  card: null,
  titleEl: null,
  bodyEl: null,
  footerEl: null,

  init() {
    this.backdrop = document.getElementById('app-modal');
    this.card = document.getElementById('app-modal-card');
    this.titleEl = document.getElementById('app-modal-title');
    this.bodyEl = document.getElementById('app-modal-body');
    this.footerEl = document.getElementById('app-modal-footer');

    // Click outside to close
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
      this.card.classList.add('modal-lg');
    } else {
      this.card.classList.remove('modal-lg');
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

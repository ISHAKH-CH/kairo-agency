/**
 * Ledgerly Spotlight Global Search Modal (⌘K / Ctrl+K)
 */
const SearchModal = {
  backdrop: null,
  input: null,
  resultsContainer: null,
  selectedIndex: 0,
  items: [],

  init() {
    this.backdrop = document.getElementById('global-search-modal');
    this.input = document.getElementById('spotlight-search-input');
    this.resultsContainer = document.getElementById('spotlight-search-results');

    if (!this.backdrop || !this.input) return;

    // Close on backdrop click
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });

    // Input search handler
    this.input.addEventListener('input', Utils.debounce(() => this.search(), 200));

    // Keyboard navigation
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.moveSelection(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.moveSelection(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.activateSelected();
      }
    });

    // Global keyboard shortcut: Cmd+K or Ctrl+K
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        this.toggle();
      }
    });
  },

  open() {
    if (!this.backdrop) this.init();
    this.backdrop.classList.add('active');
    this.input.value = '';
    this.input.focus();
    this.resultsContainer.innerHTML = '<div style="padding: 24px; text-align:center; color:var(--text-muted); font-size:13px;">Type to search across all business records...</div>';
  },

  close() {
    if (this.backdrop) {
      this.backdrop.classList.remove('active');
    }
  },

  toggle() {
    if (this.backdrop && this.backdrop.classList.contains('active')) {
      this.close();
    } else {
      this.open();
    }
  },

  async search() {
    const query = this.input.value.trim();
    if (!query) {
      this.resultsContainer.innerHTML = '<div style="padding: 24px; text-align:center; color:var(--text-muted); font-size:13px;">Search across Customers, Products, Invoices, Purchases, Quotations, and Expenses.</div>';
      return;
    }

    try {
      const res = await API.get('/search', { q: query });
      this.items = res.results || [];
      this.selectedIndex = 0;
      this.renderResults();
    } catch (e) {
      this.resultsContainer.innerHTML = `<div style="padding: 16px; color:var(--danger);">Error searching: ${e.message}</div>`;
    }
  },

  renderResults() {
    if (!this.items.length) {
      this.resultsContainer.innerHTML = '<div style="padding: 24px; text-align:center; color:var(--text-muted); font-size:13px;">No results found matching your query.</div>';
      return;
    }

    // Group items by type
    const groups = {};
    this.items.forEach((item, index) => {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push({ ...item, globalIndex: index });
    });

    let html = '';
    for (const [type, list] of Object.entries(groups)) {
      html += `<div class="spotlight-group-title">${type}s</div>`;
      for (const item of list) {
        const isSelected = item.globalIndex === this.selectedIndex;
        html += `
          <a href="${item.url}" class="spotlight-item ${isSelected ? 'selected' : ''}" onclick="SearchModal.close()">
            <div class="spotlight-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
            <div class="spotlight-item-content">
              <div class="spotlight-item-title">${item.title}</div>
              <div class="spotlight-item-sub">${item.subtitle}</div>
            </div>
          </a>
        `;
      }
    }

    this.resultsContainer.innerHTML = html;
  },

  moveSelection(delta) {
    if (!this.items.length) return;
    this.selectedIndex = (this.selectedIndex + delta + this.items.length) % this.items.length;
    this.renderResults();
  },

  activateSelected() {
    if (this.items[this.selectedIndex]) {
      const url = this.items[this.selectedIndex].url;
      window.location.hash = url.replace('#', '');
      this.close();
    }
  }
};

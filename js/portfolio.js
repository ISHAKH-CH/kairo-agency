/* ==========================================================================
   KAIRO DESIGN BUREAU — PORTFOLIO FILTERING & CASE STUDY SYSTEM
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const workCards = document.querySelectorAll('.work-card');
  const searchInput = document.querySelector('.search-input');

  // Filter Projects by Category
  if (filterButtons.length > 0 && workCards.length > 0) {
    filterButtons.forEach(button => {
      button.addEventListener('click', () => {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        const filterCategory = button.getAttribute('data-filter')?.toLowerCase();
        applyFilterAndSearch();
      });
    });
  }

  // Filter Projects by Search Input
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      applyFilterAndSearch();
    });
  }

  function applyFilterAndSearch() {
    const activeBtn = document.querySelector('.filter-btn.active');
    const filterCategory = activeBtn ? activeBtn.getAttribute('data-filter')?.toLowerCase() : 'all';
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    workCards.forEach(card => {
      const cardCategory = card.getAttribute('data-category')?.toLowerCase() || '';
      const cardTitle = card.querySelector('.work-title')?.textContent.toLowerCase() || '';
      const cardDesc = card.querySelector('.work-desc')?.textContent.toLowerCase() || '';
      const cardClient = card.querySelector('.work-client-meta')?.textContent.toLowerCase() || '';

      const matchesCategory = filterCategory === 'all' || cardCategory.includes(filterCategory);
      const matchesSearch = !searchTerm || cardTitle.includes(searchTerm) || cardDesc.includes(searchTerm) || cardClient.includes(searchTerm);

      if (matchesCategory && matchesSearch) {
        card.style.display = 'flex';
        setTimeout(() => {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        }, 10);
      } else {
        card.style.opacity = '0';
        card.style.transform = 'translateY(15px)';
        setTimeout(() => {
          card.style.display = 'none';
        }, 200);
      }
    });
  }
});

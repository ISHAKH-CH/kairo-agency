/**
 * Ledgerly Reusable Filter Bar Component
 */
const FilterBar = {
  render({
    searchPlaceholder = 'Search records...',
    searchValue = '',
    onSearch = 'App.onFilterSearch(this.value)',
    showDateFilter = true,
    datePresets = [
      { id: 'all', label: 'All Dates' },
      { id: 'today', label: 'Today' },
      { id: 'week', label: 'This Week' },
      { id: 'month', label: 'This Month' },
      { id: 'last_month', label: 'Last Month' },
      { id: 'year', label: 'This Year' }
    ],
    selectedDatePreset = 'month',
    onDatePresetChange = 'App.onDateFilterChange(this.value)',
    statusOptions = null,
    selectedStatus = 'All',
    onStatusChange = 'App.onStatusFilterChange(this.value)',
    primaryActionLabel = null,
    onPrimaryAction = null,
    secondaryActionLabel = null,
    onSecondaryAction = null,
    showExport = true,
    onExport = 'App.onExportCSV()'
  }) {
    let dateFilterHtml = '';
    if (showDateFilter) {
      const opts = datePresets.map(dp => `
        <option value="${dp.id}" ${dp.id === selectedDatePreset ? 'selected' : ''}>${dp.label}</option>
      `).join('');
      dateFilterHtml = `
        <select class="filter-select" onchange="${onDatePresetChange}">
          ${opts}
        </select>
      `;
    }

    let statusFilterHtml = '';
    if (statusOptions && statusOptions.length) {
      const opts = statusOptions.map(st => `
        <option value="${st.value || st}" ${(st.value || st) === selectedStatus ? 'selected' : ''}>${st.label || st}</option>
      `).join('');
      statusFilterHtml = `
        <select class="filter-select" onchange="${onStatusChange}">
          ${opts}
        </select>
      `;
    }

    return `
      <div class="filter-bar">
        <div class="filter-left">
          <div class="search-input-wrapper">
            <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" placeholder="${searchPlaceholder}" value="${searchValue || ''}" oninput="${onSearch}">
          </div>
          ${dateFilterHtml}
          ${statusFilterHtml}
        </div>
        <div class="filter-right">
          ${showExport ? `
            <button class="btn btn-secondary btn-sm" onclick="${onExport}" title="Export as CSV">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Export</span>
            </button>
          ` : ''}
          ${secondaryActionLabel ? `
            <button class="btn btn-secondary btn-sm" onclick="${onSecondaryAction}">${secondaryActionLabel}</button>
          ` : ''}
          ${primaryActionLabel ? `
            <button class="btn btn-primary btn-sm" onclick="${onPrimaryAction}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>${primaryActionLabel}</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }
};

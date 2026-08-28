/**
 * Ledgerly Dynamic Data Table Component
 */
const Table = {
  render({
    columns = [],
    data = [],
    keyField = 'id',
    emptyTitle = 'No records found',
    emptyMessage = 'There are no records matching your criteria.',
    emptyActionLabel = null,
    onEmptyAction = null,
    pagination = null
  }) {
    if (!data || data.length === 0) {
      return `
        <div class="card">
          <div class="empty-state">
            <div class="empty-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
            </div>
            <h4 class="empty-title">${emptyTitle}</h4>
            <p class="empty-desc">${emptyMessage}</p>
            ${emptyActionLabel ? `<button class="btn btn-primary btn-sm" onclick="${onEmptyAction}">${emptyActionLabel}</button>` : ''}
          </div>
        </div>
      `;
    }

    const thead = columns.map(col => {
      const alignClass = col.align === 'right' ? 'text-right' : (col.align === 'center' ? 'text-center' : '');
      return `<th class="${alignClass}">${col.label}</th>`;
    }).join('');

    const tbody = data.map(row => {
      const cells = columns.map(col => {
        const alignClass = col.align === 'right' ? 'text-right' : (col.align === 'center' ? 'text-center' : '');
        let content = '';
        if (typeof col.render === 'function') {
          content = col.render(row[col.key], row);
        } else {
          content = row[col.key] !== undefined && row[col.key] !== null ? row[col.key] : '—';
        }
        return `<td class="${alignClass}">${content}</td>`;
      }).join('');

      return `<tr>${cells}</tr>`;
    }).join('');

    let paginationHtml = '';
    if (pagination && pagination.total > 0) {
      const from = pagination.offset + 1;
      const to = Math.min(pagination.offset + pagination.limit, pagination.total);
      paginationHtml = `
        <div class="table-footer">
          <div>Showing <strong>${from}</strong> to <strong>${to}</strong> of <strong>${pagination.total}</strong> records</div>
          <div class="pagination-controls">
            <button class="btn btn-secondary btn-sm" ${pagination.offset === 0 ? 'disabled' : ''} onclick="App.prevPage()">Previous</button>
            <button class="btn btn-secondary btn-sm" ${to >= pagination.total ? 'disabled' : ''} onclick="App.nextPage()">Next</button>
          </div>
        </div>
      `;
    }

    return `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>${thead}</tr>
          </thead>
          <tbody>
            ${tbody}
          </tbody>
        </table>
        ${paginationHtml}
      </div>
    `;
  }
};

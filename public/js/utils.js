/**
 * Ledgerly Utility Functions
 */
const Utils = {
  formatCurrency(amount, currency = 'AED') {
    const num = Number(amount) || 0;
    const formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${currency} ${formatted}`;
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      // If date is YYYY-MM-DD
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${day} ${months[monthIndex]} ${year}`;
      }
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  },

  todayISO() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  futureDateISO(daysAhead = 15) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  renderStatusBadge(status) {
    const s = String(status || 'Normal').trim();
    let badgeClass = 'badge-neutral';

    switch (s.toLowerCase()) {
      case 'paid':
      case 'active':
      case 'received':
      case 'in stock':
      case 'accepted':
      case 'converted':
        badgeClass = 'badge-success';
        break;
      case 'pending':
      case 'partially paid':
      case 'low stock':
      case 'sent':
        badgeClass = 'badge-warning';
        break;
      case 'overdue':
      case 'out of stock':
      case 'rejected':
      case 'cancelled':
      case 'void':
        badgeClass = 'badge-danger';
        break;
      case 'draft':
      case 'expired':
      default:
        badgeClass = 'badge-neutral';
        break;
    }

    return `<span class="badge ${badgeClass}"><span class="badge-dot"></span>${s}</span>`;
  },

  debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  exportToCSV(filename, rows) {
    if (!rows || !rows.length) {
      Toast.info('No records available to export.');
      return;
    }

    const keys = Object.keys(rows[0]);
    const header = keys.map(k => `"${k.replace(/"/g, '""')}"`).join(',');
    const csvLines = [header];

    for (const row of rows) {
      const values = keys.map(k => {
        const val = row[k] === null || row[k] === undefined ? '' : String(row[k]);
        return `"${val.replace(/"/g, '""')}"`;
      });
      csvLines.push(values.join(','));
    }

    const csvContent = '\uFEFF' + csvLines.join('\n'); // Add UTF-8 BOM
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${this.todayISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    Toast.success('Export downloaded successfully.');
  },

  printDocument(elementId) {
    window.print();
  }
};

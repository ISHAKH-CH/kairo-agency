/**
 * Ledgerly Lightweight SVG Chart Component
 * High performance, zero dependency, dark/light adaptive
 */
const Charts = {
  renderBarChart({
    data = [],
    height = 200,
    primaryColor = '#2563eb',
    paidColor = '#16a34a'
  }) {
    if (!data || data.length === 0) {
      return '<div style="display:flex; align-items:center; justify-content:center; height:200px; color:var(--text-muted);">No chart data available</div>';
    }

    const maxVal = Math.max(...data.map(d => Math.max(d.sales_amount || 0, d.paid_amount || 0)), 1000);
    const paddingBottom = 30;
    const paddingTop = 20;
    const chartHeight = height - paddingBottom - paddingTop;
    const width = 800;
    const barGroupWidth = width / data.length;
    const barWidth = Math.max(6, Math.min(24, barGroupWidth * 0.35));

    let barsSvg = '';
    let labelsSvg = '';
    let gridSvg = '';

    // Horizontal grid lines
    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const y = paddingTop + (chartHeight / gridSteps) * i;
      const val = Math.round(maxVal - (maxVal / gridSteps) * i);
      gridSvg += `
        <line x1="40" y1="${y}" x2="${width}" y2="${y}" stroke="var(--border)" stroke-dasharray="3,3" stroke-width="1" />
        <text x="35" y="${y + 4}" font-size="10" fill="var(--text-muted)" text-anchor="end">${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}</text>
      `;
    }

    data.forEach((item, idx) => {
      const xCenter = 50 + idx * ((width - 70) / (data.length - 1 || 1));
      const salesH = ((item.sales_amount || 0) / maxVal) * chartHeight;
      const paidH = ((item.paid_amount || 0) / maxVal) * chartHeight;

      const salesY = paddingTop + chartHeight - salesH;
      const paidY = paddingTop + chartHeight - paidH;

      // Group bars
      barsSvg += `
        <g class="chart-bar-group" data-label="${item.label}" data-sales="${item.sales_amount || 0}" data-paid="${item.paid_amount || 0}">
          <!-- Sales Bar -->
          <rect x="${xCenter - barWidth - 2}" y="${salesY}" width="${barWidth}" height="${salesH}" fill="${primaryColor}" rx="3" opacity="0.85">
            <title>${item.label}: Sales AED ${(item.sales_amount || 0).toLocaleString()}</title>
          </rect>
          <!-- Paid Bar -->
          <rect x="${xCenter + 2}" y="${paidY}" width="${barWidth}" height="${paidH}" fill="${paidColor}" rx="3" opacity="0.85">
            <title>${item.label}: Paid AED ${(item.paid_amount || 0).toLocaleString()}</title>
          </rect>
        </g>
      `;

      // Show step labels
      if (data.length <= 12 || idx % Math.ceil(data.length / 8) === 0) {
        labelsSvg += `
          <text x="${xCenter}" y="${height - 8}" font-size="11" fill="var(--text-secondary)" text-anchor="middle">${item.label}</text>
        `;
      }
    });

    return `
      <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:100%; overflow:visible;">
        ${gridSvg}
        ${barsSvg}
        ${labelsSvg}
      </svg>
    `;
  }
};

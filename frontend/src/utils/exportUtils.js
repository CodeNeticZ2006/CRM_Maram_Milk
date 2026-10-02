import * as XLSX from 'xlsx';

/**
 * Clean & robust Excel export (.xlsx) using SheetJS XLSX library.
 * Writes report title, filter metadata, blank separator line, table headers, and data rows.
 */
export const exportToExcel = ({
  fileName,
  sheetName = 'Report',
  reportTitle,
  filterInfo,
  headers,
  rows,
}) => {
  const data = [];

  if (reportTitle) {
    data.push([reportTitle.toUpperCase()]);
  }
  if (filterInfo) {
    data.push([`Filters / Period: ${filterInfo}`]);
  }
  if (reportTitle || filterInfo) {
    data.push([]); // blank separator row
  }

  // Header row
  data.push(headers);

  // Data rows
  rows.forEach(row => {
    data.push(row);
  });

  // Create worksheet & workbook
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Calculate dynamic column widths
  const colWidths = headers.map((h, colIdx) => {
    let maxLen = String(h || '').length;
    rows.forEach(r => {
      const val = String(r[colIdx] ?? '');
      if (val.length > maxLen) maxLen = val.length;
    });
    return { wch: Math.min(Math.max(maxLen + 4, 12), 65) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const cleanFileName = (fileName || 'report').replace(/[^a-zA-Z0-9_\-]/g, '_');
  XLSX.writeFile(workbook, `${cleanFileName}.xlsx`);
};

/**
 * Delivery-Boy-Wise Excel export (.xlsx) using SheetJS XLSX library.
 * Groups data by Delivery Boy and outputs organized sections with headers, customer rows, and totals per Delivery Boy.
 */
export const exportToExcelDeliveryBoyWise = ({
  fileName,
  sheetName = 'Delivery Boy Wise',
  reportTitle = 'DAILY PLANNER - DELIVERY BOY WISE',
  filterInfo,
  rows,
}) => {
  const data = [];

  // Header Title & Filter Meta
  data.push([reportTitle.toUpperCase()]);
  if (filterInfo) {
    data.push([`Filters / Period: ${filterInfo}`]);
  }
  data.push([]); // blank separator

  // Group rows by Delivery Boy
  const groups = {};
  rows.forEach(r => {
    const dp = r.delivery_boy || 'Unassigned / Direct';
    if (!groups[dp]) {
      groups[dp] = {
        delivery_boy: dp,
        items: [],
      };
    }
    groups[dp].items.push(r);
  });

  const headers = ['Customer Code', 'Customer Name', 'Address', 'Mobile', 'Hub', 'Delivery Boy', 'Mode', 'Product', 'Product Qty', 'Type', 'Delivery Type'];

  Object.keys(groups).sort().forEach(dpName => {
    const group = groups[dpName];
    
    // Header section for Delivery Boy
    data.push([`DELIVERY BOY: ${dpName.toUpperCase()}`]);
    data.push(headers);

    let totalQty = 0;

    group.items.forEach(r => {
      const qtyNum = parseFloat(r.product_qty) || 0;
      totalQty += qtyNum;
      data.push([
        r.customer_code || '',
        r.customer_name || '',
        r.address || '',
        r.mobile || '',
        r.hub || '',
        r.delivery_boy || '',
        r.mode || '',
        r.product || '',
        r.product_qty || '',
        r.type || '',
        r.delivery_type || '',
      ]);
    });

    // Subtotal row for Delivery Boy
    data.push(['Total Deliveries', `${group.items.length} Customers`, '', '', '', '', '', '', totalQty, '', '']);
    data.push([]); // blank separator between delivery boys
  });

  // Create Worksheet & Workbook
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Auto column widths
  const colWidths = headers.map((h, colIdx) => {
    let maxLen = String(h || '').length;
    rows.forEach(r => {
      const val = String(r[colIdx] ?? '');
      if (val.length > maxLen) maxLen = val.length;
    });
    return { wch: Math.min(Math.max(maxLen + 4, 12), 65) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const cleanFileName = (fileName || 'Daily_Planner_Delivery_Boy_Wise').replace(/[^a-zA-Z0-9_\-]/g, '_');
  XLSX.writeFile(workbook, `${cleanFileName}.xlsx`);
};

/**
 * Clean & robust PDF export using printable landscape window.
 */
export const exportToPDF = ({
  reportTitle,
  filterInfo,
  headers,
  rows,
  totalRecords,
  summaryHtml,
}) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Popup blocked! Please allow popups to generate PDF report.');
  }

  const tableHeadersHtml = headers.map(h => `<th>${h}</th>`).join('');
  const tableRowsHtml = rows.map((row, idx) => {
    const cells = row.map(cell => {
      const str = String(cell ?? '');
      const isNum = !isNaN(str) && str.trim() !== '' && !str.includes('-') && !str.includes(':');
      return `<td style="${isNum ? 'text-align: right;' : ''}">${str.replace(/</g, '&lt;')}</td>`;
    }).join('');
    return `<tr style="${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">${cells}</tr>`;
  }).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${reportTitle} - Maram Milk CRM</title>
      <style>
        @page {
          size: landscape;
          margin: 10mm;
        }
        @media print {
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 10px;
          color: #1e293b;
          margin: 0;
          padding: 16px;
        }
        .header {
          border-bottom: 2px solid #3b82f6;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .title {
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.4px;
        }
        .meta {
          font-size: 10.5px;
          color: #64748b;
          margin-top: 4px;
          font-weight: 500;
        }
        .summary-box {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 12px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 6px;
        }
        th {
          background: #f1f5f9;
          color: #334155;
          font-weight: 700;
          text-align: left;
          padding: 7px 9px;
          border: 1px solid #cbd5e1;
          font-size: 9.5px;
          text-transform: uppercase;
        }
        td {
          padding: 6.5px 9px;
          border: 1px solid #e2e8f0;
          font-size: 9.5px;
          vertical-align: top;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .footer {
          margin-top: 16px;
          font-size: 9px;
          color: #94a3b8;
          display: flex;
          justify-content: space-between;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">MARAM MILK CRM — ${reportTitle}</div>
        <div class="meta">${filterInfo ? filterInfo + ' | ' : ''}Generated: ${new Date().toLocaleString('en-IN')} | Total Records: ${totalRecords || rows.length}</div>
      </div>
      ${summaryHtml ? `<div class="summary-box">${summaryHtml}</div>` : ''}
      <table>
        <thead>
          <tr>${tableHeadersHtml}</tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
      <div class="footer">
        <span>Maram Milk SuperAdmin CRM Report</span>
      </div>
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

/**
 * Export Delivery Planner to Excel (.xlsx)
 * Filename: Delivery_Planner_<CustomerID>_<YYYY-MM>.xlsx
 */
export const exportDeliveryPlannerExcel = ({
  customerCode,
  customerName,
  monthName,
  year,
  monthStr, // YYYY-MM
  days,
}) => {
  const data = [];

  // Metadata block
  data.push(['DELIVERY PLANNER REPORT']);
  data.push([`Customer Name: ${customerName}`]);
  data.push([`Customer ID: ${customerCode}`]);
  data.push([`Month: ${monthName}`]);
  data.push([`Year: ${year}`]);
  data.push([]); // blank separator

  // Table headers
  const headers = ['Date', 'Day', 'Status', 'Delivery Type / Product Information', 'Quantity'];
  data.push(headers);

  // Table rows
  days.forEach(d => {
    data.push([
      d.formattedDate,
      d.dayName,
      d.status,
      d.product || '-',
      d.quantity || '-',
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Auto column widths
  const colWidths = [
    { wch: 16 }, // Date
    { wch: 14 }, // Day
    { wch: 20 }, // Status
    { wch: 35 }, // Product Info
    { wch: 12 }, // Quantity
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Delivery Planner');

  const cleanCustomerId = (customerCode || 'CUSTOMER').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const fileName = `Delivery_Planner_${cleanCustomerId}_${monthStr}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

/**
 * Export Delivery Planner to PDF (via print dialog)
 * Filename: Delivery_Planner_<CustomerID>_<YYYY-MM>.pdf
 */
export const exportDeliveryPlannerPDF = ({
  customerCode,
  customerName,
  monthName,
  year,
  monthStr, // YYYY-MM
  days,
}) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to download/print the PDF report.');
    return;
  }

  // Generate table rows HTML
  const tableRowsHtml = days.map(d => {
    let statusColor = '#334155';
    let statusBg = '#f1f5f9';
    let badgeIcon = '';

    if (d.status === 'Mark Delivered') {
      statusColor = '#15803d';
      statusBg = '#dcfce7';
      badgeIcon = '✅ ';
    } else if (d.status === 'AdHoc') {
      statusColor = '#166534';
      statusBg = '#f0fdf4';
      badgeIcon = '🟢 ';
    } else if (d.status === 'Pause') {
      statusColor = '#991b1b';
      statusBg = '#fee2e2';
      badgeIcon = '🔴 ';
    } else if (d.status === 'Daily Delivery') {
      statusColor = '#854d0e';
      statusBg = '#fef9c3';
      badgeIcon = '🟤 ';
    } else if (d.status === 'Not Delivered') {
      statusColor = '#b91c1c';
      statusBg = '#fef2f2';
      badgeIcon = '🔴 ';
    }

    return `
      <tr>
        <td style="font-weight: 600;">${d.formattedDate}</td>
        <td>${d.dayName}</td>
        <td>
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 9px; color: ${statusColor}; background: ${statusBg};">
            ${badgeIcon}${d.status}
          </span>
        </td>
        <td>${d.product || '-'}</td>
        <td style="text-align: center; font-weight: 600;">${d.quantity || '-'}</td>
      </tr>
    `;
  }).join('');

  const cleanCustomerId = (customerCode || 'CUSTOMER').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const pdfTitle = `Delivery_Planner_${cleanCustomerId}_${monthStr}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${pdfTitle}</title>
      <style>
        @page {
          size: landscape;
          margin: 10mm;
        }
        @media print {
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 10px;
          color: #1e293b;
          margin: 0;
          padding: 16px;
        }
        .header {
          border-bottom: 2px solid #059669;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .title {
          font-size: 18px;
          font-weight: 800;
          color: #064e3b;
          letter-spacing: -0.4px;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 6px;
          padding: 10px 14px;
          margin-bottom: 12px;
          font-size: 11px;
        }
        .meta-item {
          display: flex;
          flex-direction: column;
        }
        .meta-label {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          color: #166534;
        }
        .meta-value {
          font-size: 12px;
          font-weight: 700;
          color: #0f172a;
          margin-top: 2px;
        }
        .legend-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px 14px;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 10px;
          font-weight: 600;
        }
        .legend-title {
          font-weight: 700;
          color: #475569;
          margin-right: 4px;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 6px;
        }
        th {
          background: #f1f5f9;
          color: #334155;
          font-weight: 700;
          text-align: left;
          padding: 7px 9px;
          border: 1px solid #cbd5e1;
          font-size: 9.5px;
          text-transform: uppercase;
        }
        td {
          padding: 6px 9px;
          border: 1px solid #e2e8f0;
          font-size: 9.5px;
          vertical-align: middle;
        }
        .footer {
          margin-top: 16px;
          font-size: 9px;
          color: #94a3b8;
          display: flex;
          justify-content: space-between;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">MARAM MILK — DELIVERY PLANNER</div>
      </div>
      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">Customer Name</span>
          <span class="meta-value">${customerName}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Customer ID</span>
          <span class="meta-value">${customerCode}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Month & Year</span>
          <span class="meta-value">${monthName}</span>
        </div>
      </div>

      <div class="legend-box">
        <span class="legend-title">Legend:</span>
        <span class="legend-item">🟢 AdHoc</span>
        <span class="legend-item">🔴 Pause</span>
        <span class="legend-item">🟤 Daily Delivery</span>
        <span class="legend-item">🔴 Not Delivered</span>
        <span class="legend-item">✅ Mark Delivered</span>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Day</th>
            <th>Delivery Status</th>
            <th>Product Information</th>
            <th style="text-align: center;">Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
      <div class="footer">
        <span>Customer Monthly Delivery Planner | Maram Milk SuperAdmin CRM</span>
        <span>Generated: ${new Date().toLocaleString('en-IN')}</span>
      </div>
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

/**
 * Export Delivery Boy-Wise Daily Planner Report to Excel (.xlsx)
 * Filename: Delivery_Boy_Wise_Daily_Planner_<DP>_<START>_to_<END>.xlsx
 */
export const exportDeliveryBoyPlannerExcel = ({
  dpName,
  dateFrom,
  dateTo,
  formattedPeriod,
  dayRecords,
  periodTotals,
}) => {
  const data = [];

  // Header metadata
  data.push(['DELIVERY BOY-WISE MONTHLY PLANNER']);
  data.push([`Delivery Boy: ${dpName}`]);
  data.push([`Period: ${formattedPeriod}`]);
  data.push([]); // blank separator

  // Table headers
  const headers = [
    'Date',
    'Day',
    'Route / Area',
    'Product Name',
    'Packing Type',
    'Subscription Qty',
    'AdHoc Qty',
    'Total Qty',
    'Milk Delivered (Liters)',
    'Extra Order (Liters)',
    'Total Milk Liter'
  ];
  data.push(headers);

  // Date-wise rows
  dayRecords.forEach(day => {
    if (day.productRows && day.productRows.length > 0) {
      day.productRows.forEach((p, idx) => {
        data.push([
          idx === 0 ? day.formattedDate : '',
          idx === 0 ? day.dayName : '',
          idx === 0 ? day.routes : '',
          p.product_name,
          p.packing_type || '-',
          p.subscription_qty || 0,
          p.adhoc_qty || 0,
          p.total_qty || 0,
          idx === 0 ? day.dayTotals.milkDeliveredLiters : '',
          idx === 0 ? day.dayTotals.extraOrderLiters : '',
          idx === 0 ? day.dayTotals.totalMilkLiters : ''
        ]);
      });
    } else {
      data.push([
        day.formattedDate,
        day.dayName,
        day.routes,
        'No Deliveries',
        '-',
        0,
        0,
        0,
        day.dayTotals.milkDeliveredLiters,
        day.dayTotals.extraOrderLiters,
        day.dayTotals.totalMilkLiters
      ]);
    }
  });

  data.push([]); // blank separator
  data.push(['PERIOD TOTALS SUMMARY']);
  data.push(['Total Milk Liter', periodTotals.totalMilkLiters]);
  data.push(['Total Milk Delivered', periodTotals.totalMilkDeliveredLiters]);
  data.push(['Total Extra Order Liter', periodTotals.totalExtraOrderLiters]);
  data.push([]);
  data.push(['Product Name', 'Packing Type', 'Total Quantity', 'Unit']);
  
  (periodTotals.productTotals || []).forEach(pt => {
    data.push([pt.product_name, pt.packing_type || '-', pt.total_qty, pt.unit || 'Unit']);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(data);

  const colWidths = [
    { wch: 14 }, // Date
    { wch: 12 }, // Day
    { wch: 25 }, // Route
    { wch: 30 }, // Product
    { wch: 14 }, // Packing
    { wch: 16 }, // Sub Qty
    { wch: 14 }, // AdHoc Qty
    { wch: 12 }, // Total Qty
    { wch: 22 }, // Milk Delivered
    { wch: 20 }, // Extra Order
    { wch: 18 }, // Total Milk Liter
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'DP Planner Report');

  const cleanDpName = (dpName || 'Delivery_Boy').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const fileName = `Delivery_Boy_Wise_Monthly_Planner_${cleanDpName}_${dateFrom}_to_${dateTo}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

/**
 * Export Delivery Boy-Wise Daily Planner Report to PDF (via print dialog)
 * Filename: Delivery_Boy_Wise_Daily_Planner_<DP>_<START>_to_<END>.pdf
 */
export const exportDeliveryBoyPlannerPDF = ({
  dpName,
  dateFrom,
  dateTo,
  formattedPeriod,
  dayRecords,
  periodTotals,
}) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to download/print the PDF report.');
    return;
  }

  let tableRowsHtml = '';
  dayRecords.forEach(day => {
    if (day.productRows && day.productRows.length > 0) {
      day.productRows.forEach((p, idx) => {
        tableRowsHtml += `
          <tr style="${idx === 0 ? 'border-top: 1.5px solid #cbd5e1;' : ''}">
            <td style="font-weight: 700;">${idx === 0 ? day.formattedDate : ''}</td>
            <td>${idx === 0 ? day.dayName : ''}</td>
            <td>${idx === 0 ? day.routes : ''}</td>
            <td>${p.product_name}</td>
            <td style="text-align: center;">${p.packing_type || '-'}</td>
            <td style="text-align: center; font-weight: 600;">${p.total_qty}</td>
            <td style="text-align: center;">${idx === 0 ? day.dayTotals.milkDeliveredLiters + ' L' : ''}</td>
            <td style="text-align: center;">${idx === 0 ? day.dayTotals.extraOrderLiters + ' L' : ''}</td>
            <td style="text-align: center; font-weight: 700; color: #064e3b;">${idx === 0 ? day.dayTotals.totalMilkLiters + ' L' : ''}</td>
          </tr>
        `;
      });
    }
  });

  let periodProductSummaryHtml = (periodTotals.productTotals || []).map(pt => `
    <tr>
      <td style="font-weight: 600;">${pt.product_name}</td>
      <td style="text-align: center;">${pt.packing_type || '-'}</td>
      <td style="text-align: center; font-weight: 700;">${pt.total_qty} ${pt.unit || ''}</td>
    </tr>
  `).join('');

  const cleanDpName = (dpName || 'Delivery_Boy').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const pdfTitle = `Delivery_Boy_Wise_Monthly_Planner_${cleanDpName}_${dateFrom}_to_${dateTo}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${pdfTitle}</title>
      <style>
        @page {
          size: landscape;
          margin: 10mm;
        }
        @media print {
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 10px;
          color: #1e293b;
          margin: 0;
          padding: 16px;
        }
        .header {
          border-bottom: 2px solid #2563eb;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .title {
          font-size: 18px;
          font-weight: 800;
          color: #1e3a8a;
          letter-spacing: -0.4px;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          padding: 10px 14px;
          margin-bottom: 14px;
        }
        .meta-item {
          display: flex;
          flex-direction: column;
        }
        .meta-label {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          color: #1d4ed8;
        }
        .meta-value {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
          margin-top: 2px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 6px;
        }
        th {
          background: #f1f5f9;
          color: #334155;
          font-weight: 700;
          text-align: left;
          padding: 7px 9px;
          border: 1px solid #cbd5e1;
          font-size: 9.5px;
          text-transform: uppercase;
        }
        td {
          padding: 6px 9px;
          border: 1px solid #e2e8f0;
          font-size: 9.5px;
          vertical-align: middle;
        }
        .totals-card {
          margin-top: 20px;
          background: #f8fafc;
          border: 1.5px solid #cbd5e1;
          border-radius: 8px;
          padding: 14px;
        }
        .totals-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 12px;
        }
        .stat-box {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px 12px;
          text-align: center;
        }
        .stat-title {
          font-size: 9px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
        }
        .stat-num {
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
          margin-top: 2px;
        }
        .footer {
          margin-top: 20px;
          font-size: 9px;
          color: #94a3b8;
          display: flex;
          justify-content: space-between;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">DELIVERY BOY-WISE MONTHLY PLANNER</div>
      </div>
      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">Delivery Boy</span>
          <span class="meta-value">${dpName}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Period / Date Range</span>
          <span class="meta-value">${formattedPeriod}</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Day</th>
            <th>Route / Area</th>
            <th>Product Name</th>
            <th style="text-align: center;">Packing</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: center;">Delivered</th>
            <th style="text-align: center;">Extra Order</th>
            <th style="text-align: center;">Total Milk</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>

      <div class="totals-card">
        <h3 style="margin: 0 0 10px 0; font-size: 12px; font-weight: 800; color: #0f172a;">PERIOD TOTALS SUMMARY</h3>
        <div class="totals-grid">
          <div class="stat-box">
            <div class="stat-title">Total Milk Liter</div>
            <div class="stat-num">${periodTotals.totalMilkLiters} L</div>
          </div>
          <div class="stat-box">
            <div class="stat-title">Total Milk Delivered</div>
            <div class="stat-num" style="color: #166534;">${periodTotals.totalMilkDeliveredLiters} L</div>
          </div>
          <div class="stat-box">
            <div class="stat-title">Total Extra Order Liter</div>
            <div class="stat-num" style="color: #991b1b;">${periodTotals.totalExtraOrderLiters} L</div>
          </div>
        </div>

        <h4 style="margin: 12px 0 6px 0; font-size: 10.5px; font-weight: 700; color: #475569;">Product-Wise Total Quantities</h4>
        <table>
          <thead>
            <tr>
              <th>Product Name</th>
              <th style="text-align: center;">Packing</th>
              <th style="text-align: center;">Total Quantity</th>
            </tr>
          </thead>
          <tbody>
            ${periodProductSummaryHtml}
          </tbody>
        </table>
      </div>

      <div class="footer">
        <span>Delivery Boy-Wise Monthly Planner | Maram Milk SuperAdmin CRM</span>
        <span>Generated: ${new Date().toLocaleString('en-IN')}</span>
      </div>
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

/**
 * Export Single-Date Delivery Boy-Wise Daily Planner Report to Excel (.xlsx)
 * Filename: Delivery_Boy_Wise_Daily_Planner_<YYYY-MM-DD>_<DPName>.xlsx
 */
export const exportDeliveryBoyDailySummaryExcel = ({
  dpName,
  date,
  formattedDate,
  productColumns,
  row,
}) => {
  const data = [];

  // Metadata block
  data.push(['Delivery Boy-Wise Daily Planner Report']);
  data.push([`Date: ${formattedDate || date}`]);
  data.push([`Delivery Boy: ${dpName}`]);
  data.push([]); // blank separator

  // Table headers
  const headers = [
    'Delivery Boy',
    ...productColumns,
    'Total Milk Liter',
    'Milk Delivered',
    'Extra Order Liter'
  ];
  data.push(headers);

  // Data row
  const dataRow = [
    dpName,
    ...productColumns.map(col => row.productQuantities[col] || 0),
    row.total_milk_liter || 0,
    row.milk_delivered || 0,
    row.extra_order_liter || 0,
  ];
  data.push(dataRow);

  // Total row
  const totalRow = [
    'Total',
    ...productColumns.map(col => row.productQuantities[col] || 0),
    row.total_milk_liter || 0,
    row.milk_delivered || 0,
    row.extra_order_liter || 0,
  ];
  data.push(totalRow);

  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Column widths
  const colWidths = headers.map(h => ({ wch: Math.max(String(h).length + 4, 14) }));
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Summary');

  const cleanDpName = (dpName || 'Delivery_Boy').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const fileName = `Delivery_Boy_Wise_Daily_Planner_${date}_${cleanDpName}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

/**
 * Export Delivery Area Report to Excel (.xlsx)
 * Filename: Delivery_Area_Report.xlsx or Delivery_Area_Report_<City>.xlsx
 */
export const exportDeliveryAreaExcel = ({
  city,
  filterInfo,
  rows,
}) => {
  const data = [];

  data.push(['DELIVERY AREA REPORT']);
  if (filterInfo) {
    data.push([`Filters: ${filterInfo}`]);
  }
  data.push([]); // blank separator

  const headers = ['State', 'City', 'Area Name', 'Area Pin', 'Route', 'Service Availability'];
  data.push(headers);

  rows.forEach(r => {
    data.push([
      r.state || 'Tamil Nadu',
      r.city || 'Chennai',
      r.area_name || '-',
      r.area_pin || '-',
      r.route || '-',
      r.service_availability || 'Delivery Available',
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 16 },
    { wch: 16 },
    { wch: 25 },
    { wch: 14 },
    { wch: 22 },
    { wch: 24 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Delivery Areas');

  const cleanCity = city && city !== 'All' ? city.replace(/[^a-zA-Z0-9_\-]/g, '_') : '';
  const fileName = cleanCity ? `Delivery_Area_Report_${cleanCity}.xlsx` : 'Delivery_Area_Report.xlsx';
  XLSX.writeFile(workbook, fileName);
};

/**
 * Export Delivery Area Report to PDF (via print dialog)
 * Filename: Delivery_Area_Report.pdf
 */
export const exportDeliveryAreaPDF = ({
  city,
  filterInfo,
  rows,
}) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to download/print the PDF report.');
    return;
  }

  const tableRowsHtml = rows.map(r => {
    const availColor = r.service_availability === 'Delivery Available' ? '#166534' : '#991b1b';
    const availBg = r.service_availability === 'Delivery Available' ? '#f0fdf4' : '#fef2f2';

    return `
      <tr>
        <td>${r.state || 'Tamil Nadu'}</td>
        <td>${r.city || 'Chennai'}</td>
        <td style="font-weight: 600;">${r.area_name || '-'}</td>
        <td style="font-weight: 600;">${r.area_pin || '-'}</td>
        <td>${r.route || '-'}</td>
        <td>
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 9px; color: ${availColor}; background: ${availBg};">
            ${r.service_availability || 'Delivery Available'}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Delivery_Area_Report</title>
      <style>
        @page {
          size: landscape;
          margin: 10mm;
        }
        @media print {
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 10px;
          color: #1e293b;
          margin: 0;
          padding: 16px;
        }
        .header {
          border-bottom: 2px solid #2563eb;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .title {
          font-size: 18px;
          font-weight: 800;
          color: #1e3a8a;
          letter-spacing: -0.4px;
        }
        .meta {
          font-size: 11px;
          color: #475569;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 12px;
          font-weight: 600;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 6px;
        }
        th {
          background: #f1f5f9;
          color: #334155;
          font-weight: 700;
          text-align: left;
          padding: 7px 9px;
          border: 1px solid #cbd5e1;
          font-size: 9.5px;
          text-transform: uppercase;
        }
        td {
          padding: 6.5px 9px;
          border: 1px solid #e2e8f0;
          font-size: 9.5px;
          vertical-align: middle;
        }
        .footer {
          margin-top: 16px;
          font-size: 9px;
          color: #94a3b8;
          display: flex;
          justify-content: space-between;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">DELIVERY AREA REPORT</div>
      </div>
      <div class="meta">
        ${filterInfo ? filterInfo + ' | ' : ''}Generated: ${new Date().toLocaleString('en-IN')} | Total Records: ${rows.length}
      </div>
      <table>
        <thead>
          <tr>
            <th>State</th>
            <th>City</th>
            <th>Area Name</th>
            <th>Area Pin</th>
            <th>Route</th>
            <th>Service Availability</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
      <div class="footer">
        <span>Delivery Area Report | Maram Milk SuperAdmin CRM</span>
      </div>
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

/**
 * Export Mark Delivery Report to Excel
 * Filename: Mark_Delivery_Report_<START>_to_<END>.xlsx
 */
export const exportMarkDeliveryExcel = ({
  rows,
  totalsRow,
  startDate,
  endDate,
  filters = {}
}) => {
  const data = [];

  // Metadata block
  data.push(['MARK DELIVERY REPORT']);
  data.push([`Date Range: ${startDate} to ${endDate}`]);
  if (filters.customer) data.push([`Customer: ${filters.customer}`]);
  if (filters.hub) data.push([`Hub: ${filters.hub}`]);
  if (filters.deliveryBoy) data.push([`Delivery Boy: ${filters.deliveryBoy}`]);
  if (filters.city) data.push([`City: ${filters.city}`]);
  data.push([]); // blank separator

  // Table headers
  const headers = [
    'Delivery Date',
    'Customer Name',
    'Address',
    'City',
    'Hub',
    'Delivery Boy',
    'Subscription Type',
    'Product',
    'Scheduled Qty',
    'Delivered Qty',
    'Bottle Delivered',
    'Bottle Collected',
    'Remark',
    'Narration'
  ];
  data.push(headers);

  // Rows
  rows.forEach(r => {
    data.push([
      r.delivery_date || '',
      r.customer_name || '',
      r.address || '',
      r.city || 'Chennai',
      r.hub || '',
      r.delivery_boy || '',
      r.subscription_type || '',
      r.product || '',
      r.scheduled_qty !== undefined ? r.scheduled_qty : 0,
      r.delivered_qty !== undefined ? r.delivered_qty : 0,
      r.bottle_delivered !== undefined ? r.bottle_delivered : 0,
      r.bottle_collected !== undefined ? r.bottle_collected : 0,
      r.remark || '',
      r.narration || '',
    ]);
  });

  // Totals Row
  if (totalsRow) {
    data.push([
      totalsRow.delivery_date || 'Total',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      totalsRow.scheduled_qty || 0,
      totalsRow.delivered_qty || 0,
      totalsRow.bottle_delivered || 0,
      totalsRow.bottle_collected || 0,
      '',
      ''
    ]);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 14 }, // Date
    { wch: 26 }, // Customer
    { wch: 30 }, // Address
    { wch: 12 }, // City
    { wch: 16 }, // Hub
    { wch: 20 }, // Delivery Boy
    { wch: 18 }, // Subscription Type
    { wch: 28 }, // Product
    { wch: 14 }, // Scheduled Qty
    { wch: 14 }, // Delivered Qty
    { wch: 16 }, // Bottle Delivered
    { wch: 16 }, // Bottle Collected
    { wch: 20 }, // Remark
    { wch: 28 }, // Narration
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mark Delivery');

  const fileName = `Mark_Delivery_Report_${startDate}_to_${endDate}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

/**
 * Export Mark Delivery Report to PDF (landscape print)
 * Filename: Mark_Delivery_Report_<START>_to_<END>.pdf
 */
export const exportMarkDeliveryPDF = ({
  rows,
  totalsRow,
  startDate,
  endDate,
  filters = {}
}) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to download/print the PDF report.');
    return;
  }

  const filterItems = [];
  filterItems.push(`Date Range: ${startDate} to ${endDate}`);
  if (filters.customer && filters.customer !== 'All' && filters.customer !== '[ Select Customer ▼ ]') filterItems.push(`Customer: ${filters.customer}`);
  if (filters.hub && filters.hub !== 'All' && filters.hub !== '[ Select Hub ▼ ]') filterItems.push(`Hub: ${filters.hub}`);
  if (filters.deliveryBoy && filters.deliveryBoy !== 'All' && filters.deliveryBoy !== '[ Select Delivery Boy ▼ ]') filterItems.push(`Delivery Boy: ${filters.deliveryBoy}`);
  filterItems.push(`City: ${filters.city || 'Chennai'}`);
  const filterInfo = filterItems.join(' | ');

  const tableRowsHtml = rows.map(r => `
    <tr>
      <td style="white-space:nowrap;">${r.delivery_date || ''}</td>
      <td><strong>${r.customer_name || ''}</strong></td>
      <td style="font-size:8px;">${r.address || 'N/A'}</td>
      <td>${r.city || 'Chennai'}</td>
      <td>${r.hub || ''}</td>
      <td>${r.delivery_boy || ''}</td>
      <td><span style="display:inline-block; padding:2px 5px; background:#e0f2fe; color:#0369a1; border-radius:4px; font-weight:600; font-size:8px;">${r.subscription_type || 'Daily'}</span></td>
      <td>${r.product || ''}</td>
      <td style="text-align:right; font-weight:600;">${r.scheduled_qty}</td>
      <td style="text-align:right; font-weight:600; color:#166534;">${r.delivered_qty}</td>
      <td style="text-align:right; font-weight:600; ${r.bottle_delivered < 0 ? 'color:#dc2626;' : ''}">${r.bottle_delivered}</td>
      <td style="text-align:right; font-weight:600; color:#0284c7;">${r.bottle_collected}</td>
      <td style="font-size:8.5px; color:#475569;">${r.remark || '-'}</td>
      <td style="font-size:8.5px; color:#475569;">${r.narration || '-'}</td>
    </tr>
  `).join('');

  const totalsHtml = totalsRow ? `
    <tr style="background:#f8fafc; font-weight:700; border-top:2px solid #0284c7;">
      <td style="font-weight:700;">Total</td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td style="text-align:right; font-weight:700;">${totalsRow.scheduled_qty}</td>
      <td style="text-align:right; font-weight:700; color:#166534;">${totalsRow.delivered_qty}</td>
      <td style="text-align:right; font-weight:700;">${totalsRow.bottle_delivered}</td>
      <td style="text-align:right; font-weight:700; color:#0284c7;">${totalsRow.bottle_collected}</td>
      <td></td>
      <td></td>
    </tr>
  ` : '';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Mark_Delivery_Report_${startDate}_to_${endDate}</title>
      <style>
        @page {
          size: landscape;
          margin: 10mm;
        }
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 12px;
          font-size: 8.5px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #0284c7;
          padding-bottom: 8px;
          margin-bottom: 8px;
        }
        .title {
          font-size: 16px;
          font-weight: 800;
          color: #0284c7;
          letter-spacing: 0.5px;
        }
        .meta {
          font-size: 9px;
          color: #475569;
          margin-bottom: 10px;
          background: #f1f5f9;
          padding: 6px 10px;
          border-radius: 4px;
        }
        .note {
          background: #fffbeb;
          border-left: 3px solid #f59e0b;
          color: #92400e;
          padding: 5px 8px;
          margin-bottom: 8px;
          font-size: 8px;
          font-style: italic;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 4px;
        }
        thead {
          display: table-header-group;
        }
        tr {
          page-break-inside: avoid;
        }
        th {
          background: #f1f5f9;
          color: #1e293b;
          font-weight: 700;
          text-align: left;
          padding: 5px 6px;
          border: 1px solid #cbd5e1;
          font-size: 8px;
          text-transform: uppercase;
        }
        td {
          padding: 5px 6px;
          border: 1px solid #e2e8f0;
          font-size: 8px;
          vertical-align: middle;
        }
        .footer {
          margin-top: 14px;
          font-size: 8px;
          color: #94a3b8;
          display: flex;
          justify-content: space-between;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">MARK DELIVERY REPORT</div>
      </div>
      <div class="meta">
        ${filterInfo} | Total Records: ${rows.length}
      </div>
      <div class="note">
        Note: *If bottle count is in negative (that might be because of previously unmarked delivery/deliveries). Bottles would be adjusted in the next delivery.
      </div>
      <table>
        <thead>
          <tr>
            <th>Delivery Date</th>
            <th>Customer Name</th>
            <th>Address</th>
            <th>City</th>
            <th>Hub</th>
            <th>Delivery Boy</th>
            <th>Sub. Type</th>
            <th>Product</th>
            <th style="text-align:right;">Sched Qty</th>
            <th style="text-align:right;">Deliv Qty</th>
            <th style="text-align:right;">Bottle Del.</th>
            <th style="text-align:right;">Bottle Coll.</th>
            <th>Remark</th>
            <th>Narration</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
          ${totalsHtml}
        </tbody>
      </table>
      <div class="footer">
        <span>Mark Delivery Report | Maram Milk SuperAdmin CRM</span>
      </div>
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};





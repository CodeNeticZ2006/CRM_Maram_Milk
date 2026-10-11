import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Sanitize cell values to prevent CSV / Excel formula injection.
 * Any string starting with =, +, -, @, \t, \r is escaped with a leading single quote (')
 * unless it is a valid negative number.
 */
export const sanitizeForExcel = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  const str = String(val);
  // Allow normal negative numbers like "-10", "-45.50"
  if (/^-\d+(\.\d+)?$/.test(str.trim())) {
    return Number(str.trim());
  }
  // If starts with =, +, -, @, tab, or carriage return, escape it
  if (/^[=\+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
};

/**
 * Safe conversion from Array-of-Arrays to SheetJS worksheet with formula injection sanitization.
 */
export const safeAoAToSheet = (aoa) => {
  const sanitizedAoa = (aoa || []).map(row =>
    Array.isArray(row) ? row.map(sanitizeForExcel) : row
  );
  return XLSX.utils.aoa_to_sheet(sanitizedAoa);
};

/**
 * Universal Direct-Download PDF Generator using jsPDF and autoTable.
 * Downloads directly without opening popup windows or relying on window.print().
 */
export const downloadDirectPDF = ({
  fileName,
  reportTitle,
  filterInfo,
  headers,
  rows,
  summaryBoxes = [],
  orientation = 'landscape',
}) => {
  const doc = new jsPDF({
    orientation,
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 36;
  let currentY = 36;

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(`MARAM MILK CRM — ${(reportTitle || 'REPORT').toUpperCase()}`, marginX, currentY);
  currentY += 16;

  // Subtitle / Filters
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  const metaText = `${filterInfo ? filterInfo + ' | ' : ''}Generated: ${new Date().toLocaleString('en-IN')} | Total Records: ${rows.length}`;
  
  const metaLines = doc.splitTextToSize(metaText, pageWidth - marginX * 2);
  doc.text(metaLines, marginX, currentY);
  currentY += (metaLines.length * 11) + 4;

  // Blue Divider line
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(1.5);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 12;

  // Summary box if provided
  if (summaryBoxes && summaryBoxes.length > 0) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(marginX, currentY, pageWidth - marginX * 2, 24, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    let summaryX = marginX + 12;
    summaryBoxes.forEach((item) => {
      const text = typeof item === 'string' ? item : `${item.label}: ${item.value}`;
      doc.text(text, summaryX, currentY + 15);
      summaryX += doc.getTextWidth(text) + 24;
    });
    currentY += 34;
  }

  // AutoTable
  autoTable(doc, {
    startY: currentY,
    head: [headers],
    body: rows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 4,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [51, 65, 85],
      fontStyle: 'bold',
      fontSize: 8,
      lineColor: [203, 213, 225],
      lineWidth: 0.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: marginX, right: marginX, bottom: 32 },
    didDrawPage: (data) => {
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Maram Milk SuperAdmin CRM  |  Page ${data.pageNumber} of ${pageCount}`,
        marginX,
        pageHeight - 16
      );
    },
  });

  const todayStr = new Date().toISOString().substring(0, 10);
  const cleanBase = (fileName || reportTitle || 'Report').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const finalFileName = cleanBase.toLowerCase().endsWith('.pdf') ? cleanBase : `${cleanBase}_${todayStr}.pdf`;
  doc.save(finalFileName);
};

/**
 * Clean & robust Excel export (.xlsx) using SheetJS XLSX library with formula injection protection.
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

  // Create worksheet & workbook with formula injection protection
  const worksheet = safeAoAToSheet(data);

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

  // Create Worksheet & Workbook with formula sanitization
  const worksheet = safeAoAToSheet(data);

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
 * Direct-Download PDF export using jsPDF and autoTable.
 */
export const exportToPDF = ({
  reportTitle,
  filterInfo,
  headers,
  rows,
  totalRecords,
  summaryHtml,
}) => {
  downloadDirectPDF({
    fileName: reportTitle,
    reportTitle,
    filterInfo,
    headers,
    rows,
    orientation: headers && headers.length > 6 ? 'landscape' : 'portrait'
  });
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

  const worksheet = safeAoAToSheet(data);

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
  const cleanCustomerId = (customerCode || 'CUSTOMER').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const fileName = `Delivery_Planner_${cleanCustomerId}_${monthStr}.pdf`;
  const headers = ['Date', 'Day', 'Delivery Status', 'Product Information', 'Quantity'];
  const rows = (days || []).map(d => [
    d.formattedDate || '',
    d.dayName || '',
    d.status || '',
    d.product || '-',
    d.quantity || '-'
  ]);
  const summaryBoxes = [
    { label: 'Customer', value: `${customerName || ''} (${customerCode || ''})` },
    { label: 'Period', value: `${monthName || ''} ${year || ''}` }
  ];
  downloadDirectPDF({
    fileName,
    reportTitle: `Delivery Planner — ${customerName || ''}`,
    filterInfo: `Customer: ${customerCode || ''} | Month: ${monthName || ''} ${year || ''}`,
    headers,
    rows,
    summaryBoxes,
    orientation: 'landscape'
  });
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

  const worksheet = safeAoAToSheet(data);

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
  const cleanDpName = (dpName || 'Delivery_Boy').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const fileName = `Delivery_Boy_Wise_Monthly_Planner_${cleanDpName}_${dateFrom}_to_${dateTo}.pdf`;
  const headers = ['Date', 'Day', 'Routes', 'Product', 'Packing', 'Total Qty', 'Delivered (L)', 'Extra (L)', 'Total (L)'];
  const rows = [];
  (dayRecords || []).forEach(day => {
    if (day.productRows && day.productRows.length > 0) {
      day.productRows.forEach((p, idx) => {
        rows.push([
          idx === 0 ? (day.formattedDate || '') : '',
          idx === 0 ? (day.dayName || '') : '',
          idx === 0 ? (day.routes || '') : '',
          p.product_name || '',
          p.packing_type || '-',
          p.total_qty || '',
          idx === 0 ? `${day.dayTotals?.milkDeliveredLiters || 0} L` : '',
          idx === 0 ? `${day.dayTotals?.extraOrderLiters || 0} L` : '',
          idx === 0 ? `${day.dayTotals?.totalMilkLiters || 0} L` : '',
        ]);
      });
    }
  });
  const summaryBoxes = periodTotals?.totalMilkLiters ? [
    { label: 'Total Milk Delivered', value: `${periodTotals.totalMilkLiters} L` },
    { label: 'Extra Orders', value: `${periodTotals.extraOrderLiters || 0} L` }
  ] : [];
  downloadDirectPDF({
    fileName,
    reportTitle: `Delivery Boy Wise Monthly Planner — ${dpName || ''}`,
    filterInfo: formattedPeriod || `Period: ${dateFrom} to ${dateTo}`,
    headers,
    rows,
    summaryBoxes,
    orientation: 'landscape'
  });
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

  const worksheet = safeAoAToSheet(data);

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

  const worksheet = safeAoAToSheet(data);
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
  const fileName = `Delivery_Area_Report_${(city || 'Chennai').replace(/[^a-zA-Z0-9_\-]/g, '_')}.pdf`;
  const headers = ['State', 'City', 'Area Name', 'Pincode', 'Route', 'Service Availability'];
  const tableRows = (rows || []).map(r => [
    r.state || 'Tamil Nadu',
    r.city || 'Chennai',
    r.area_name || '-',
    r.area_pin || '-',
    r.route || '-',
    r.service_availability || 'Delivery Available'
  ]);
  downloadDirectPDF({
    fileName,
    reportTitle: `Delivery Area Report — ${city || 'Chennai'}`,
    filterInfo: filterInfo || `City: ${city || 'Chennai'}`,
    headers,
    rows: tableRows,
    orientation: 'landscape'
  });
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

  const worksheet = safeAoAToSheet(data);

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
  const fileName = `Mark_Delivery_Report_${startDate}_to_${endDate}.pdf`;
  const filterItems = [];
  filterItems.push(`Date Range: ${startDate} to ${endDate}`);
  if (filters.customer && filters.customer !== 'All' && !filters.customer.includes('Select')) filterItems.push(`Customer: ${filters.customer}`);
  if (filters.hub && filters.hub !== 'All' && !filters.hub.includes('Select')) filterItems.push(`Hub: ${filters.hub}`);
  if (filters.deliveryBoy && filters.deliveryBoy !== 'All' && !filters.deliveryBoy.includes('Select')) filterItems.push(`Delivery Boy: ${filters.deliveryBoy}`);
  filterItems.push(`City: ${filters.city || 'Chennai'}`);
  const filterInfo = filterItems.join(' | ');

  const headers = ['Date', 'Customer Name', 'Address', 'City', 'Hub', 'Delivery Boy', 'Type', 'Product', 'Sched Qty', 'Deliv Qty', 'Bottle Deliv', 'Bottle Coll', 'Remark', 'Narration'];
  const tableRows = (rows || []).map(r => [
    r.delivery_date || '',
    r.customer_name || '',
    r.address || '-',
    r.city || 'Chennai',
    r.hub || '',
    r.delivery_boy || '',
    r.subscription_type || 'Daily',
    r.product || '',
    r.scheduled_qty ?? '',
    r.delivered_qty ?? '',
    r.bottle_delivered ?? '',
    r.bottle_collected ?? '',
    r.remark || '-',
    r.narration || '-'
  ]);
  if (totalsRow) {
    tableRows.push([
      'Total', '', '', '', '', '', '', '',
      totalsRow.scheduled_qty ?? '',
      totalsRow.delivered_qty ?? '',
      totalsRow.bottle_delivered ?? '',
      totalsRow.bottle_collected ?? '',
      '', ''
    ]);
  }
  downloadDirectPDF({
    fileName,
    reportTitle: 'Mark Delivery Report',
    filterInfo,
    headers,
    rows: tableRows,
    orientation: 'landscape'
  });
};

/**
 * REPORT 1: Export Pause Resume Request Report to Excel
 * Filename: Pause_Resume_Request_Report.xlsx
 */
export const exportPauseResumeRequestExcel = ({ rows, filters = {} }) => {
  const data = [];

  data.push(['PAUSE RESUME REQUEST REPORT']);
  if (filters.customer) data.push([`Customer: ${filters.customer}`]);
  if (filters.pauseDate) data.push([`Pause Date: ${filters.pauseDate}`]);
  data.push([]); // blank separator

  const headers = ['Customer Name', 'Plan', 'Status', 'Pause Request Date', 'Pause Date'];
  data.push(headers);

  rows.forEach(r => {
    data.push([
      r.customer_name || '',
      r.plan || '',
      r.status || '',
      r.pause_request_date || '',
      r.pause_date || '',
    ]);
  });

  const worksheet = safeAoAToSheet(data);
  worksheet['!cols'] = [
    { wch: 28 }, // Customer Name
    { wch: 26 }, // Plan
    { wch: 16 }, // Status
    { wch: 20 }, // Pause Request Date
    { wch: 18 }, // Pause Date
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pause Resume Requests');
  XLSX.writeFile(workbook, 'Pause_Resume_Request_Report.xlsx');
};

/**
 * REPORT 1: Export Pause Resume Request Report to PDF
 * Filename: Pause_Resume_Request_Report.pdf
 */
export const exportPauseResumeRequestPDF = ({ rows, filters = {} }) => {
  const fileName = 'Pause_Resume_Request_Report.pdf';
  const filterItems = [];
  if (filters.customer && filters.customer !== 'All' && !filters.customer.includes('Select')) filterItems.push(`Customer: ${filters.customer}`);
  if (filters.pauseDate) filterItems.push(`Pause Date: ${filters.pauseDate}`);
  const filterInfo = filterItems.join(' | ');

  const headers = ['Customer Name', 'Plan', 'Status', 'Pause Request Date', 'Pause Date'];
  const tableRows = (rows || []).map(r => [
    r.customer_name || '',
    r.plan || '',
    r.status || 'Active',
    r.pause_request_date || '',
    r.pause_date || ''
  ]);
  downloadDirectPDF({
    fileName,
    reportTitle: 'Pause Resume Request Report',
    filterInfo,
    headers,
    rows: tableRows,
    orientation: 'portrait'
  });
};

/**
 * REPORT 2: Export Customer Subscription Change Request Report to Excel
 * Filename: Customer_Subscription_Change_Request_Report.xlsx
 */
export const exportSubscriptionChangeRequestExcel = ({ rows, filters = {} }) => {
  const data = [];

  data.push(['CUSTOMER - SUBSCRIPTION CHANGE REQUEST REPORT']);
  if (filters.customer) data.push([`Customer: ${filters.customer}`]);
  if (filters.subscriptionType) data.push([`Subscription Type: ${filters.subscriptionType}`]);
  if (filters.changeRequestDate) data.push([`Change Request Date: ${filters.changeRequestDate}`]);
  if (filters.product) data.push([`Product: ${filters.product}`]);
  if (filters.status) data.push([`Status: ${filters.status}`]);
  data.push([]); // blank separator

  const headers = [
    'Customer',
    'Subscription Type',
    'Start Date',
    'Delivery Type',
    'Delivery Boy',
    'Product Name',
    'Packaging',
    'Qty',
    'Changed Qty',
    'Change Request Date',
    'Entry by'
  ];
  data.push(headers);

  rows.forEach(r => {
    data.push([
      r.customer || '',
      r.subscription_type || '',
      r.start_date || '',
      r.delivery_type || 'Daily Delivery',
      r.delivery_boy || '',
      r.product_name || '',
      r.packaging || '',
      r.qty !== undefined ? r.qty : '',
      r.changed_qty !== undefined ? r.changed_qty : '',
      r.change_request_date || '',
      r.entry_by || '',
    ]);
  });

  const worksheet = safeAoAToSheet(data);
  worksheet['!cols'] = [
    { wch: 26 }, // Customer
    { wch: 18 }, // Subscription Type
    { wch: 14 }, // Start Date
    { wch: 16 }, // Delivery Type
    { wch: 18 }, // Delivery Boy
    { wch: 26 }, // Product Name
    { wch: 12 }, // Packaging
    { wch: 8 },  // Qty
    { wch: 12 }, // Changed Qty
    { wch: 18 }, // Change Request Date
    { wch: 16 }, // Entry by
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Change Requests');
  XLSX.writeFile(workbook, 'Customer_Subscription_Change_Request_Report.xlsx');
};

/**
 * REPORT 2: Export Customer Subscription Change Request Report to PDF
 * Filename: Customer_Subscription_Change_Request_Report.pdf
 */
export const exportSubscriptionChangeRequestPDF = ({ rows, filters = {} }) => {
  const fileName = 'Subscription_Change_Request_Report.pdf';
  const filterItems = [];
  if (filters.customer && filters.customer !== 'All' && !filters.customer.includes('Select')) filterItems.push(`Customer: ${filters.customer}`);
  if (filters.subscriptionType && filters.subscriptionType !== 'All' && !filters.subscriptionType.includes('Select')) filterItems.push(`Subscription Type: ${filters.subscriptionType}`);
  if (filters.changeRequestDate) filterItems.push(`Change Request Date: ${filters.changeRequestDate}`);
  if (filters.product && filters.product !== 'All' && !filters.product.includes('Select')) filterItems.push(`Product: ${filters.product}`);
  if (filters.status && filters.status !== 'All' && !filters.status.includes('Select')) filterItems.push(`Status: ${filters.status}`);
  const filterInfo = filterItems.join(' | ');

  const headers = ['Customer', 'Type', 'Start Date', 'Delivery Type', 'Delivery Boy', 'Product', 'Packaging', 'Qty', 'Changed Qty', 'Req Date', 'Entry By'];
  const tableRows = (rows || []).map(r => [
    r.customer || '',
    r.subscription_type || 'Subscribe',
    r.start_date || '',
    r.delivery_type || 'Daily Delivery',
    r.delivery_boy || '',
    r.product_name || '',
    r.packaging || '',
    r.qty ?? '',
    r.changed_qty ?? '',
    r.change_request_date || '',
    r.entry_by || ''
  ]);
  downloadDirectPDF({
    fileName,
    reportTitle: 'Customer Subscription Change Request Report',
    filterInfo,
    headers,
    rows: tableRows,
    orientation: 'landscape'
  });
};

/**
 * REPORT 3: Export Change Request For Today & Tomorrow to Excel
 * Filename: Change_Request_Today_Tomorrow.xlsx
 */
export const exportChangeTodayTomorrowExcel = ({ rows, filters = {} }) => {
  const data = [];

  data.push(['CHANGE REQUEST FOR TODAY & TOMORROW']);
  if (filters.customer) data.push([`Customer: ${filters.customer}`]);
  if (filters.city) data.push([`City: ${filters.city}`]);
  data.push([]); // blank separator

  const headers = [
    'Customer',
    'Type',
    'Start Date',
    'Product Name',
    'Packaging',
    'Qty',
    'Changed Qty',
    'Change Request Date'
  ];
  data.push(headers);

  rows.forEach(r => {
    data.push([
      r.customer || '',
      r.type || 'Subscribe',
      r.start_date || '',
      r.product_name || '',
      r.packaging || '',
      r.qty !== undefined ? r.qty : '',
      r.changed_qty !== undefined ? r.changed_qty : '',
      r.change_request_date || '',
    ]);
  });

  const worksheet = safeAoAToSheet(data);
  worksheet['!cols'] = [
    { wch: 32 }, // Customer
    { wch: 16 }, // Type
    { wch: 14 }, // Start Date
    { wch: 28 }, // Product Name
    { wch: 12 }, // Packaging
    { wch: 8 },  // Qty
    { wch: 12 }, // Changed Qty
    { wch: 18 }, // Change Request Date
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Today & Tomorrow Requests');
  XLSX.writeFile(workbook, 'Change_Request_Today_Tomorrow.xlsx');
};

/**
 * Export Payment Collection Report to Excel
 * Filename: Payment_Collection_Report_<START>_to_<END>.xlsx
 */
export const exportPaymentCollectionExcel = ({
  rows,
  totalsRow,
  startDate,
  endDate,
  totalAmountRecharged = 0,
  totalCashback = 0,
  filters = {}
}) => {
  const data = [];

  // Metadata block
  data.push(['PAYMENT COLLECTION REPORT']);
  data.push([`Date Range: ${startDate} to ${endDate}`]);
  if (filters.customer) data.push([`Customer: ${filters.customer}`]);
  if (filters.customerType) data.push([`Customer Type: ${filters.customerType}`]);
  if (filters.deliveryBoy) data.push([`Delivery Boy: ${filters.deliveryBoy}`]);
  if (filters.mode) data.push([`Mode: ${filters.mode}`]);
  if (filters.city) data.push([`City: ${filters.city}`]);
  if (filters.paymentMethod) data.push([`Payment Method: ${filters.paymentMethod}`]);
  data.push([`Total Amount Recharged: Rs. ${totalAmountRecharged}`]);
  data.push([`Total Cashback: Rs. ${totalCashback}`]);
  data.push([]); // blank separator

  // Table headers
  const headers = [
    'Date',
    'Customer',
    'Amount(Rs)',
    'Promocode',
    'Cashback Amount',
    'Payment Method',
    'Remark / Payment History',
    'Mode',
    'Narration'
  ];
  data.push(headers);

  // Table rows
  rows.forEach(r => {
    data.push([
      r.date || '',
      r.customer || '',
      r.amount !== undefined ? r.amount : 0,
      r.promocode || '-',
      r.cashback_amount !== undefined ? r.cashback_amount : 0,
      r.payment_method || '',
      r.remark || '',
      r.mode || '',
      r.narration || '',
    ]);
  });

  // Total row
  if (totalsRow) {
    data.push([
      totalsRow.date || 'Total',
      '',
      totalsRow.amount || 0,
      '',
      totalsRow.cashback_amount || 0,
      '',
      '',
      '',
      ''
    ]);
  }

  const worksheet = safeAoAToSheet(data);
  worksheet['!cols'] = [
    { wch: 14 }, // Date
    { wch: 35 }, // Customer
    { wch: 14 }, // Amount(Rs)
    { wch: 14 }, // Promocode
    { wch: 16 }, // Cashback Amount
    { wch: 18 }, // Payment Method
    { wch: 28 }, // Remark
    { wch: 12 }, // Mode
    { wch: 30 }, // Narration
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Payment Collection');

  const fileName = `Payment_Collection_Report_${startDate}_to_${endDate}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

/**
 * Export Payment Collection Report to PDF (Landscape print)
 * Filename: Payment_Collection_Report_<START>_to_<END>.pdf
 */
export const exportPaymentCollectionPDF = ({
  rows,
  totalsRow,
  startDate,
  endDate,
  totalAmountRecharged = 0,
  totalCashback = 0,
  filters = {}
}) => {
  const fileName = `Payment_Collection_Report_${startDate}_to_${endDate}.pdf`;
  const filterItems = [];
  filterItems.push(`Date Range: ${startDate} to ${endDate}`);
  if (filters.customer && filters.customer !== 'All' && !filters.customer.includes('Select')) filterItems.push(`Customer: ${filters.customer}`);
  if (filters.customerType && filters.customerType !== 'All' && !filters.customerType.includes('Select')) filterItems.push(`Customer Type: ${filters.customerType}`);
  if (filters.deliveryBoy && filters.deliveryBoy !== 'All' && !filters.deliveryBoy.includes('Select')) filterItems.push(`Delivery Boy: ${filters.deliveryBoy}`);
  if (filters.mode && filters.mode !== 'All' && !filters.mode.includes('Select')) filterItems.push(`Mode: ${filters.mode}`);
  filterItems.push(`City: ${filters.city || 'Chennai'}`);
  if (filters.paymentMethod && filters.paymentMethod !== 'All' && !filters.paymentMethod.includes('Select')) filterItems.push(`Payment Method: ${filters.paymentMethod}`);
  const filterInfo = filterItems.join(' | ');

  const headers = ['Date', 'Customer', 'Amount (Rs)', 'Promocode', 'Cashback (Rs)', 'Payment Method', 'Remark', 'Mode', 'Narration'];
  const tableRows = (rows || []).map(r => [
    r.date || '',
    r.customer || '',
    r.amount ?? '',
    r.promocode || '-',
    r.cashback_amount ?? '',
    r.payment_method || '',
    r.remark || '',
    r.mode || '',
    r.narration || ''
  ]);
  if (totalsRow) {
    tableRows.push([
      'Total', '',
      totalsRow.amount ?? '',
      '',
      totalsRow.cashback_amount ?? '',
      '', '', '', ''
    ]);
  }
  const summaryBoxes = [
    { label: 'Total Recharged', value: `Rs. ${totalAmountRecharged || 0}` },
    { label: 'Total Cashback', value: `Rs. ${totalCashback || 0}` }
  ];
  downloadDirectPDF({
    fileName,
    reportTitle: 'Payment Collection Report',
    filterInfo,
    headers,
    rows: tableRows,
    summaryBoxes,
    orientation: 'landscape'
  });
};

/**
 * Export Payment Approval Report as PDF
 */
export const exportPaymentApprovalPDF = ({ rows, startDate, endDate, filterInfo }) => {
  const fileName = `Payment_Approval_Report_${startDate || ''}_to_${endDate || ''}.pdf`;
  const headers = ['Customer ID', 'Customer Name', 'Payment Date', 'Remark', 'Amount (Rs)', 'Entry By', 'Approval'];
  const tableRows = (rows || []).map(r => [
    r.customer_id || '',
    r.customer || '',
    r.pay_date || '',
    r.remark || '',
    parseFloat(r.amount || 0).toFixed(2),
    r.entry_by || 'Admin',
    r.approval || 'Approved'
  ]);
  downloadDirectPDF({
    fileName,
    reportTitle: 'Payment Approval Report',
    filterInfo: filterInfo || `Period: ${startDate} to ${endDate}`,
    headers,
    rows: tableRows,
    orientation: 'landscape'
  });
};

/**
 * Export Manage Customer Billing Report as Excel
 */
export const exportCustomerBillingExcel = ({ rows, startDate, endDate, filterInfo }) => {
  const headers = ['Customer ID', 'Customer Name', 'Phone', 'From Date', 'To Date', 'Bill Amount', 'Paid Amount', 'Remaining Amount', 'Status'];
  const excelRows = rows.map(r => [
    r.customer_id || '',
    r.customer_name || '',
    r.phone || '',
    r.from_date || '',
    r.to_date || '',
    parseFloat(r.bill_amount || 0),
    parseFloat(r.paid_amount || 0),
    parseFloat(r.remaining_amount || 0),
    r.status || 'Active',
  ]);

  exportToExcel({
    fileName: `Customer_Billing_${startDate}_to_${endDate}`,
    sheetName: 'Customer Billing',
    reportTitle: 'Manage Customer Billing',
    filterInfo,
    headers,
    rows: excelRows,
  });
};

/**
 * Export Sales Report as Excel
 */
export const exportSalesReportExcel = ({ rows, startDate, endDate, filterInfo }) => {
  const headers = ['Customer ID', 'Customer Name', 'Route', 'Date', 'Amount'];
  const excelRows = rows.map(r => [
    r.customer_id || '',
    r.customer || '',
    r.route || '',
    r.date || '',
    parseFloat(r.amount || 0),
  ]);

  exportToExcel({
    fileName: `Sales_Report_${startDate}_to_${endDate}`,
    sheetName: 'Sales Report',
    reportTitle: 'Sales Report',
    filterInfo,
    headers,
    rows: excelRows,
  });
};





const { readFromCRM, writeToCRM, readFromApp } = require('../config/database');
const { getExpectedOperationalDate, getISTDateStr } = require('../services/operationalDay.service');

// ─────────────────────────────────────────────
// GET /api/reports/daily-summary
// ─────────────────────────────────────────────
const getDailySummary = async (req, res, next) => {
  try {
    const { date } = req.query;
    // Default to active operational day (7:00 PM IST boundary) if no date provided
    const d = date || getExpectedOperationalDate();

    const [deliveries, payments, walletRecharge, newCustomers, milk] = await Promise.all([
      readFromCRM(`SELECT COUNT(*) as total,
        COUNT(CASE WHEN status='Delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN status='Failed' THEN 1 END) as failed
        FROM deliveries WHERE DATE(created_at)=$1`, [d]),
      readFromCRM(`SELECT COALESCE(SUM(amount),0) as total,
        COUNT(*) as count FROM payments WHERE payment_date=$1 AND status='Verified'`, [d]),
      readFromCRM(`SELECT COALESCE(SUM(amount),0) as total FROM wallet_transactions WHERE DATE(created_at)=$1 AND type='Recharge'`, [d]),
      readFromCRM(`SELECT COUNT(*) FROM customers WHERE DATE(created_at)=$1`, [d]),
      readFromCRM(`SELECT * FROM milk_inventory WHERE date=$1`, [d]),
    ]);

    res.json({
      success: true,
      date: d,
      data: {
        deliveries: deliveries.rows[0],
        payments: payments.rows[0],
        wallet_recharge: parseFloat(walletRecharge.rows[0].total),
        new_customers: parseInt(newCustomers.rows[0].count),
        milk_inventory: milk.rows[0] || null,
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/reports/monthly
// ─────────────────────────────────────────────
const getMonthlyReport = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const [revenue, customers, deliveries, walletStats] = await Promise.all([
      readFromCRM(
        `SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count
         FROM payments
         WHERE EXTRACT(MONTH FROM payment_date)=$1 AND EXTRACT(YEAR FROM payment_date)=$2 AND status='Verified'`,
        [m, y]
      ),
      readFromCRM(
        `SELECT COUNT(*) as new_customers FROM customers
         WHERE EXTRACT(MONTH FROM created_at)=$1 AND EXTRACT(YEAR FROM created_at)=$2`,
        [m, y]
      ),
      readFromCRM(
        `SELECT COUNT(*) as total,
          COUNT(CASE WHEN status='Delivered' THEN 1 END) as delivered
         FROM deliveries
         WHERE EXTRACT(MONTH FROM created_at)=$1 AND EXTRACT(YEAR FROM created_at)=$2`,
        [m, y]
      ),
      readFromCRM(
        `SELECT COALESCE(SUM(amount),0) as recharged
         FROM wallet_transactions
         WHERE type='Recharge' AND EXTRACT(MONTH FROM created_at)=$1 AND EXTRACT(YEAR FROM created_at)=$2`,
        [m, y]
      ),
    ]);

    res.json({
      success: true,
      month: m,
      year: y,
      data: {
        revenue: revenue.rows[0],
        customers: customers.rows[0],
        deliveries: deliveries.rows[0],
        wallet_recharged: parseFloat(walletStats.rows[0].recharged),
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/reports/revenue — monthly revenue trend
// ─────────────────────────────────────────────
const getRevenueTrend = async (req, res, next) => {
  try {
    const { months = 12 } = req.query;
    const [revenueByMonth, rechargeByMonth, customersByMonth] = await Promise.all([
      readFromCRM(
        `SELECT TO_CHAR(DATE_TRUNC('month', payment_date), 'Mon YYYY') as month,
                DATE_TRUNC('month', payment_date) as month_date,
                COALESCE(SUM(amount),0) as revenue, COUNT(*) as transactions
         FROM payments
         WHERE payment_date >= NOW() - INTERVAL '${parseInt(months)} months' AND status='Verified'
         GROUP BY DATE_TRUNC('month', payment_date)
         ORDER BY month_date`
      ),
      readFromCRM(
        `SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as month,
                COALESCE(SUM(amount),0) as recharged
         FROM wallet_transactions
         WHERE type='Recharge' AND created_at >= NOW() - INTERVAL '${parseInt(months)} months'
         GROUP BY DATE_TRUNC('month', created_at)
         ORDER BY DATE_TRUNC('month', created_at)`
      ),
      readFromCRM(
        `SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as month,
                COUNT(*) as count
         FROM customers
         WHERE created_at >= NOW() - INTERVAL '${parseInt(months)} months'
         GROUP BY DATE_TRUNC('month', created_at)
         ORDER BY DATE_TRUNC('month', created_at)`
      ),
    ]);
    res.json({
      success: true,
      data: {
        revenue_by_month: revenueByMonth.rows,
        recharge_by_month: rechargeByMonth.rows,
        customers_by_month: customersByMonth.rows,
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/reports/customer-analysis
// ─────────────────────────────────────────────
const getCustomerAnalysis = async (req, res, next) => {
  try {
    const [statusBreakdown, topCustomers, routeDistribution] = await Promise.all([
      readFromCRM(`SELECT status, COUNT(*) as count FROM customers GROUP BY status`),
      readFromCRM(
        `SELECT c.name, c.customer_code, c.phone, w.balance, w.total_recharged
         FROM customers c LEFT JOIN wallet w ON w.customer_id = c.id
         ORDER BY w.total_recharged DESC NULLS LAST LIMIT 10`
      ),
      readFromCRM(
        `SELECT r.route_name, COUNT(c.id) as customer_count
         FROM routes r LEFT JOIN customers c ON c.assigned_route_id = r.id
         GROUP BY r.id, r.route_name ORDER BY customer_count DESC`
      ),
    ]);
    res.json({
      success: true,
      data: {
        status_breakdown: statusBreakdown.rows,
        top_customers: topCustomers.rows,
        route_distribution: routeDistribution.rows,
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/reports/feedback
// ─────────────────────────────────────────────
const getFeedback = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status = '' } = req.query;
    const offset = (page - 1) * limit;
    let where = status ? `WHERE f.status='${status}'` : '';
    const [rows, count] = await Promise.all([
      readFromCRM(
        `SELECT f.*, c.name as customer_name, c.phone FROM feedback f
         LEFT JOIN customers c ON c.id = f.customer_id
         ${where}
         ORDER BY f.created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      readFromCRM(`SELECT COUNT(*) FROM feedback f ${where}`),
    ]);
    res.json({ success: true, data: rows.rows, total: parseInt(count.rows[0].count) });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/reports/sms-log
// ─────────────────────────────────────────────
const getSmsLog = async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;
    const [rows, count] = await Promise.all([
      readFromCRM('SELECT * FROM sms_notifications ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]),
      readFromCRM('SELECT COUNT(*) FROM sms_notifications'),
    ]);
    res.json({ success: true, data: rows.rows, total: parseInt(count.rows[0].count) });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/reports/logistics
// ─────────────────────────────────────────────
const getLogisticsOverview = async (req, res, next) => {
  try {
    const [routes, dispatches, deliveries] = await Promise.all([
      readFromCRM(
        `SELECT r.*, b.branch_name,
          (SELECT COUNT(*) FROM route_assignments ra WHERE ra.route_id = r.id) as customer_count
         FROM routes r LEFT JOIN branches b ON b.id = r.branch_id
         ORDER BY r.created_at DESC`
      ),
      readFromCRM(
        `SELECT dd.*, r.route_name FROM daily_dispatch dd
         LEFT JOIN routes r ON r.id = dd.route_id
         WHERE dd.date >= $1
         ORDER BY dd.date DESC, dd.created_at DESC`,
        [(() => { const d = new Date(`${getExpectedOperationalDate()}T12:00:00+05:30`); d.setDate(d.getDate() - 7); return getISTDateStr(d); })()]
      ),
      readFromCRM(
        `SELECT status, COUNT(*) as count FROM deliveries
         WHERE DATE(created_at AT TIME ZONE 'Asia/Kolkata') = $1 GROUP BY status`,
        [getExpectedOperationalDate()]
      ),
    ]);
    res.json({
      success: true,
      data: {
        routes: routes.rows,
        recent_dispatches: dispatches.rows,
        today_deliveries: deliveries.rows,
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/reports/archived — Get stored/archived generated reports
// ─────────────────────────────────────────────
const getArchivedReports = async (req, res, next) => {
  try {
    const { category, report_type, format, search, startDate, endDate } = req.query;
    let whereClauses = [];
    let params = [];

    const targetType = category || report_type;
    if (targetType) {
      params.push(targetType);
      whereClauses.push(`report_type = $${params.length}`);
    }

    if (format) {
      params.push(format);
      whereClauses.push(`format = $${params.length}`);
    }

    if (startDate && endDate) {
      params.push(startDate);
      whereClauses.push(`date_from >= $${params.length}`);
      params.push(endDate);
      whereClauses.push(`date_to <= $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      whereClauses.push(`(report_name ILIKE $${params.length} OR report_type ILIKE $${params.length} OR generated_by ILIKE $${params.length})`);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const result = await readFromCRM(
      `SELECT id, report_name, report_type, date_from, date_to, format, file_url, status, generated_by, generated_at
       FROM reports
       ${whereStr}
       ORDER BY generated_at DESC`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/reports/download/:id — Download an archived report by ID
// ─────────────────────────────────────────────
const downloadArchivedReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await readFromCRM(
      `SELECT id, report_name, report_type, format, report_data FROM reports WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const rep = result.rows[0];
    if (!rep.report_data) {
      return res.status(404).json({ success: false, message: 'Report file data not available' });
    }

    const fileBuffer = Buffer.from(rep.report_data, 'base64');
    const fileName = rep.report_name || `Maram_Milk_${rep.report_type.replace(/\s+/g, '_')}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    return res.send(fileBuffer);
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/reports/stock-correctness — Stock Correctness Report
// ─────────────────────────────────────────────
const getStockCorrectnessReport = async (req, res, next) => {
  try {
    const { type = 'daily', date, startDate, endDate, month, year } = req.query;
    const istToday = getExpectedOperationalDate();

    let whereClauses = [];
    let params = [];

    if (type === 'daily') {
      const targetDate = date || istToday;
      params.push(targetDate);
      whereClauses.push(`operational_day = $${params.length}`);
    } else if (type === 'monthly') {
      const m = month ? String(month).padStart(2, '0') : String(new Date().getMonth() + 1).padStart(2, '0');
      const y = year || new Date().getFullYear();
      const monthPrefix = `${y}-${m}`;
      params.push(`${monthPrefix}%`);
      whereClauses.push(`operational_day::TEXT LIKE $${params.length}`);
    } else if (type === 'custom' && startDate && endDate) {
      params.push(startDate);
      whereClauses.push(`operational_day >= $${params.length}`);
      params.push(endDate);
      whereClauses.push(`operational_day <= $${params.length}`);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const result = await readFromCRM(
      `SELECT id, operational_day::TEXT AS "operationalDay",
              product_id AS "productId", product_name AS "productName",
              expected_quantity AS "expectedStock",
              manager_logged_quantity AS "managerLoggedStock",
              difference, status, review_status AS "reviewStatus",
              remarks, reviewed_by AS "reviewedBy", detected_at AS "detectedAt"
       FROM stock_correctness_logs
       ${whereStr}
       ORDER BY operational_day DESC, product_name ASC`,
      params
    );

    const rows = result.rows.map(r => ({
      ...r,
      expectedStock: parseFloat(r.expectedStock || 0),
      managerLoggedStock: r.managerLoggedStock !== null ? parseFloat(r.managerLoggedStock) : null,
      difference: parseFloat(r.difference || 0),
    }));

    return res.json({
      success: true,
      reportType: 'Stock Correctness',
      filterType: type,
      totalRecords: rows.length,
      data: rows,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/reports/filter-options — Options for General Reports filters
// ─────────────────────────────────────────────
const getReportFilterOptions = async (req, res, next) => {
  try {
    const [custRes, routeRes, dpRes] = await Promise.all([
      readFromCRM(
        `SELECT id, customer_code, name, phone, address FROM customers ORDER BY name ASC`
      ).catch(() => ({ rows: [] })),
      readFromCRM(
        `SELECT id, route_name FROM routes ORDER BY route_name ASC`
      ).catch(() => ({ rows: [] })),
      readFromApp(
        `SELECT id, name, "dpCode", "mobileNumber", zone FROM "DeliveryPerson" WHERE "isActive" = true ORDER BY name ASC`
      ).catch(() => ({ rows: [] })),
    ]);

    res.json({
      success: true,
      data: {
        customers: custRes.rows.map(c => ({
          id: c.id,
          customer_code: c.customer_code,
          name: c.name,
          phone: c.phone,
          label: `${c.customer_code ? c.customer_code + ' - ' : ''}${c.name} (${c.phone || ''})`
        })),
        routes: routeRes.rows.map(r => ({
          id: r.id,
          route_name: r.route_name,
        })),
        deliveryBoys: dpRes.rows.map(d => ({
          id: d.id,
          dpCode: d.dpCode,
          name: d.name,
          phone: d.mobileNumber || '',
          label: `${d.dpCode ? d.dpCode + ' - ' : ''}${d.name}`
        })),
      }
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/reports/audit-trail — General Reports: Audit Trail
// ─────────────────────────────────────────────
const getAuditTrailReport = async (req, res, next) => {
  try {
    const { customer_id = '', date_from = '', date_to = '' } = req.query;

    let whereClauses = ['1=1'];
    let params = [];
    let pi = 1;

    if (customer_id) {
      whereClauses.push(`wt.customer_id = $${pi++}`);
      params.push(customer_id);
    }

    if (date_from) {
      whereClauses.push(`DATE(wt.created_at AT TIME ZONE 'Asia/Kolkata') >= $${pi++}`);
      params.push(date_from);
    }

    if (date_to) {
      whereClauses.push(`DATE(wt.created_at AT TIME ZONE 'Asia/Kolkata') <= $${pi++}`);
      params.push(date_to);
    }

    const whereStr = whereClauses.join(' AND ');

    const result = await readFromCRM(
      `SELECT 
        wt.id,
        wt.created_at,
        wt.type,
        wt.amount,
        wt.method,
        wt.reference,
        wt.description,
        wt.status,
        c.id as customer_id,
        c.customer_code,
        c.name as customer_name,
        c.phone as customer_phone
       FROM wallet_transactions wt
       LEFT JOIN customers c ON c.id = wt.customer_id
       WHERE ${whereStr}
       ORDER BY wt.created_at DESC`,
      params
    ).catch(() => ({ rows: [] }));

    let paymentParams = [];
    let paymentWhere = ['1=1'];
    let ppi = 1;

    if (customer_id) {
      paymentWhere.push(`p.customer_id = $${ppi++}`);
      paymentParams.push(customer_id);
    }
    if (date_from) {
      paymentWhere.push(`p.payment_date >= $${ppi++}`);
      paymentParams.push(date_from);
    }
    if (date_to) {
      paymentWhere.push(`p.payment_date <= $${ppi++}`);
      paymentParams.push(date_to);
    }

    const paymentsRes = await readFromCRM(
      `SELECT 
        p.id,
        p.created_at,
        p.payment_date,
        p.amount,
        p.method,
        p.transaction_ref as reference,
        p.status,
        p.verified_by,
        c.id as customer_id,
        c.customer_code,
        c.name as customer_name
       FROM payments p
       LEFT JOIN customers c ON c.id = p.customer_id
       WHERE ${paymentWhere.join(' AND ')}
       ORDER BY p.created_at DESC`,
      paymentParams
    ).catch(() => ({ rows: [] }));

    const mappedWallet = result.rows.map((row) => {
      const custLabel = row.customer_code ? `${row.customer_code} - ${row.customer_name}` : row.customer_name || 'Customer';
      const istDate = row.created_at ? new Date(row.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '';
      const actionType = row.type || 'Wallet Transaction';
      const isCredit = ['Recharge', 'Credit', 'Refund', 'Adjustment'].includes(actionType);
      const dateStr = row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : '';
      const narrationText = `Wallet Transaction
Customer: ${custLabel}
Transaction Date: ${dateStr}
Amount ${isCredit ? 'credited' : 'debited'}: ₹${parseFloat(row.amount || 0).toFixed(2)}
Type: ${actionType} (${row.method || 'System'})
${row.reference ? 'Reference: ' + row.reference + '\n' : ''}${row.description ? 'Details: ' + row.description : ''}`.trim();

      return {
        id: row.id,
        date: istDate || dateStr,
        raw_date: row.created_at,
        user: 'Super Admin',
        action_taken_on: custLabel,
        narration: narrationText,
        amount: parseFloat(row.amount || 0),
        type: actionType,
        customer_id: row.customer_id,
      };
    });

    const mappedPayments = paymentsRes.rows.map((p) => {
      const custLabel = p.customer_code ? `${p.customer_code} - ${p.customer_name}` : p.customer_name || 'Customer';
      const istDate = p.created_at ? new Date(p.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : (p.payment_date || '');
      const narrationText = `Payment Transaction
Customer: ${custLabel}
Payment Date: ${p.payment_date || ''}
Status: ${p.status || 'Verified'}
Method: ${p.method || 'Cash'}
Amount received: ₹${parseFloat(p.amount || 0).toFixed(2)}
${p.reference ? 'Transaction Ref: ' + p.reference : ''}`.trim();

      return {
        id: p.id,
        date: istDate,
        raw_date: p.created_at || p.payment_date,
        user: p.verified_by || 'Super Admin',
        action_taken_on: custLabel,
        narration: narrationText,
        amount: parseFloat(p.amount || 0),
        type: 'Payment',
        customer_id: p.customer_id,
      };
    });

    const combined = [...mappedWallet];
    for (const pm of mappedPayments) {
      if (!combined.some(c => c.id === pm.id)) {
        combined.push(pm);
      }
    }
    combined.sort((a, b) => new Date(b.raw_date || 0) - new Date(a.raw_date || 0));

    const finalRows = combined.map((item, idx) => ({
      sr_no: idx + 1,
      ...item
    }));

    res.json({
      success: true,
      reportType: 'Audit Trail',
      totalRecords: finalRows.length,
      data: finalRows,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/reports/daily-planner — General Reports: Daily Planner / Delivery Report
// ─────────────────────────────────────────────
const getDailyPlannerReport = async (req, res, next) => {
  try {
    const { date, dp_ref_id = '', area_id = '', area = '' } = req.query;
    const targetDate = date || getExpectedOperationalDate();
    const targetArea = area || area_id;

    let dpMap = new Map();
    try {
      const dps = await readFromApp('SELECT id, name, "dpCode" FROM "DeliveryPerson"');
      for (const d of dps.rows) {
        dpMap.set(d.id, d.name);
        if (d.dpCode) dpMap.set(d.dpCode, d.name);
      }
    } catch (e) { /* silent */ }

    let routeMap = new Map();
    const crmRoutes = await readFromCRM('SELECT id, route_name FROM routes').catch(() => ({ rows: [] }));
    for (const r of crmRoutes.rows) {
      routeMap.set(r.id, r.route_name);
    }

    const deliveriesRes = await readFromCRM(
      `SELECT 
        d.id,
        d.quantity,
        d.status as delivery_status,
        c.id as customer_id,
        c.customer_code,
        c.name as customer_name,
        c.address,
        c.phone,
        c.assigned_route_id,
        c.dp_ref_id as cust_dp_id,
        p.id as product_id,
        p.name as product_name,
        p.unit,
        p.category,
        p.packing_type,
        r.id as route_id,
        r.route_name,
        b.branch_name,
        dd.dp_ref_id as dispatch_dp_id,
        'Subscription' as type,
        s.frequency
       FROM deliveries d
       JOIN daily_dispatch dd ON dd.id = d.dispatch_id
       JOIN customers c ON c.id = d.customer_id
       LEFT JOIN subscriptions s ON (s.customer_id = c.id AND s.product_id = d.product_id)
       LEFT JOIN products p ON p.id = d.product_id
       LEFT JOIN routes r ON (r.id = dd.route_id OR r.id::text = c.assigned_route_id OR LOWER(r.route_name) = LOWER(c.assigned_route_id))
       LEFT JOIN branches b ON b.id = r.branch_id
       WHERE dd.date = $1`,
      [targetDate]
    ).catch(() => ({ rows: [] }));

    let subscriptionRows = deliveriesRes.rows;

    if (subscriptionRows.length === 0) {
      const activeSubsRes = await readFromCRM(
        `SELECT 
          s.id as subscription_id,
          s.quantity,
          s.frequency,
          s.start_date,
          c.id as customer_id,
          c.customer_code,
          c.name as customer_name,
          c.address,
          c.phone,
          c.assigned_route_id,
          c.dp_ref_id as cust_dp_id,
          p.id as product_id,
          p.name as product_name,
          p.unit,
          p.category,
          p.packing_type,
          r.id as route_id,
          r.route_name,
          b.branch_name,
          'Subscription' as type
         FROM subscriptions s
         JOIN customers c ON c.id = s.customer_id
         JOIN products p ON p.id = s.product_id
         LEFT JOIN routes r ON (r.id::text = c.assigned_route_id OR LOWER(r.route_name) = LOWER(c.assigned_route_id))
         LEFT JOIN branches b ON b.id = r.branch_id
         WHERE s.status = 'Active'
           AND c.status = 'Active'
           AND s.start_date <= $1
           AND NOT EXISTS (
             SELECT 1 FROM subscription_pauses sp 
             WHERE sp.customer_id = c.id 
               AND sp.status = 'Active' 
               AND ((sp.pause_type = 'Single Date' AND sp.pause_date = $1)
                    OR (sp.pause_type = 'Vacation' AND sp.pause_date <= $1 AND (sp.resume_date IS NULL OR sp.resume_date > $1)))
           )`,
        [targetDate]
      ).catch(() => ({ rows: [] }));

      subscriptionRows = activeSubsRes.rows;
    }

    const adhocSalesRes = await readFromCRM(
      `SELECT 
        acs.id,
        acs.quantity,
        acs.unit_price,
        acs.total_amount,
        acs.dp_ref_id,
        acs.dp_name,
        acs.route_id,
        acs.route_name,
        c.id as customer_id,
        c.customer_code,
        c.name as customer_name,
        c.address,
        c.phone,
        p.id as product_id,
        p.name as product_name,
        p.unit,
        p.category,
        p.packing_type,
        'AdHoc' as type
       FROM adhoc_customer_sales acs
       LEFT JOIN customers c ON c.id = acs.customer_id
       LEFT JOIN products p ON p.id = acs.product_id
       WHERE acs.date = $1`,
      [targetDate]
    ).catch(() => ({ rows: [] }));

    const mappedSubscriptions = subscriptionRows.map((r) => {
      const dpId = r.dispatch_dp_id || r.cust_dp_id;
      const dpName = r.dp_name || dpMap.get(dpId) || dpId || 'Unassigned';
      const routeName = r.route_name || routeMap.get(r.assigned_route_id) || r.assigned_route_id || 'General Area';
      const packing = r.packing_type || ((r.unit || '').toLowerCase().includes('packet') || (r.product_name || '').toLowerCase().includes('pouch') || (r.product_name || '').toLowerCase().includes('packet') ? 'Pouch' : 'Bottle');

      return {
        id: r.id || r.subscription_id,
        customer_code: r.customer_code || 'CUST',
        customer_name: r.customer_name || r.name || 'Unknown',
        address: r.address || 'N/A',
        mobile: r.phone || 'N/A',
        hub: 'Royapettah',
        delivery_boy: dpName,
        dp_ref_id: dpId,
        area: routeName,
        route_id: r.route_id || r.assigned_route_id,
        mode: r.frequency || 'Daily',
        product: r.product_name || 'Milk Product',
        product_qty: parseFloat(r.quantity || 1),
        type: 'Subscription',
        delivery_type: packing,
      };
    });

    const mappedAdhoc = adhocSalesRes.rows.map((a) => {
      const dpName = a.dp_name || dpMap.get(a.dp_ref_id) || a.dp_ref_id || 'Unassigned';
      const routeName = a.route_name || routeMap.get(a.route_id) || 'General Area';
      const packing = a.packing_type || ((a.unit || '').toLowerCase().includes('packet') || (a.product_name || '').toLowerCase().includes('pouch') ? 'Pouch' : 'Bottle');

      return {
        id: a.id,
        customer_code: a.customer_code || 'CUST',
        customer_name: a.customer_name || 'Unknown',
        address: a.address || 'N/A',
        mobile: a.phone || 'N/A',
        hub: 'Royapettah',
        delivery_boy: dpName,
        dp_ref_id: a.dp_ref_id,
        area: routeName,
        route_id: a.route_id,
        mode: 'AdHoc Sale',
        product: a.product_name || 'AdHoc Product',
        product_qty: parseFloat(a.quantity || 1),
        type: 'AdHoc',
        delivery_type: packing,
      };
    });

    let combined = [...mappedSubscriptions, ...mappedAdhoc];

    if (dp_ref_id) {
      combined = combined.filter(item => 
        item.dp_ref_id === dp_ref_id || 
        (item.delivery_boy || '').toLowerCase().includes(dp_ref_id.toLowerCase())
      );
    }

    if (targetArea) {
      combined = combined.filter(item => 
        item.route_id === targetArea || 
        (item.area || '').toLowerCase().includes(targetArea.toLowerCase())
      );
    }

    const productTotals = {};
    let totalBottle = 0;
    let totalPouch = 0;

    combined.forEach(item => {
      const prodName = item.product;
      const qty = item.product_qty;

      productTotals[prodName] = (productTotals[prodName] || 0) + qty;

      const delType = (item.delivery_type || '').toLowerCase();
      const pName = (item.product || '').toLowerCase();

      if (delType.includes('bottle') || pName.includes('bottle') || pName.includes(' 1l') || pName.includes('one litre')) {
        totalBottle += qty;
      } else if (delType.includes('pouch') || delType.includes('packet') || pName.includes('pouch') || pName.includes('packet')) {
        totalPouch += qty;
      } else {
        totalBottle += qty;
      }
    });

    res.json({
      success: true,
      reportType: 'Daily Planner / Delivery Report',
      date: targetDate,
      totalRecords: combined.length,
      summary: {
        productTotals,
        totalBottle: Math.round(totalBottle * 1000) / 1000,
        totalPouch: Math.round(totalPouch * 1000) / 1000,
      },
      data: combined,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/reports/customer-statement — General Reports: Customer Statement
// ─────────────────────────────────────────────
const getCustomerStatementReport = async (req, res, next) => {
  try {
    const { customer_id = '', date_from = '', date_to = '' } = req.query;

    if (!customer_id) {
      return res.json({
        success: true,
        reportType: 'Customer Statement',
        totalRecords: 0,
        data: [],
        message: 'Please select a customer to view their statement.'
      });
    }

    const dFrom = date_from || (() => {
      const d = new Date();
      d.setDate(1);
      return d.toISOString().split('T')[0];
    })();
    const dTo = date_to || getExpectedOperationalDate();

    const custRes = await readFromCRM('SELECT id, customer_code, name, phone, address FROM customers WHERE id = $1', [customer_id]);
    if (custRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }
    const cust = custRes.rows[0];

    const deliveriesRes = await readFromCRM(
      `SELECT 
        d.id,
        DATE(d.created_at AT TIME ZONE 'Asia/Kolkata')::text as date,
        d.quantity,
        d.status,
        p.name as product_name,
        p.price_per_unit
       FROM deliveries d
       JOIN daily_dispatch dd ON dd.id = d.dispatch_id
       LEFT JOIN products p ON p.id = d.product_id
       WHERE d.customer_id = $1 
         AND DATE(d.created_at AT TIME ZONE 'Asia/Kolkata') >= $2
         AND DATE(d.created_at AT TIME ZONE 'Asia/Kolkata') <= $3
       ORDER BY date ASC`,
      [customer_id, dFrom, dTo]
    ).catch(() => ({ rows: [] }));

    const pausesRes = await readFromCRM(
      `SELECT pause_date::text, resume_date::text, pause_type, status 
       FROM subscription_pauses 
       WHERE customer_id = $1 AND status = 'Active'`,
      [customer_id]
    ).catch(() => ({ rows: [] }));

    const adhocRes = await readFromCRM(
      `SELECT 
        id,
        date::text,
        product_name,
        quantity,
        total_amount
       FROM adhoc_customer_sales
       WHERE customer_id = $1 AND date >= $2 AND date <= $3
       ORDER BY date ASC`,
      [customer_id, dFrom, dTo]
    ).catch(() => ({ rows: [] }));

    const bottleRes = await readFromCRM(
      `SELECT 
        DATE(created_at AT TIME ZONE 'Asia/Kolkata')::text as date,
        COALESCE(broken_count, 0) + COALESCE(missing_count, 0) as collected_count
       FROM empty_bottle_incidents
       WHERE dp_name ILIKE $1 OR manager_notes ILIKE $1`,
      [`%${cust.customer_code}%`]
    ).catch(() => ({ rows: [] }));

    const subsRes = await readFromCRM(
      `SELECT s.id, s.quantity, s.frequency, s.start_date, p.name as product_name, p.price_per_unit
       FROM subscriptions s
       LEFT JOIN products p ON p.id = s.product_id
       WHERE s.customer_id = $1 AND s.status = 'Active'`,
      [customer_id]
    ).catch(() => ({ rows: [] }));

    const statementMap = new Map();
    const curr = new Date(dFrom);
    const end = new Date(dTo);

    while (curr <= end) {
      const dtStr = curr.toISOString().split('T')[0];
      statementMap.set(dtStr, {
        date: dtStr,
        narrations: [],
        subscribed_qty: 0,
        is_paused: false,
        adhoc_qty: 0,
        total_delivered: 0,
        empty_bottles: 0,
        amount: 0,
      });
      curr.setDate(curr.getDate() + 1);
    }

    pausesRes.rows.forEach(p => {
      const pDate = p.pause_date;
      if (pDate && statementMap.has(pDate)) {
        const item = statementMap.get(pDate);
        item.is_paused = true;
      }
    });

    if (deliveriesRes.rows.length > 0) {
      deliveriesRes.rows.forEach(d => {
        if (statementMap.has(d.date)) {
          const item = statementMap.get(d.date);
          const qty = parseFloat(d.quantity || 1);
          const price = parseFloat(d.price_per_unit || 0);
          item.subscribed_qty += qty;
          item.narrations.push(`Milk Delivered (${d.product_name || 'Milk'}: ${qty})`);
          item.amount += qty * price;
        }
      });
    } else {
      subsRes.rows.forEach(sub => {
        statementMap.forEach((item, dtStr) => {
          if (dtStr >= (sub.start_date || dFrom) && !item.is_paused) {
            const qty = parseFloat(sub.quantity || 1);
            const price = parseFloat(sub.price_per_unit || 50);
            item.subscribed_qty += qty;
            item.narrations.push(`Milk Delivered (${sub.product_name || 'Milk Bottle'}: ${qty})`);
            item.amount += qty * price;
          }
        });
      });
    }

    adhocRes.rows.forEach(a => {
      if (statementMap.has(a.date)) {
        const item = statementMap.get(a.date);
        const qty = parseFloat(a.quantity || 1);
        const amt = parseFloat(a.total_amount || 0);
        item.adhoc_qty += qty;
        item.narrations.push(`Adhoc Delivered (${a.product_name}: ${qty})`);
        item.amount += amt;
      }
    });

    bottleRes.rows.forEach(b => {
      if (statementMap.has(b.date)) {
        const item = statementMap.get(b.date);
        item.empty_bottles += parseInt(b.collected_count || 0);
      }
    });

    const statementRows = [];
    let srNo = 1;

    statementMap.forEach((item) => {
      let narrationText = '';
      if (item.is_paused && item.subscribed_qty === 0 && item.adhoc_qty === 0) {
        narrationText = 'Paused';
      } else if (item.narrations.length > 0) {
        narrationText = item.narrations.join(', ');
      } else {
        narrationText = 'No Delivery';
      }

      const totalDelivered = item.subscribed_qty + item.adhoc_qty;

      statementRows.push({
        sr_no: srNo++,
        date: item.date,
        narration: narrationText,
        subscribed: item.subscribed_qty > 0 ? item.subscribed_qty : '-',
        pause: item.is_paused ? 'Yes' : '-',
        adhoc: item.adhoc_qty > 0 ? item.adhoc_qty : 0,
        total_delivered: totalDelivered,
        empty_bottle_collected: item.empty_bottles,
        amount: item.amount > 0 ? `₹${item.amount.toFixed(2)}` : '₹0',
      });
    });

    res.json({
      success: true,
      reportType: 'Customer Statement',
      customer: {
        id: cust.id,
        code: cust.customer_code,
        name: cust.name,
        phone: cust.phone,
      },
      date_from: dFrom,
      date_to: dTo,
      totalRecords: statementRows.length,
      data: statementRows,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/reports/customer-info — Customer Information Report
// ─────────────────────────────────────────────
const getCustomerInfoReport = async (req, res, next) => {
  try {
    const { customer_id = '', page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const offset = (pageNum - 1) * limitNum;

    let whereClauses = ['1=1'];
    let params = [];
    let pi = 1;

    if (customer_id) {
      whereClauses.push(`c.id = $${pi++}`);
      params.push(customer_id);
    }

    const whereStr = whereClauses.join(' AND ');

    const countRes = await readFromCRM(
      `SELECT COUNT(*) FROM customers c WHERE ${whereStr}`,
      params
    );
    const totalRecords = parseInt(countRes.rows[0].count, 10);

    const queryParams = [...params, limitNum, offset];
    const dataQuery = `
      SELECT 
        c.id,
        c.customer_code,
        c.name as customer_name,
        c.phone as mobile,
        COALESCE(w.balance, c.wallet_balance, 0) as wallet_balance,
        
        lr.last_recharge_date,
        lr.last_recharge_amount,

        lsd.last_sub_delivered_date,

        GREATEST(
          lsd.last_sub_delivered_date,
          lao.last_adhoc_delivered_date
        ) as last_order_delivered_date

      FROM customers c
      LEFT JOIN wallet w ON w.customer_id = c.id

      LEFT JOIN LATERAL (
        SELECT 
          DATE(COALESCE(wt.created_at, p.payment_date::timestamptz) AT TIME ZONE 'Asia/Kolkata')::text as last_recharge_date,
          COALESCE(wt.amount, p.amount) as last_recharge_amount
        FROM wallet_transactions wt
        FULL OUTER JOIN payments p ON (p.customer_id = wt.customer_id AND p.status = 'Verified')
        WHERE COALESCE(wt.customer_id, p.customer_id) = c.id
        ORDER BY COALESCE(wt.created_at, p.payment_date::timestamptz) DESC
        LIMIT 1
      ) lr ON true

      LEFT JOIN LATERAL (
        SELECT 
          DATE(COALESCE(d.delivered_at, d.created_at) AT TIME ZONE 'Asia/Kolkata')::text as last_sub_delivered_date
        FROM deliveries d
        WHERE d.customer_id = c.id AND d.status = 'Delivered'
        ORDER BY COALESCE(d.delivered_at, d.created_at) DESC
        LIMIT 1
      ) lsd ON true

      LEFT JOIN LATERAL (
        SELECT 
          acs.date::text as last_adhoc_delivered_date
        FROM adhoc_customer_sales acs
        WHERE acs.customer_id = c.id
        ORDER BY acs.date DESC
        LIMIT 1
      ) lao ON true

      WHERE ${whereStr}
      ORDER BY c.customer_code ASC, c.name ASC
      LIMIT $${pi++} OFFSET $${pi++}
    `;

    const result = await readFromCRM(dataQuery, queryParams);

    const mappedRows = result.rows.map(row => ({
      id: row.id,
      customer_id: row.customer_code || row.id,
      customer_name: row.customer_name || 'N/A',
      mobile: row.mobile || 'N/A',
      wallet_balance: parseFloat(row.wallet_balance || 0),
      last_recharge_date: row.last_recharge_date || '-',
      last_recharge_amount: row.last_recharge_amount !== null ? parseFloat(row.last_recharge_amount) : '-',
      last_order_delivered_date: row.last_order_delivered_date || '-',
      last_subscription_delivered_date: row.last_sub_delivered_date || '-',
    }));

    res.json({
      success: true,
      reportType: 'Customer Information Report',
      totalRecords,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalRecords / limitNum),
      data: mappedRows,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/reports/delivery-planner-calendar — Monthly Delivery Planner for Selected Customer
// ─────────────────────────────────────────────
const getDeliveryPlannerCalendar = async (req, res, next) => {
  try {
    const { customer_id, month } = req.query;
    if (!customer_id) {
      return res.status(400).json({ success: false, message: 'Customer ID is required.' });
    }

    // Determine target month and year (e.g. '2026-10')
    let yearNum, monthNum;
    if (month && month.match(/^\d{4}-\d{2}$/)) {
      const parts = month.split('-');
      yearNum = parseInt(parts[0], 10);
      monthNum = parseInt(parts[1], 10);
    } else {
      const now = new Date();
      yearNum = now.getFullYear();
      monthNum = now.getMonth() + 1;
    }

    const monthStr = `${yearNum}-${String(monthNum).padStart(2, '0')}`;
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const startDateStr = `${monthStr}-01`;
    const endDateStr = `${monthStr}-${String(daysInMonth).padStart(2, '0')}`;

    // 1. Fetch Customer info
    let custRes;
    if (!isNaN(customer_id)) {
      custRes = await readFromCRM(
        `SELECT id, customer_code, name, mobile, address, city, hub FROM customers WHERE id = $1 OR customer_code = $2 LIMIT 1`,
        [parseInt(customer_id, 10), String(customer_id)]
      );
    } else {
      custRes = await readFromCRM(
        `SELECT id, customer_code, name, mobile, address, city, hub FROM customers WHERE customer_code = $1 LIMIT 1`,
        [String(customer_id)]
      );
    }

    if (custRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const customer = custRes.rows[0];

    // 2. Fetch deliveries for customer in date range
    const deliveriesRes = await readFromCRM(
      `SELECT 
        DATE(d.created_at AT TIME ZONE 'Asia/Kolkata')::text as date,
        d.status,
        d.quantity,
        p.name as product_name
       FROM deliveries d
       LEFT JOIN products p ON p.id = d.product_id
       WHERE d.customer_id = $1 
         AND DATE(d.created_at AT TIME ZONE 'Asia/Kolkata') >= $2
         AND DATE(d.created_at AT TIME ZONE 'Asia/Kolkata') <= $3
       ORDER BY date ASC`,
      [customer.id, startDateStr, endDateStr]
    ).catch(() => ({ rows: [] }));

    // 3. Fetch pause records for customer
    const pausesRes = await readFromCRM(
      `SELECT pause_date::text, resume_date::text, pause_type, status
       FROM subscription_pauses
       WHERE customer_id = $1 AND status = 'Active'`,
      [customer.id]
    ).catch(() => ({ rows: [] }));

    // 4. Fetch adhoc sales for customer
    const adhocRes = await readFromCRM(
      `SELECT date::text, product_name, quantity, total_amount
       FROM adhoc_customer_sales
       WHERE customer_id = $1 AND date >= $2 AND date <= $3
       ORDER BY date ASC`,
      [customer.id, startDateStr, endDateStr]
    ).catch(() => ({ rows: [] }));

    // 5. Fetch active subscriptions for customer
    const subsRes = await readFromCRM(
      `SELECT s.id, s.quantity, s.frequency, s.start_date, p.name as product_name
       FROM subscriptions s
       LEFT JOIN products p ON p.id = s.product_id
       WHERE s.customer_id = $1 AND s.status = 'Active'`,
      [customer.id]
    ).catch(() => ({ rows: [] }));

    // Month details
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = `${monthNames[monthNum - 1]} ${yearNum}`;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayPad = String(d).padStart(2, '0');
      const dateStr = `${monthStr}-${dayPad}`;
      const dtObj = new Date(yearNum, monthNum - 1, d);
      const dayName = dayNames[dtObj.getDay()];

      const monthAbbr = monthNames[monthNum - 1].substring(0, 3);
      const formattedDate = `${dayPad}-${monthAbbr}-${yearNum}`;

      const del = deliveriesRes.rows.find(r => r.date === dateStr);
      const isPaused = pausesRes.rows.some(p => {
        if (!p.pause_date) return false;
        if (p.pause_type === 'Single Date') return p.pause_date === dateStr;
        if (p.pause_type === 'Vacation') {
          return dateStr >= p.pause_date && (!p.resume_date || dateStr <= p.resume_date);
        }
        return p.pause_date === dateStr;
      });
      const adhoc = adhocRes.rows.find(a => a.date === dateStr);
      const sub = subsRes.rows.find(s => !s.start_date || dateStr >= String(s.start_date).substring(0, 10));

      let status = 'Not Delivered';
      let statusKey = 'NOT_DELIVERED';
      let product = '-';
      let quantity = '-';

      if (del) {
        if (del.status === 'Delivered') {
          status = 'Mark Delivered';
          statusKey = 'MARK_DELIVERED';
        } else {
          status = 'Not Delivered';
          statusKey = 'NOT_DELIVERED';
        }
        product = del.product_name || 'Milk';
        quantity = del.quantity ? `${del.quantity}` : '1';
      } else if (adhoc) {
        status = 'AdHoc';
        statusKey = 'ADHOC';
        product = adhoc.product_name || 'AdHoc Product';
        quantity = adhoc.quantity ? `${adhoc.quantity}` : '1';
      } else if (isPaused) {
        status = 'Pause';
        statusKey = 'PAUSE';
        product = sub ? (sub.product_name || 'Milk') : '-';
        quantity = '-';
      } else if (sub) {
        status = 'Daily Delivery';
        statusKey = 'DAILY_DELIVERY';
        product = sub.product_name || 'Milk';
        quantity = sub.quantity ? `${sub.quantity}` : '1';
      } else {
        status = 'Not Delivered';
        statusKey = 'NOT_DELIVERED';
      }

      days.push({
        dayNumber: d,
        date: dateStr,
        formattedDate,
        dayName,
        status,
        statusKey,
        product,
        quantity,
      });
    }

    res.json({
      success: true,
      customer: {
        id: customer.id,
        customer_code: customer.customer_code || `CUST-${customer.id}`,
        name: customer.name,
        mobile: customer.mobile || 'N/A',
        address: customer.address || 'N/A',
        city: customer.city || 'Chennai',
        hub: customer.hub || 'Royapettah'
      },
      month: monthStr,
      monthName,
      year: yearNum,
      monthNum,
      days,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/reports/delivery-boy-planner — Delivery Boy-Wise Daily Planner Report across Date Range
// ─────────────────────────────────────────────
const getDeliveryBoyPlannerReport = async (req, res, next) => {
  try {
    const { dp_ref_id, date_from, date_to } = req.query;

    if (!dp_ref_id) {
      return res.status(400).json({ success: false, message: 'Delivery Boy is required.' });
    }
    if (!date_from || !date_to) {
      return res.status(400).json({ success: false, message: 'Start Date and End Date are required.' });
    }
    if (date_from > date_to) {
      return res.status(400).json({ success: false, message: 'Start Date cannot be after End Date.' });
    }

    // 1. Resolve Delivery Boy Details
    let dpName = 'Delivery Boy';
    let dpCode = String(dp_ref_id);

    const dpRes = await readFromApp(
      `SELECT id, name, "dpCode", "mobileNumber" FROM "DeliveryPerson" WHERE id = $1 OR "dpCode" = $2 OR name ILIKE $2 LIMIT 1`,
      [dp_ref_id, String(dp_ref_id)]
    ).catch(() => ({ rows: [] }));

    if (dpRes.rows.length > 0) {
      dpName = dpRes.rows[0].name || dpName;
      dpCode = dpRes.rows[0].dpCode || dpRes.rows[0].id || dpCode;
    } else {
      const dpMap = new Map();
      const allDps = await readFromApp(`SELECT id, name, "dpCode" FROM "DeliveryPerson"`).catch(() => ({ rows: [] }));
      allDps.rows.forEach(d => {
        dpMap.set(String(d.id), d.name);
        dpMap.set(String(d.dpCode), d.name);
      });
      if (dpMap.has(String(dp_ref_id))) {
        dpName = dpMap.get(String(dp_ref_id));
      } else {
        dpName = String(dp_ref_id);
      }
    }

    // 2. Build list of date strings YYYY-MM-DD
    const datesList = [];
    let curr = new Date(date_from);
    const end = new Date(date_to);
    while (curr <= end) {
      datesList.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }

    // 3. Fetch Subscription Deliveries in date range for this DP
    const deliveriesRes = await readFromCRM(
      `SELECT 
        DATE(d.created_at AT TIME ZONE 'Asia/Kolkata')::text as date,
        d.status as delivery_status,
        COALESCE(d.quantity, 1) as quantity,
        p.id as product_id,
        p.name as product_name,
        p.unit,
        p.packing_type,
        r.route_name,
        dd.dp_ref_id as dispatch_dp_id,
        c.dp_ref_id as cust_dp_id
       FROM deliveries d
       JOIN daily_dispatch dd ON dd.id = d.dispatch_id
       JOIN customers c ON c.id = d.customer_id
       LEFT JOIN products p ON p.id = d.product_id
       LEFT JOIN routes r ON r.id = dd.route_id
       WHERE (dd.dp_ref_id = $1 OR dd.dp_ref_id::text = $1 OR c.dp_ref_id = $1 OR c.dp_ref_id::text = $1)
         AND DATE(d.created_at AT TIME ZONE 'Asia/Kolkata') >= $2
         AND DATE(d.created_at AT TIME ZONE 'Asia/Kolkata') <= $3
       ORDER BY date ASC`,
      [dp_ref_id, date_from, date_to]
    ).catch(() => ({ rows: [] }));

    let subRows = deliveriesRes.rows;
    if (subRows.length === 0) {
      const activeSubs = await readFromCRM(
        `SELECT 
          s.id,
          COALESCE(s.quantity, 1) as quantity,
          p.id as product_id,
          p.name as product_name,
          p.unit,
          p.packing_type,
          r.route_name,
          c.dp_ref_id as cust_dp_id,
          s.start_date
         FROM subscriptions s
         JOIN customers c ON c.id = s.customer_id
         JOIN products p ON p.id = s.product_id
         LEFT JOIN routes r ON (r.id::text = c.assigned_route_id OR LOWER(r.route_name) = LOWER(c.assigned_route_id))
         WHERE (c.dp_ref_id = $1 OR c.dp_ref_id::text = $1)
           AND s.status = 'Active'
           AND c.status = 'Active'`,
        [dp_ref_id]
      ).catch(() => ({ rows: [] }));

      const syntheticRows = [];
      datesList.forEach(dStr => {
        activeSubs.rows.forEach(sub => {
          if (!sub.start_date || dStr >= String(sub.start_date).substring(0, 10)) {
            syntheticRows.push({
              date: dStr,
              delivery_status: 'Delivered',
              quantity: sub.quantity,
              product_id: sub.product_id,
              product_name: sub.product_name,
              unit: sub.unit,
              packing_type: sub.packing_type,
              route_name: sub.route_name,
              dispatch_dp_id: dp_ref_id,
              cust_dp_id: dp_ref_id,
            });
          }
        });
      });
      subRows = syntheticRows;
    }

    // 4. Fetch AdHoc sales in date range for this DP
    const adhocRes = await readFromCRM(
      `SELECT 
        acs.date::text as date,
        COALESCE(acs.quantity, 1) as quantity,
        acs.product_name,
        acs.route_name,
        p.unit,
        p.packing_type
       FROM adhoc_customer_sales acs
       LEFT JOIN products p ON p.id = acs.product_id
       WHERE (acs.dp_ref_id = $1 OR acs.dp_ref_id::text = $1 OR acs.dp_name ILIKE $2)
         AND acs.date >= $3 AND acs.date <= $4
       ORDER BY date ASC`,
      [dp_ref_id, `%${dpName}%`, date_from, date_to]
    ).catch(() => ({ rows: [] }));

    // 5. Aggregate day by day
    const periodProductMap = new Map();
    let periodTotalMilkLiters = 0;
    let periodMilkDeliveredLiters = 0;
    let periodExtraOrderLiters = 0;

    const dayRecords = [];

    datesList.forEach(dtStr => {
      const daySubs = subRows.filter(r => r.date === dtStr);
      const dayAdhocs = adhocRes.rows.filter(a => a.date === dtStr);

      if (daySubs.length === 0 && dayAdhocs.length === 0) {
        return;
      }

      const dtObj = new Date(dtStr);
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[dtObj.getDay()];
      const dayParts = dtStr.split('-');
      const formattedDate = `${dayParts[2]}-${dayParts[1]}-${dayParts[0]}`;

      const routesSet = new Set();
      const productMap = new Map();

      let dayMilkLiters = 0;
      let dayMilkDeliveredLiters = 0;
      let dayExtraOrderLiters = 0;

      daySubs.forEach(r => {
        if (r.route_name) routesSet.add(r.route_name);

        const pName = r.product_name || 'Milk Product';
        const qty = parseFloat(r.quantity || 1);
        const packing = r.packing_type || ((r.unit || '').toLowerCase().includes('packet') || pName.toLowerCase().includes('pouch') ? 'Pouch' : 'Bottle');

        const pKey = `${pName} (${packing})`;
        if (!productMap.has(pKey)) {
          productMap.set(pKey, { name: pName, packing, subQty: 0, adhocQty: 0, totalQty: 0, unit: r.unit || 'Unit' });
        }
        const item = productMap.get(pKey);
        item.subQty += qty;
        item.totalQty += qty;

        if (!periodProductMap.has(pKey)) {
          periodProductMap.set(pKey, { name: pName, packing, qty: 0, unit: r.unit || 'Unit' });
        }
        periodProductMap.get(pKey).qty += qty;

        let literFactor = 1.0;
        if (pName.toLowerCase().includes('half') || pName.toLowerCase().includes('500ml')) literFactor = 0.5;
        if (pName.toLowerCase().includes('250ml')) literFactor = 0.25;

        if (pName.toLowerCase().includes('milk')) {
          const liters = qty * literFactor;
          dayMilkLiters += liters;
          if (r.delivery_status === 'Delivered') {
            dayMilkDeliveredLiters += liters;
          }
        }
      });

      dayAdhocs.forEach(a => {
        if (a.route_name) routesSet.add(a.route_name);

        const pName = a.product_name || 'AdHoc Product';
        const qty = parseFloat(a.quantity || 1);
        const packing = a.packing_type || ((a.unit || '').toLowerCase().includes('packet') || pName.toLowerCase().includes('pouch') ? 'Pouch' : 'Bottle');

        const pKey = `${pName} (${packing})`;
        if (!productMap.has(pKey)) {
          productMap.set(pKey, { name: pName, packing, subQty: 0, adhocQty: 0, totalQty: 0, unit: a.unit || 'Unit' });
        }
        const item = productMap.get(pKey);
        item.adhocQty += qty;
        item.totalQty += qty;

        if (!periodProductMap.has(pKey)) {
          periodProductMap.set(pKey, { name: pName, packing, qty: 0, unit: a.unit || 'Unit' });
        }
        periodProductMap.get(pKey).qty += qty;

        let literFactor = 1.0;
        if (pName.toLowerCase().includes('half') || pName.toLowerCase().includes('500ml')) literFactor = 0.5;
        if (pName.toLowerCase().includes('250ml')) literFactor = 0.25;

        if (pName.toLowerCase().includes('milk')) {
          const liters = qty * literFactor;
          dayMilkLiters += liters;
          dayExtraOrderLiters += liters;
        }
      });

      periodTotalMilkLiters += dayMilkLiters;
      periodMilkDeliveredLiters += dayMilkDeliveredLiters;
      periodExtraOrderLiters += dayExtraOrderLiters;

      const productRows = Array.from(productMap.values()).map(p => ({
        product_name: p.name,
        packing_type: p.packing,
        subscription_qty: p.subQty,
        adhoc_qty: p.adhocQty,
        total_qty: p.totalQty,
        unit: p.unit
      }));

      const routesArr = Array.from(routesSet);

      dayRecords.push({
        date: dtStr,
        formattedDate,
        dayName,
        routes: routesArr.length > 0 ? routesArr.join(', ') : 'General Area',
        productRows,
        dayTotals: {
          totalMilkLiters: parseFloat(dayMilkLiters.toFixed(2)),
          milkDeliveredLiters: parseFloat(dayMilkDeliveredLiters.toFixed(2)),
          extraOrderLiters: parseFloat(dayExtraOrderLiters.toFixed(2))
        }
      });
    });

    const periodProductTotals = Array.from(periodProductMap.values()).map(p => ({
      product_name: p.name,
      packing_type: p.packing,
      total_qty: p.qty,
      unit: p.unit
    }));

    const dateFromParts = date_from.split('-');
    const dateToParts = date_to.split('-');
    const formattedPeriod = `${dateFromParts[2]}-${dateFromParts[1]}-${dateFromParts[0]} to ${dateToParts[2]}-${dateToParts[1]}-${dateToParts[0]}`;

    res.json({
      success: true,
      deliveryBoy: {
        id: dp_ref_id,
        name: dpName,
        code: dpCode
      },
      period: {
        dateFrom: date_from,
        dateTo: date_to,
        formatted: formattedPeriod
      },
      dayRecords,
      periodTotals: {
        productTotals: periodProductTotals,
        totalMilkLiters: parseFloat(periodTotalMilkLiters.toFixed(2)),
        totalMilkDeliveredLiters: parseFloat(periodMilkDeliveredLiters.toFixed(2)),
        totalExtraOrderLiters: parseFloat(periodExtraOrderLiters.toFixed(2))
      }
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/reports/delivery-boy-daily-summary — Single-date Delivery Boy-Wise summary
// ─────────────────────────────────────────────
const getDeliveryBoyDailySummary = async (req, res, next) => {
  try {
    const { date, dp_ref_id } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required.' });
    }
    if (!dp_ref_id) {
      return res.status(400).json({ success: false, message: 'Delivery Boy is required.' });
    }

    // 1. Resolve Delivery Boy name
    let dpName = 'Delivery Boy';
    let dpCode = String(dp_ref_id);

    const dpRes = await readFromApp(
      `SELECT id, name, "dpCode" FROM "DeliveryPerson" WHERE id = $1 OR "dpCode" = $2 OR name ILIKE $2 LIMIT 1`,
      [dp_ref_id, String(dp_ref_id)]
    ).catch(() => ({ rows: [] }));

    if (dpRes.rows.length > 0) {
      dpName = dpRes.rows[0].name || dpName;
      dpCode = dpRes.rows[0].dpCode || dpRes.rows[0].id || dpCode;
    } else {
      const dpMap = new Map();
      const allDps = await readFromApp(`SELECT id, name, "dpCode" FROM "DeliveryPerson"`).catch(() => ({ rows: [] }));
      allDps.rows.forEach(d => {
        dpMap.set(String(d.id), d.name);
        dpMap.set(String(d.dpCode), d.name);
      });
      if (dpMap.has(String(dp_ref_id))) {
        dpName = dpMap.get(String(dp_ref_id));
      } else {
        dpName = String(dp_ref_id);
      }
    }

    // 2. Fetch Deliveries / Dispatches for this DP on single date
    const deliveriesRes = await readFromCRM(
      `SELECT 
        d.status as delivery_status,
        COALESCE(d.quantity, 1) as quantity,
        p.id as product_id,
        p.name as product_name,
        p.unit,
        p.packing_type,
        dd.dp_ref_id as dispatch_dp_id,
        c.dp_ref_id as cust_dp_id
       FROM deliveries d
       JOIN daily_dispatch dd ON dd.id = d.dispatch_id
       JOIN customers c ON c.id = d.customer_id
       LEFT JOIN products p ON p.id = d.product_id
       WHERE (dd.dp_ref_id = $1 OR dd.dp_ref_id::text = $1 OR c.dp_ref_id = $1 OR c.dp_ref_id::text = $1)
         AND DATE(d.created_at AT TIME ZONE 'Asia/Kolkata') = $2`,
      [dp_ref_id, date]
    ).catch(() => ({ rows: [] }));

    let subRows = deliveriesRes.rows;

    // Fallback: If dispatches not generated yet for that date, query active subscriptions
    if (subRows.length === 0) {
      const activeSubs = await readFromCRM(
        `SELECT 
          s.id,
          COALESCE(s.quantity, 1) as quantity,
          p.id as product_id,
          p.name as product_name,
          p.unit,
          p.packing_type,
          c.dp_ref_id as cust_dp_id,
          s.start_date
         FROM subscriptions s
         JOIN customers c ON c.id = s.customer_id
         JOIN products p ON p.id = s.product_id
         WHERE (c.dp_ref_id = $1 OR c.dp_ref_id::text = $1)
           AND s.status = 'Active'
           AND c.status = 'Active'
           AND (s.start_date IS NULL OR s.start_date <= $2)
           AND NOT EXISTS (
             SELECT 1 FROM subscription_pauses sp 
             WHERE sp.customer_id = c.id 
               AND sp.status = 'Active' 
               AND ((sp.pause_type = 'Single Date' AND sp.pause_date = $2)
                    OR (sp.pause_type = 'Vacation' AND sp.pause_date <= $2 AND (sp.resume_date IS NULL OR sp.resume_date > $2)))
           )`,
        [dp_ref_id, date]
      ).catch(() => ({ rows: [] }));

      subRows = activeSubs.rows.map(s => ({
        delivery_status: 'Delivered',
        quantity: s.quantity,
        product_id: s.product_id,
        product_name: s.product_name,
        unit: s.unit,
        packing_type: s.packing_type
      }));
    }

    // 3. Fetch AdHoc sales for this DP on single date
    const adhocRes = await readFromCRM(
      `SELECT 
        COALESCE(acs.quantity, 1) as quantity,
        acs.product_name,
        p.id as product_id,
        p.unit,
        p.packing_type
       FROM adhoc_customer_sales acs
       LEFT JOIN products p ON p.id = acs.product_id
       WHERE (acs.dp_ref_id = $1 OR acs.dp_ref_id::text = $1 OR acs.dp_name ILIKE $2)
         AND acs.date = $3`,
      [dp_ref_id, `%${dpName}%`, date]
    ).catch(() => ({ rows: [] }));

    if (subRows.length === 0 && adhocRes.rows.length === 0) {
      return res.json({
        success: true,
        totalResults: 0,
        data: null,
        message: 'No records found for the selected date and Delivery Boy.'
      });
    }

    // Calculate product quantities and totals
    const productQuantities = {};
    let totalMilkLiters = 0;
    let milkDeliveredLiters = 0;
    let extraOrderLiters = 0;

    subRows.forEach(r => {
      const pName = r.product_name || 'Milk Product';
      const qty = parseFloat(r.quantity || 1);
      const packing = r.packing_type || ((r.unit || '').toLowerCase().includes('packet') || pName.toLowerCase().includes('pouch') ? 'Pouch' : 'Bottle');
      const colName = `${pName} - ${packing}`;

      productQuantities[colName] = (productQuantities[colName] || 0) + qty;

      let literFactor = 1.0;
      if (pName.toLowerCase().includes('half') || pName.toLowerCase().includes('500ml')) literFactor = 0.5;
      if (pName.toLowerCase().includes('250ml')) literFactor = 0.25;

      if (pName.toLowerCase().includes('milk')) {
        const liters = qty * literFactor;
        totalMilkLiters += liters;
        if (r.delivery_status === 'Delivered') {
          milkDeliveredLiters += liters;
        }
      }
    });

    adhocRes.rows.forEach(a => {
      const pName = a.product_name || 'AdHoc Product';
      const qty = parseFloat(a.quantity || 1);
      const packing = a.packing_type || ((a.unit || '').toLowerCase().includes('packet') || pName.toLowerCase().includes('pouch') ? 'Pouch' : 'Bottle');
      const colName = `${pName} - ${packing}`;

      productQuantities[colName] = (productQuantities[colName] || 0) + qty;

      let literFactor = 1.0;
      if (pName.toLowerCase().includes('half') || pName.toLowerCase().includes('500ml')) literFactor = 0.5;
      if (pName.toLowerCase().includes('250ml')) literFactor = 0.25;

      if (pName.toLowerCase().includes('milk')) {
        const liters = qty * literFactor;
        totalMilkLiters += liters;
        extraOrderLiters += liters;
      }
    });

    const productColumns = Object.keys(productQuantities).sort();

    const dateParts = date.split('-');
    const formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;

    const summaryRow = {
      delivery_boy: dpName,
      dp_code: dpCode,
      date,
      formattedDate,
      productQuantities,
      total_milk_liter: parseFloat(totalMilkLiters.toFixed(2)),
      milk_delivered: parseFloat(milkDeliveredLiters.toFixed(2)),
      extra_order_liter: parseFloat(extraOrderLiters.toFixed(2)),
    };

    res.json({
      success: true,
      totalResults: 1,
      date,
      formattedDate,
      deliveryBoy: { id: dp_ref_id, name: dpName, code: dpCode },
      productColumns,
      row: summaryRow,
      totalsRow: summaryRow,
    });
  } catch (err) { next(err); }
};

// PIN Code mapping helper for Chennai delivery areas
const AREA_PIN_MAP = {
  'alwarpet': '600018',
  'egmore': '600008',
  'mandaveli': '600004',
  'mrc ngr': '600028',
  'mrc nagar': '600028',
  'mylapore': '600004',
  'nungambakkam': '600034',
  'royapettah': '600014',
  't-nagar': '600017',
  't. nagar': '600017',
  'teynampet': '600018',
  'triplicane': '600005',
  'west mambalam': '600033',
  'r.a. puram': '600028',
  'ra puram': '600028',
  'adyar': '600020',
  'velachery': '600042',
  'guindy': '600032',
  'saidapet': '600015',
};

// ─────────────────────────────────────────────
// GET /api/reports/delivery-area-options — Options for Delivery Area Report filters
// ─────────────────────────────────────────────
const getDeliveryAreaOptions = async (req, res, next) => {
  try {
    const routeRes = await readFromCRM('SELECT id, route_name FROM routes ORDER BY route_name ASC').catch(() => ({ rows: [] }));

    const areaSet = new Set();
    routeRes.rows.forEach(r => {
      if (r.route_name) {
        const cleanArea = r.route_name.replace(/\s+\d+$/, '').trim();
        if (cleanArea) areaSet.add(cleanArea);
      }
    });

    const defaultAreas = ['Alwarpet', 'Egmore', 'Mandaveli', 'MRC Nagar', 'Mylapore', 'Nungambakkam', 'Royapettah', 'T. Nagar', 'Teynampet', 'Triplicane', 'West Mambalam'];
    defaultAreas.forEach(a => areaSet.add(a));

    const areaNames = Array.from(areaSet).sort();

    res.json({
      success: true,
      data: {
        states: ['Tamil Nadu'],
        cities: ['Chennai'],
        areaNames,
        serviceAvailabilities: ['Delivery Available', 'Not Available'],
      }
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/reports/delivery-area — Delivery Area Master Report
// ─────────────────────────────────────────────
const getDeliveryAreaReport = async (req, res, next) => {
  try {
    const {
      state = '',
      city = '',
      area_name = '',
      service_availability = '',
      page = 1,
      limit = 10,
      export_all = false,
    } = req.query;

    const routeRes = await readFromCRM(
      `SELECT r.id, r.route_name, r.status,
         (SELECT COUNT(*) FROM customers c WHERE c.assigned_route_id = r.id::text OR c.assigned_route_id = r.route_name OR LOWER(c.address) LIKE LOWER('%' || r.route_name || '%')) as cust_count
       FROM routes r
       ORDER BY r.route_name ASC`
    ).catch(() => ({ rows: [] }));

    let routes = routeRes.rows;
    if (routes.length === 0) {
      routes = [
        { id: '1', route_name: 'Alwarpet 1', status: 'Active', cust_count: 10 },
        { id: '2', route_name: 'Egmore 1', status: 'Active', cust_count: 15 },
        { id: '3', route_name: 'Mandaveli 1', status: 'Active', cust_count: 25 },
        { id: '4', route_name: 'Mandaveli 2', status: 'Active', cust_count: 20 },
        { id: '5', route_name: 'MRC Ngr', status: 'Active', cust_count: 12 },
        { id: '6', route_name: 'Mylapore 1', status: 'Active', cust_count: 30 },
        { id: '7', route_name: 'Mylapore 2', status: 'Active', cust_count: 28 },
        { id: '8', route_name: 'Nungambakkam 1', status: 'Active', cust_count: 18 },
        { id: '9', route_name: 'Royapettah 2', status: 'Active', cust_count: 22 },
        { id: '10', route_name: 'T-Nagar 1', status: 'Active', cust_count: 35 },
        { id: '11', route_name: 'Teynampet 1', status: 'Active', cust_count: 14 },
        { id: '12', route_name: 'Triplicane 1', status: 'Active', cust_count: 16 },
        { id: '13', route_name: 'West Mambalam 1', status: 'Active', cust_count: 24 },
        { id: '14', route_name: 'West Mambalam 2', status: 'Active', cust_count: 20 },
      ];
    }

    let allAreas = routes.map((r) => {
      const rawName = r.route_name || 'General Area';
      const cleanArea = rawName.replace(/\s+\d+$/, '').trim();
      
      const lowerArea = cleanArea.toLowerCase();
      let pin = '600001';
      for (const [key, val] of Object.entries(AREA_PIN_MAP)) {
        if (lowerArea.includes(key) || key.includes(lowerArea)) {
          pin = val;
          break;
        }
      }

      const serviceStatus = (r.status === 'Active' || parseInt(r.cust_count || 0) > 0) ? 'Delivery Available' : 'Not Available';

      return {
        id: r.id,
        state: 'Tamil Nadu',
        city: 'Chennai',
        area_name: cleanArea,
        area_pin: pin,
        route: rawName,
        service_availability: serviceStatus,
      };
    });

    if (state && state !== 'All' && state !== '[ Select State ▼ ]') {
      allAreas = allAreas.filter(a => a.state.toLowerCase() === state.toLowerCase());
    }

    if (city && city !== 'All' && city !== '[ Select City ▼ ]') {
      allAreas = allAreas.filter(a => a.city.toLowerCase() === city.toLowerCase());
    }

    if (area_name && area_name !== 'All' && area_name !== '[ Select Area ▼ ]') {
      allAreas = allAreas.filter(a => a.area_name.toLowerCase().includes(area_name.toLowerCase()));
    }

    if (service_availability && service_availability !== 'All' && service_availability !== '[ Select Service ▼ ]') {
      allAreas = allAreas.filter(a => a.service_availability.toLowerCase() === service_availability.toLowerCase());
    }

    const totalRecords = allAreas.length;

    let paginatedData = allAreas;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    if (!export_all && export_all !== 'true') {
      const offset = (pageNum - 1) * limitNum;
      paginatedData = allAreas.slice(offset, offset + limitNum);
    }

    res.json({
      success: true,
      totalRecords,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalRecords / limitNum),
      data: paginatedData,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/reports/mark-delivery-options — Filter options for Mark Delivery Report
// ─────────────────────────────────────────────
const getMarkDeliveryOptions = async (req, res, next) => {
  try {
    const [custRes, branchRes, dpRes] = await Promise.all([
      readFromCRM(
        `SELECT id, customer_code, name, phone, address FROM customers ORDER BY name ASC`
      ).catch(() => ({ rows: [] })),
      readFromCRM(
        `SELECT id, branch_name FROM branches ORDER BY branch_name ASC`
      ).catch(() => ({ rows: [] })),
      readFromApp(
        `SELECT id, name, "dpCode", "mobileNumber" FROM "DeliveryPerson" WHERE "isActive" = true ORDER BY name ASC`
      ).catch(() => ({ rows: [] })),
    ]);

    const customers = custRes.rows.map(c => ({
      id: c.id,
      customer_code: c.customer_code,
      name: c.name,
      phone: c.phone,
      label: `${c.customer_code ? c.customer_code + ' - ' : ''}${c.name}`
    }));

    let hubs = branchRes.rows.map(b => ({
      id: b.id,
      name: b.branch_name
    }));

    if (hubs.length === 0) {
      hubs = [
        { id: 'royapettah', name: 'Royapettah' },
        { id: 'mylapore', name: 'Mylapore' },
      ];
    }

    const deliveryBoys = dpRes.rows.map(d => ({
      id: d.id,
      dpCode: d.dpCode,
      name: d.name,
      label: `${d.dpCode ? d.dpCode + ' - ' : ''}${d.name}`
    }));

    res.json({
      success: true,
      data: {
        customers,
        hubs,
        deliveryBoys,
        cities: ['Chennai']
      }
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/reports/mark-delivery — Mark Delivery Report
// ─────────────────────────────────────────────
const getMarkDeliveryReport = async (req, res, next) => {
  try {
    const {
      date_from = '',
      date_to = '',
      customer_id = '',
      hub_id = '',
      delivery_boy_id = '',
      city = 'Chennai',
      page = 1,
      limit = 10,
      export_all = false
    } = req.query;

    const todayStr = new Date().toISOString().substring(0, 10);
    const startDate = date_from || todayStr;
    const endDate = date_to || startDate;

    const [dpRes, branchRes, deliveriesRes] = await Promise.all([
      readFromApp(`SELECT id, name, "dpCode" FROM "DeliveryPerson"`).catch(() => ({ rows: [] })),
      readFromCRM(`SELECT id, branch_name FROM branches`).catch(() => ({ rows: [] })),
      readFromCRM(
        `SELECT 
          d.id,
          d.dispatch_id,
          d.customer_id,
          d.product_id,
          d.quantity as scheduled_qty,
          d.status as delivery_status,
          d.delivered_at,
          d.notes as remark,
          d.created_at,
          dd.date as dispatch_date,
          dd.dp_ref_id as dispatch_dp_id,
          dd.route_id,
          c.customer_code,
          c.name as customer_name,
          c.address,
          c.dp_ref_id as cust_dp_id,
          c.assigned_route_id,
          p.name as product_name,
          p.packing_type,
          p.unit,
          r.route_name,
          b.branch_name,
          s.frequency as subscription_type
         FROM deliveries d
         JOIN daily_dispatch dd ON dd.id = d.dispatch_id
         JOIN customers c ON c.id = d.customer_id
         LEFT JOIN products p ON p.id = d.product_id
         LEFT JOIN routes r ON (r.id = dd.route_id OR r.id::text = c.assigned_route_id OR LOWER(r.route_name) = LOWER(c.assigned_route_id))
         LEFT JOIN branches b ON b.id = r.branch_id
         LEFT JOIN subscriptions s ON (s.customer_id = c.id AND s.product_id = d.product_id)
         WHERE dd.date >= $1 AND dd.date <= $2`,
        [startDate, endDate]
      ).catch(() => ({ rows: [] }))
    ]);

    const dpMap = new Map();
    dpRes.rows.forEach(d => {
      dpMap.set(d.id, d.name);
      if (d.dpCode) dpMap.set(d.dpCode, d.name);
    });

    let rawRows = deliveriesRes.rows;

    if (rawRows.length === 0) {
      const activeSubsRes = await readFromCRM(
        `SELECT 
          s.id as subscription_id,
          s.quantity as scheduled_qty,
          s.frequency as subscription_type,
          s.start_date,
          c.id as customer_id,
          c.customer_code,
          c.name as customer_name,
          c.address,
          c.phone,
          c.assigned_route_id,
          c.dp_ref_id as cust_dp_id,
          p.id as product_id,
          p.name as product_name,
          p.unit,
          p.category,
          p.packing_type,
          r.id as route_id,
          r.route_name,
          b.branch_name
         FROM subscriptions s
         JOIN customers c ON c.id = s.customer_id
         JOIN products p ON p.id = s.product_id
         LEFT JOIN routes r ON (r.id::text = c.assigned_route_id OR LOWER(r.route_name) = LOWER(c.assigned_route_id))
         LEFT JOIN branches b ON b.id = r.branch_id
         WHERE s.status = 'Active'
           AND c.status = 'Active'
           AND s.start_date <= $2`,
        [startDate, endDate]
      ).catch(() => ({ rows: [] }));

      const datesList = [];
      let curr = new Date(startDate);
      const endD = new Date(endDate);
      while (curr <= endD) {
        datesList.push(curr.toISOString().substring(0, 10));
        curr.setDate(curr.getDate() + 1);
      }

      const syntheticRows = [];
      datesList.forEach(dStr => {
        activeSubsRes.rows.forEach(sub => {
          if (!sub.start_date || dStr >= String(sub.start_date).substring(0, 10)) {
            syntheticRows.push({
              dispatch_date: dStr,
              customer_id: sub.customer_id,
              customer_code: sub.customer_code,
              customer_name: sub.customer_name,
              address: sub.address,
              cust_dp_id: sub.cust_dp_id,
              product_id: sub.product_id,
              product_name: sub.product_name,
              packing_type: sub.packing_type,
              unit: sub.unit,
              route_name: sub.route_name,
              branch_name: sub.branch_name,
              subscription_type: sub.subscription_type || 'Daily',
              scheduled_qty: sub.scheduled_qty || 1,
              delivery_status: 'Delivered',
              remark: 'Standard Delivery',
            });
          }
        });
      });
      rawRows = syntheticRows;
    }

    let records = rawRows.map(r => {
      const delDate = r.dispatch_date || (r.created_at ? new Date(r.created_at).toISOString().substring(0, 10) : startDate);
      const custName = r.customer_code ? `${r.customer_code} - ${r.customer_name}` : r.customer_name;
      const addr = r.address || 'N/A';
      const hubName = r.branch_name || r.route_name || 'Royapettah';
      const dpId = r.dispatch_dp_id || r.cust_dp_id;
      const dpName = r.dp_name || dpMap.get(dpId) || dpId || 'Unassigned';
      const subType = r.subscription_type || 'Daily';
      const prodName = r.product_name || 'Milk Bottle One Litre - Bottle';
      
      const schedQty = parseFloat(r.scheduled_qty || 1);
      const isDelivered = r.delivery_status !== 'Failed' && r.delivery_status !== 'Skipped';
      const delivQty = isDelivered ? schedQty : 0;

      const isBottleProduct = (prodName.toLowerCase().includes('bottle') || (r.unit || '').toLowerCase().includes('bottle'));
      let bottleDelivered = isBottleProduct ? delivQty : 0;
      if (r.bottle_delivered !== undefined && r.bottle_delivered !== null) {
        bottleDelivered = parseFloat(r.bottle_delivered);
      }

      let bottleCollected = isBottleProduct ? Math.max(0, delivQty) : 0;
      if (r.bottle_collected !== undefined && r.bottle_collected !== null) {
        bottleCollected = parseFloat(r.bottle_collected);
      }

      const remarkStr = r.remark || r.delivery_status || 'Normal Delivery';
      const narrationStr = r.narration || r.notes || `Delivery on ${delDate} to ${custName}`;

      return {
        id: r.id || `${delDate}-${r.customer_id}-${r.product_id}`,
        delivery_date: delDate,
        customer_id: r.customer_id,
        customer_name: custName,
        address: addr,
        city: 'Chennai',
        hub: hubName,
        hub_id: r.route_id || hubName,
        delivery_boy: dpName,
        dp_ref_id: dpId,
        subscription_type: subType,
        product: prodName,
        scheduled_qty: schedQty,
        delivered_qty: delivQty,
        bottle_delivered: bottleDelivered,
        bottle_collected: bottleCollected,
        remark: remarkStr,
        narration: narrationStr,
      };
    });

    if (customer_id && customer_id !== 'All' && customer_id !== '[ Select Customer ▼ ]') {
      records = records.filter(rec => rec.customer_id === customer_id || rec.customer_name.toLowerCase().includes(customer_id.toLowerCase()));
    }

    if (hub_id && hub_id !== 'All' && hub_id !== '[ Select Hub ▼ ]') {
      records = records.filter(rec => rec.hub.toLowerCase().includes(hub_id.toLowerCase()) || rec.hub_id === hub_id);
    }

    if (delivery_boy_id && delivery_boy_id !== 'All' && delivery_boy_id !== '[ Select Delivery Boy ▼ ]') {
      records = records.filter(rec => rec.dp_ref_id === delivery_boy_id || rec.delivery_boy.toLowerCase().includes(delivery_boy_id.toLowerCase()));
    }

    records.sort((a, b) => b.delivery_date.localeCompare(a.delivery_date) || a.customer_name.localeCompare(b.customer_name));

    const totalsRow = {
      delivery_date: 'Total',
      customer_name: '',
      address: '',
      city: '',
      hub: '',
      delivery_boy: '',
      subscription_type: '',
      product: '',
      scheduled_qty: parseFloat(records.reduce((sum, r) => sum + r.scheduled_qty, 0).toFixed(2)),
      delivered_qty: parseFloat(records.reduce((sum, r) => sum + r.delivered_qty, 0).toFixed(2)),
      bottle_delivered: parseFloat(records.reduce((sum, r) => sum + r.bottle_delivered, 0).toFixed(2)),
      bottle_collected: parseFloat(records.reduce((sum, r) => sum + r.bottle_collected, 0).toFixed(2)),
      remark: '',
      narration: '',
    };

    const totalRecords = records.length;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    let paginatedRows = records;
    if (!export_all && export_all !== 'true') {
      const offset = (pageNum - 1) * limitNum;
      paginatedRows = records.slice(offset, offset + limitNum);
    }

    res.json({
      success: true,
      totalRecords,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalRecords / limitNum),
      startDate,
      endDate,
      rows: paginatedRows,
      totalsRow,
    });
  } catch (err) { next(err); }
};

module.exports = {
  getDailySummary, getMonthlyReport, getRevenueTrend,
  getCustomerAnalysis, getFeedback, getSmsLog, getLogisticsOverview,
  getArchivedReports, downloadArchivedReport, getStockCorrectnessReport,
  getReportFilterOptions, getAuditTrailReport, getDailyPlannerReport, getCustomerStatementReport,
  getCustomerInfoReport, getDeliveryPlannerCalendar, getDeliveryBoyPlannerReport,
  getDeliveryBoyDailySummary, getDeliveryAreaOptions, getDeliveryAreaReport,
  getMarkDeliveryOptions, getMarkDeliveryReport,
};








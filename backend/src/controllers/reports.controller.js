const { readFromCRM, writeToCRM } = require('../config/database');

// ─────────────────────────────────────────────
// GET /api/reports/daily-summary
// ─────────────────────────────────────────────
const getDailySummary = async (req, res, next) => {
  try {
    const { date } = req.query;
    const d = date || new Date().toISOString().split('T')[0];

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
         WHERE dd.date >= CURRENT_DATE - 7
         ORDER BY dd.date DESC, dd.created_at DESC`
      ),
      readFromCRM(
        `SELECT status, COUNT(*) as count FROM deliveries
         WHERE DATE(created_at) = CURRENT_DATE GROUP BY status`
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

module.exports = {
  getDailySummary, getMonthlyReport, getRevenueTrend,
  getCustomerAnalysis, getFeedback, getSmsLog, getLogisticsOverview,
  getArchivedReports, downloadArchivedReport,
};

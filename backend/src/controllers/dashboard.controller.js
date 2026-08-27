const { readFromCRM, readFromApp } = require('../config/database');
const { getExpectedOperationalDate, getISTDateStr } = require('../services/operationalDay.service');

// ─────────────────────────────────────────────
// GET /api/dashboard/stats
// ─────────────────────────────────────────────
const getDashboardStats = async (req, res, next) => {
  try {
    // Operational day (7:00 PM IST boundary) — used for daily operational KPIs
    const opDay = getExpectedOperationalDate();

    // Actual IST calendar date — used for "registered today" (event-based, not operational)
    const istCalendarDate = getISTDateStr();

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const [
      totalCustomers,
      activeCustomers,
      totalRegisteredThisMonth,
      registeredToday,
      activeSubscriptions,
      totalEnquiries,
      holdCount,
      changeCount,
      walletStats,
      walletToday,
      deliveriesToday,
      revenueToday,
      pendingPayments,
      milkInventory,
      totalMilkDeliveredMonth,
    ] = await Promise.all([
      readFromCRM('SELECT COUNT(*) FROM customers'),
      readFromCRM("SELECT COUNT(*) FROM customers WHERE status = 'Active'"),
      readFromCRM('SELECT COUNT(*) FROM customers WHERE EXTRACT(MONTH FROM created_at) = $1 AND EXTRACT(YEAR FROM created_at) = $2', [currentMonth, currentYear]),
      // registeredToday: uses actual IST calendar date (real event time, not operational day)
      readFromCRM('SELECT COUNT(*) FROM customers WHERE DATE(created_at) = $1', [istCalendarDate]),
      readFromCRM("SELECT COUNT(*) FROM subscriptions WHERE status = 'Active'"),
      readFromCRM('SELECT COUNT(*) FROM customer_enquiries WHERE EXTRACT(MONTH FROM created_at) = $1 AND EXTRACT(YEAR FROM created_at) = $2', [currentMonth, currentYear]),
      readFromCRM("SELECT COUNT(*) FROM hold_requests WHERE status = 'Pending'"),
      readFromCRM("SELECT COUNT(*) FROM change_requests WHERE status = 'Pending'"),
      readFromCRM(`SELECT 
        COALESCE(SUM(COALESCE(w.balance, c.wallet_balance, 0)), 0) as total_wallet,
        COALESCE(SUM(CASE WHEN COALESCE(w.balance, c.wallet_balance, 0) < 0 THEN COALESCE(w.balance, c.wallet_balance, 0) ELSE 0 END), 0) as negative_wallet,
        COALESCE(SUM(COALESCE(w.total_recharged, 0)), 0) as total_recharged
        FROM customers c
        LEFT JOIN wallet w ON w.customer_id = c.id`),
      // walletToday: uses operational day (7 PM IST boundary)
      readFromCRM(`SELECT 
        COALESCE(SUM(CASE WHEN method='Cash' THEN amount ELSE 0 END),0) as cash_recharge,
        COALESCE(SUM(CASE WHEN method!='Cash' THEN amount ELSE 0 END),0) as online_recharge,
        COALESCE(SUM(amount),0) as total_recharge
        FROM wallet_transactions WHERE DATE(created_at)=$1 AND type='Recharge'`, [opDay]),
      // deliveriesToday: uses operational day
      readFromCRM("SELECT COUNT(*) FROM deliveries WHERE DATE(COALESCE(delivered_at, created_at)) = $1 AND status = 'Delivered'", [opDay]),
      // revenueToday: uses operational day
      readFromCRM("SELECT COALESCE(SUM(amount),0) as revenue FROM payments WHERE (payment_date = $1 OR DATE(created_at) = $1) AND status = 'Verified'", [opDay]),
      readFromCRM("SELECT COUNT(*) FROM invoices WHERE payment_status = 'Pending'"),
      // milkInventory: uses operational day
      readFromCRM('SELECT * FROM milk_inventory WHERE date = $1', [opDay]),
      readFromCRM(`SELECT COALESCE(SUM(quantity), 0) as total_delivered 
        FROM deliveries 
        WHERE EXTRACT(MONTH FROM COALESCE(delivered_at, created_at)) = $1 
          AND EXTRACT(YEAR FROM COALESCE(delivered_at, created_at)) = $2 
          AND status = 'Delivered'`, [currentMonth, currentYear]),
    ]);

    // Get monthly wallet stats
    const monthStart = `${currentYear}-${String(currentMonth).padStart(2,'0')}-01`;
    const monthEnd = opDay;
    const monthlyWalletStats = await readFromCRM(
      `SELECT 
        COALESCE(SUM(amount),0) as total_amount,
        COALESCE(SUM(CASE WHEN type='Refund' THEN amount ELSE 0 END),0) as refunded,
        COALESCE(SUM(CASE WHEN method='Cash' AND type='Recharge' THEN amount ELSE 0 END),0) as cash_recharge,
        COALESCE(SUM(CASE WHEN method!='Cash' AND type='Recharge' THEN amount ELSE 0 END),0) as online_recharge
      FROM wallet_transactions
      WHERE DATE(created_at) BETWEEN $1 AND $2`,
      [monthStart, monthEnd]
    );

    res.json({
      success: true,
      operationalDate: opDay,
      data: {
        statistics: {
          total_customers: parseInt(totalCustomers.rows[0].count),
          active_customers: parseInt(activeCustomers.rows[0].count),
          registered_this_month: parseInt(totalRegisteredThisMonth.rows[0].count),
          registered_today: parseInt(registeredToday.rows[0].count),
          active_subscriptions: parseInt(activeSubscriptions.rows[0].count),
          total_enquiries_this_month: parseInt(totalEnquiries.rows[0].count),
          hold_requests_pending: parseInt(holdCount.rows[0].count),
          change_requests_pending: parseInt(changeCount.rows[0].count),
          total_in_hand_wallet: parseFloat(walletStats.rows[0].total_wallet),
          total_negative_wallet: parseFloat(walletStats.rows[0].negative_wallet),
          total_milk_delivered_month: parseFloat(totalMilkDeliveredMonth.rows[0].total_delivered),
        },
        kpi: {
          deliveries_today: parseInt(deliveriesToday.rows[0].count),
          revenue_today: parseFloat(revenueToday.rows[0].revenue),
          pending_invoices: parseInt(pendingPayments.rows[0].count),
          milk_inventory: milkInventory.rows[0] || null,
        },
        wallet_monthly: {
          total_amount: parseFloat(monthlyWalletStats.rows[0].total_amount),
          total_refunded: parseFloat(monthlyWalletStats.rows[0].refunded),
          cash_recharge: parseFloat(monthlyWalletStats.rows[0].cash_recharge),
          online_recharge: parseFloat(monthlyWalletStats.rows[0].online_recharge),
        },
        wallet_today: {
          total_recharge: parseFloat(walletToday.rows[0].total_recharge),
          cash_recharge: parseFloat(walletToday.rows[0].cash_recharge),
          online_recharge: parseFloat(walletToday.rows[0].online_recharge),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/dashboard/activity-logs
// ─────────────────────────────────────────────
const getActivityLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await readFromCRM(
      `SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const count = await readFromCRM('SELECT COUNT(*) FROM audit_logs');

    res.json({
      success: true,
      data: result.rows,
      total: parseInt(count.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/dashboard/monthly-trends
// ─────────────────────────────────────────────
const getMonthlyTrends = async (req, res, next) => {
  try {
    const result = await readFromCRM(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as month,
        COUNT(*) as new_customers
      FROM customers
      WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at)
    `);

    const revenueResult = await readFromCRM(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', COALESCE(payment_date, created_at)), 'Mon YYYY') as month,
        COALESCE(SUM(amount),0) as revenue
      FROM payments
      WHERE status = 'Verified' AND (payment_date >= NOW() - INTERVAL '6 months' OR created_at >= NOW() - INTERVAL '6 months')
      GROUP BY DATE_TRUNC('month', COALESCE(payment_date, created_at))
      ORDER BY DATE_TRUNC('month', COALESCE(payment_date, created_at))
    `);

    const customer_growth = (result.rows || []).map(r => ({
      month: r.month,
      new_customers: parseInt(r.new_customers, 10) || 0
    }));

    const revenue_trends = (revenueResult.rows || []).map(r => ({
      month: r.month,
      revenue: parseFloat(r.revenue) || 0
    }));

    res.json({
      success: true,
      data: {
        customer_growth,
        revenue_trends,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboardStats, getActivityLogs, getMonthlyTrends };

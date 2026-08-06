const { readFromCRM, writeToCRM } = require('../config/database');

// ─────────────────────────────────────────────
// GET /api/wallet — all wallets with customer info
// ─────────────────────────────────────────────
const getWallets = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '', filter = '' } = req.query;
    const offset = (page - 1) * limit;
    let where = ['1=1'];
    const params = [];
    let pi = 1;

    if (search) {
      where.push(`(c.name ILIKE $${pi} OR c.phone ILIKE $${pi} OR c.customer_code ILIKE $${pi})`);
      params.push(`%${search}%`);
      pi++;
    }
    if (filter === 'negative') { where.push('w.balance < 0'); }
    if (filter === 'zero') { where.push('w.balance = 0'); }
    if (filter === 'positive') { where.push('w.balance > 0'); }

    const whereStr = where.join(' AND ');
    const [rows, count, summary] = await Promise.all([
      readFromCRM(
        `SELECT w.*, c.name as customer_name, c.phone, c.customer_code
         FROM wallet w
         LEFT JOIN customers c ON c.id = w.customer_id
         WHERE ${whereStr}
         ORDER BY w.balance ASC
         LIMIT $${pi} OFFSET $${pi + 1}`,
        [...params, limit, offset]
      ),
      readFromCRM(`SELECT COUNT(*) FROM wallet w LEFT JOIN customers c ON c.id = w.customer_id WHERE ${whereStr}`, params),
      readFromCRM(
        `SELECT
          COALESCE(SUM(balance),0) as total_balance,
          COUNT(CASE WHEN balance < 0 THEN 1 END) as negative_count,
          COUNT(CASE WHEN balance = 0 THEN 1 END) as zero_count,
          COUNT(CASE WHEN balance > 0 THEN 1 END) as positive_count
         FROM wallet`
      ),
    ]);
    res.json({
      success: true,
      data: rows.rows,
      total: parseInt(count.rows[0].count),
      summary: summary.rows[0],
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// POST /api/wallet/recharge
// ─────────────────────────────────────────────
const rechargeWallet = async (req, res, next) => {
  try {
    const { customer_id, amount, method, reference, description } = req.body;
    if (!customer_id || !amount || !method)
      return res.status(400).json({ success: false, message: 'Customer, amount, and method are required.' });

    const amt = parseFloat(amount);
    if (amt <= 0) return res.status(400).json({ success: false, message: 'Amount must be positive.' });

    // Upsert wallet + update balance
    await writeToCRM(
      `INSERT INTO wallet (customer_id, balance, total_recharged)
       VALUES ($1, $2, $2)
       ON CONFLICT (customer_id) DO UPDATE
       SET balance = wallet.balance + $2,
           total_recharged = wallet.total_recharged + $2,
           updated_at = NOW()`,
      [customer_id, amt]
    );

    // Log transaction
    await writeToCRM(
      `INSERT INTO wallet_transactions (customer_id, type, amount, method, reference, description, status)
       VALUES ($1,'Recharge',$2,$3,$4,$5,'Completed')`,
      [customer_id, amt, method, reference || '', description || 'Manual recharge']
    );

    // Audit
    await writeToCRM(
      `INSERT INTO audit_logs (user_type, user_ref_id, action, entity, entity_id, ip_address)
       VALUES ($1,$2,'WALLET_RECHARGE','wallet',$3,$4)`,
      ['SuperAdmin', req.admin.id, customer_id, req.ip]
    );

    res.json({ success: true, message: `Wallet recharged ₹${amt} via ${method}.` });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/wallet/:customerId/transactions
// ─────────────────────────────────────────────
const getWalletTransactions = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const { page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;
    const [rows, count] = await Promise.all([
      readFromCRM(
        'SELECT * FROM wallet_transactions WHERE customer_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [customerId, limit, offset]
      ),
      readFromCRM('SELECT COUNT(*) FROM wallet_transactions WHERE customer_id=$1', [customerId]),
    ]);
    res.json({ success: true, data: rows.rows, total: parseInt(count.rows[0].count) });
  } catch (err) { next(err); }
};

module.exports = { getWallets, rechargeWallet, getWalletTransactions };

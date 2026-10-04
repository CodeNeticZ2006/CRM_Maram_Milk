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
  const { crmPool } = require('../config/database');
  const client = await crmPool.connect();

  try {
    const { customer_id, amount, method, reference, description } = req.body;
    if (!customer_id || !amount || !method) {
      return res.status(400).json({ success: false, message: 'Customer, amount, and method are required.' });
    }

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a positive number.' });
    }

    await client.query('BEGIN');

    // 1. Verify customer exists and acquire lock
    const custRes = await client.query(
      'SELECT id, name, customer_code FROM customers WHERE id = $1 FOR UPDATE',
      [customer_id]
    );
    if (custRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }
    const customer = custRes.rows[0];

    // 2. Idempotency protection: check if reference has already been confirmed
    const trimmedRef = reference ? reference.trim() : '';
    if (trimmedRef) {
      const existing = await client.query(
        "SELECT id, amount, method, reference, status, created_at FROM wallet_transactions WHERE customer_id = $1 AND reference = $2 AND status = 'Completed'",
        [customer_id, trimmedRef]
      );
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(200).json({
          success: true,
          message: `Recharge already processed with reference ${trimmedRef}.`,
          data: existing.rows[0],
          is_duplicate: true
        });
      }
    }

    // Generate stable unique reference if not provided
    const txnRef = trimmedRef || `WAL-REC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 3. Upsert wallet + update balance
    const walletRes = await client.query(
      `INSERT INTO wallet (customer_id, balance, total_recharged)
       VALUES ($1, $2, $2)
       ON CONFLICT (customer_id) DO UPDATE
       SET balance = wallet.balance + $2,
           total_recharged = wallet.total_recharged + $2,
           updated_at = NOW()
       RETURNING balance, total_recharged`,
      [customer_id, amt]
    );
    const newBalance = parseFloat(walletRes.rows[0].balance);

    // 4. Keep customer record's wallet_balance in sync
    await client.query(
      'UPDATE customers SET wallet_balance = $1 WHERE id = $2',
      [newBalance, customer_id]
    );

    // 5. Insert wallet transaction ledger entry (authoritative for wallet movements)
    const txnRes = await client.query(
      `INSERT INTO wallet_transactions (customer_id, type, amount, method, reference, description, status)
       VALUES ($1, 'Recharge', $2, $3, $4, $5, 'Completed')
       RETURNING *`,
      [customer_id, amt, method, txnRef, description || 'Manual wallet recharge']
    );

    // 6. Record in customer_ledger for financial statement and audit history
    await client.query(
      `INSERT INTO customer_ledger (customer_id, date, description, credit, debit, balance)
       VALUES ($1, CURRENT_DATE, $2, $3, 0, $4)`,
      [customer_id, `Wallet Recharge via ${method} (Ref: ${txnRef})`, amt, newBalance]
    );

    // 7. Audit log
    const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    const adminRefId = isUuid(req.admin?.id) ? req.admin.id : null;
    await client.query(
      `INSERT INTO audit_logs (user_type, user_ref_id, action, entity, entity_id, ip_address)
       VALUES ($1, $2, 'WALLET_RECHARGE_CONFIRMED', 'wallet', $3, $4)`,
      ['SuperAdmin', adminRefId, customer_id, req.ip || null]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: `Wallet recharged ₹${amt} via ${method} for ${customer.name}.`,
      data: txnRes.rows[0],
      new_balance: newBalance,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
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

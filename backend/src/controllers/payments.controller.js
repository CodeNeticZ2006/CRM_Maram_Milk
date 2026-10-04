const { readFromCRM, writeToCRM } = require('../config/database');
const { sendWhatsAppMessage } = require('../services/sms.service');
const { getExpectedOperationalDate } = require('../services/operationalDay.service');

// ─────────────────────────────────────────────
// GET /api/payments — unified paginated payments & wallet transactions
// ─────────────────────────────────────────────
const getPayments = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = '',
      method = '',
      type = '',
      direction = '',
      search = '',
      customer_id = '',
      start_date = '',
      end_date = ''
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = ['1=1'];
    const params = [];
    let pi = 1;

    if (status) {
      where.push(`combined.status ILIKE $${pi++}`);
      params.push(status);
    }
    if (method) {
      where.push(`combined.method = $${pi++}`);
      params.push(method);
    }
    if (type) {
      where.push(`combined.transaction_type = $${pi++}`);
      params.push(type.toUpperCase());
    }
    if (direction) {
      where.push(`combined.direction = $${pi++}`);
      params.push(direction.toUpperCase());
    }
    if (customer_id) {
      where.push(`combined.customer_id = $${pi++}`);
      params.push(customer_id);
    }
    if (start_date) {
      where.push(`combined.payment_date >= $${pi++}`);
      params.push(start_date);
    }
    if (end_date) {
      where.push(`combined.payment_date <= $${pi++}`);
      params.push(end_date);
    }
    if (search) {
      where.push(`(combined.customer_name ILIKE $${pi} OR combined.phone ILIKE $${pi} OR combined.customer_code ILIKE $${pi} OR combined.transaction_ref ILIKE $${pi} OR combined.invoice_number ILIKE $${pi})`);
      params.push(`%${search}%`);
      pi++;
    }

    const whereStr = where.join(' AND ');

    const unifiedSql = `
      SELECT * FROM (
        -- 1. Invoice & Direct Payments from payments table
        SELECT
          p.id,
          p.customer_id,
          p.amount,
          p.method,
          COALESCE(p.transaction_ref, '') AS transaction_ref,
          p.status,
          COALESCE(p.payment_date, DATE(p.created_at))::text AS payment_date,
          p.created_at,
          p.verified_by,
          p.invoice_id,
          i.invoice_number,
          CASE
            WHEN p.method = 'Wallet' THEN 'WALLET_PAYMENT'
            ELSE 'BILL_PAYMENT'
          END AS transaction_type,
          'DEBIT' AS direction,
          COALESCE(i.invoice_number, 'Bill Settlement') AS description,
          'payments' AS source,
          c.name AS customer_name,
          c.phone,
          c.customer_code
        FROM payments p
        LEFT JOIN customers c ON c.id = p.customer_id
        LEFT JOIN invoices i ON i.id = p.invoice_id

        UNION ALL

        -- 2. Wallet Transactions from wallet_transactions table
        SELECT
          wt.id,
          wt.customer_id,
          wt.amount,
          wt.method,
          COALESCE(wt.reference, '') AS transaction_ref,
          wt.status,
          DATE(wt.created_at)::text AS payment_date,
          wt.created_at,
          'System' AS verified_by,
          NULL::uuid AS invoice_id,
          NULL::varchar AS invoice_number,
          CASE
            WHEN wt.type = 'Recharge' THEN 'WALLET_RECHARGE'
            WHEN wt.type = 'Debit' THEN 'WALLET_PAYMENT'
            WHEN wt.type = 'Refund' THEN 'WALLET_REFUND'
            WHEN wt.type = 'Adjustment' THEN 'WALLET_ADJUSTMENT'
            ELSE 'WALLET_' || UPPER(wt.type)
          END AS transaction_type,
          CASE
            WHEN wt.type IN ('Recharge', 'Refund') THEN 'CREDIT'
            ELSE 'DEBIT'
          END AS direction,
          COALESCE(wt.description, 'Wallet ' || wt.type) AS description,
          'wallet' AS source,
          c.name AS customer_name,
          c.phone,
          c.customer_code
        FROM wallet_transactions wt
        LEFT JOIN customers c ON c.id = wt.customer_id
        WHERE NOT EXISTS (
          SELECT 1 FROM payments p
          WHERE p.transaction_ref = wt.reference AND wt.reference != ''
        )
      ) combined
      WHERE ${whereStr}
      ORDER BY combined.created_at DESC
      LIMIT $${pi} OFFSET $${pi + 1}
    `;

    const countSql = `
      SELECT COUNT(*) FROM (
        SELECT
          p.id,
          p.customer_id,
          p.amount,
          p.method,
          COALESCE(p.transaction_ref, '') AS transaction_ref,
          p.status,
          COALESCE(p.payment_date, DATE(p.created_at))::text AS payment_date,
          CASE
            WHEN p.method = 'Wallet' THEN 'WALLET_PAYMENT'
            ELSE 'BILL_PAYMENT'
          END AS transaction_type,
          'DEBIT' AS direction,
          c.name AS customer_name,
          c.phone,
          c.customer_code,
          i.invoice_number
        FROM payments p
        LEFT JOIN customers c ON c.id = p.customer_id
        LEFT JOIN invoices i ON i.id = p.invoice_id

        UNION ALL

        SELECT
          wt.id,
          wt.customer_id,
          wt.amount,
          wt.method,
          COALESCE(wt.reference, '') AS transaction_ref,
          wt.status,
          DATE(wt.created_at)::text AS payment_date,
          CASE
            WHEN wt.type = 'Recharge' THEN 'WALLET_RECHARGE'
            WHEN wt.type = 'Debit' THEN 'WALLET_PAYMENT'
            WHEN wt.type = 'Refund' THEN 'WALLET_REFUND'
            WHEN wt.type = 'Adjustment' THEN 'WALLET_ADJUSTMENT'
            ELSE 'WALLET_' || UPPER(wt.type)
          END AS transaction_type,
          CASE
            WHEN wt.type IN ('Recharge', 'Refund') THEN 'CREDIT'
            ELSE 'DEBIT'
          END AS direction,
          c.name AS customer_name,
          c.phone,
          c.customer_code,
          NULL::varchar AS invoice_number
        FROM wallet_transactions wt
        LEFT JOIN customers c ON c.id = wt.customer_id
        WHERE NOT EXISTS (
          SELECT 1 FROM payments p
          WHERE p.transaction_ref = wt.reference AND wt.reference != ''
        )
      ) combined
      WHERE ${whereStr}
    `;

    const [rows, count] = await Promise.all([
      readFromCRM(unifiedSql, [...params, parseInt(limit), offset]),
      readFromCRM(countSql, params),
    ]);

    res.json({
      success: true,
      data: rows.rows,
      total: parseInt(count.rows[0].count),
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// PATCH /api/payments/:id/verify
// ─────────────────────────────────────────────
const verifyPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const verified_by = req.admin?.name || 'Super Admin';
    const updated = await writeToCRM(
      "UPDATE payments SET status='Verified', verified_by=$1 WHERE id=$2 RETURNING invoice_id",
      [verified_by, id]
    );

    if (updated.rows.length > 0 && updated.rows[0].invoice_id) {
      await writeToCRM("UPDATE invoices SET payment_status='Paid' WHERE id=$1", [updated.rows[0].invoice_id]);
    }

    await writeToCRM(
      `INSERT INTO audit_logs (user_type, user_ref_id, action, entity, entity_id, ip_address)
       VALUES ($1,$2,'VERIFY_PAYMENT','payments',$3,$4)`,
      ['SuperAdmin', req.admin?.id || null, id, req.ip]
    );
    res.json({ success: true, message: 'Payment verified.' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// POST /api/payments — record new payment
// ─────────────────────────────────────────────
const createPayment = async (req, res, next) => {
  const { crmPool } = require('../config/database');
  const client = await crmPool.connect();

  try {
    const { customer_id, amount, method, transaction_ref, invoice_id, payment_date } = req.body;
    if (!customer_id || !amount || !method) {
      return res.status(400).json({ success: false, message: 'Customer, amount, and method required.' });
    }

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be positive.' });
    }

    await client.query('BEGIN');

    // If method is 'Wallet', verify balance and debit wallet atomically
    if (method === 'Wallet') {
      const walletRes = await client.query('SELECT balance FROM wallet WHERE customer_id=$1 FOR UPDATE', [customer_id]);
      const currentBalance = parseFloat(walletRes.rows[0]?.balance || 0);
      if (currentBalance < amt) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Insufficient wallet balance. Available: ₹${currentBalance}, Required: ₹${amt}.`
        });
      }

      // Debit wallet
      const updatedWallet = await client.query(
        `UPDATE wallet
         SET balance = balance - $1,
             total_debited = total_debited + $1,
             updated_at = NOW()
         WHERE customer_id = $2
         RETURNING balance`,
        [amt, customer_id]
      );
      const newBal = parseFloat(updatedWallet.rows[0].balance);

      // Keep customers.wallet_balance in sync
      await client.query('UPDATE customers SET wallet_balance=$1 WHERE id=$2', [newBal, customer_id]);

      // Record in wallet_transactions (as Debit / Wallet Payment)
      const txnRef = transaction_ref || `WAL-PAY-${Date.now()}`;
      await client.query(
        `INSERT INTO wallet_transactions (customer_id, type, amount, method, reference, description, status)
         VALUES ($1, 'Debit', $2, 'Wallet', $3, $4, 'Completed')`,
        [customer_id, amt, txnRef, invoice_id ? `Bill Payment (Invoice #${invoice_id})` : 'Wallet Bill Settlement']
      );

      // Record in customer_ledger
      await client.query(
        `INSERT INTO customer_ledger (customer_id, date, description, debit, credit, balance)
         VALUES ($1, CURRENT_DATE, $2, $3, 0, $4)`,
        [customer_id, `Payment from Wallet (Ref: ${txnRef})`, amt, newBal]
      );

      // Record in payments table as Verified
      const payRes = await client.query(
        `INSERT INTO payments (customer_id, invoice_id, amount, method, transaction_ref, status, payment_date, verified_by)
         VALUES ($1, $2, $3, 'Wallet', $4, 'Verified', $5, 'Wallet Auto-Debit')
         RETURNING *`,
        [customer_id, invoice_id || null, amt, txnRef, payment_date || getExpectedOperationalDate()]
      );

      // If invoice attached, mark invoice as Paid
      if (invoice_id) {
        await client.query("UPDATE invoices SET payment_status='Paid' WHERE id=$1", [invoice_id]);
      }

      const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      const adminRefId = isUuid(req.admin?.id) ? req.admin.id : null;
      await client.query(
        `INSERT INTO audit_logs (user_type, user_ref_id, action, entity, entity_id, ip_address)
         VALUES ($1, $2, 'WALLET_PAYMENT_COMPLETED', 'payments', $3, $4)`,
        ['SuperAdmin', adminRefId, payRes.rows[0].id, req.ip || null]
      );

      await client.query('COMMIT');
      return res.status(201).json({ success: true, data: payRes.rows[0], new_wallet_balance: newBal });
    }

    // For other payment methods (Cash, GPay, PhonePe, Paytm, Razorpay):
    const payRes = await client.query(
      `INSERT INTO payments (customer_id, invoice_id, amount, method, transaction_ref, status, payment_date)
       VALUES ($1, $2, $3, $4, $5, 'Pending Verification', $6) RETURNING *`,
      [customer_id, invoice_id || null, amt, method, transaction_ref || '', payment_date || getExpectedOperationalDate()]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: payRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// GET /api/payments/invoices — list invoices
// ─────────────────────────────────────────────
const getInvoices = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, cycle = '', status = '', search = '' } = req.query;
    const offset = (page - 1) * limit;
    let where = ['1=1'];
    const params = [];
    let pi = 1;

    if (cycle) { where.push(`i.billing_cycle = $${pi++}`); params.push(cycle); }
    if (status) { where.push(`i.payment_status = $${pi++}`); params.push(status); }
    if (search) {
      where.push(`(c.name ILIKE $${pi} OR i.invoice_number ILIKE $${pi} OR c.customer_code ILIKE $${pi})`);
      params.push(`%${search}%`);
      pi++;
    }

    const whereStr = where.join(' AND ');
    const [rows, count] = await Promise.all([
      readFromCRM(
        `SELECT i.*, c.name as customer_name, c.phone, c.customer_code, COALESCE(w.balance, 0) as wallet_balance
         FROM invoices i
         LEFT JOIN customers c ON c.id = i.customer_id
         LEFT JOIN wallet w ON w.customer_id = c.id
         WHERE ${whereStr}
         ORDER BY i.created_at DESC LIMIT $${pi} OFFSET $${pi + 1}`,
        [...params, limit, offset]
      ),
      readFromCRM(`SELECT COUNT(*) FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id WHERE ${whereStr}`, params),
    ]);
    res.json({ success: true, data: rows.rows, total: parseInt(count.rows[0].count) });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// POST /api/payments/generate-invoices — Weekly & Monthly Invoice Generation
// ─────────────────────────────────────────────
const generateInvoices = async (req, res, next) => {
  try {
    const { billing_cycle = 'weekly', start_date, end_date, customer_id } = req.body;
    const now = new Date();
    const currMonth = now.getMonth() + 1;
    const currYear = now.getFullYear();

    // Fetch active customers
    let custQuery = "SELECT c.id, c.name, c.customer_code, c.phone, s.daily_quantity, p.price_per_unit FROM customers c LEFT JOIN subscriptions s ON s.customer_id = c.id LEFT JOIN products p ON p.id = s.product_id WHERE c.status = 'Active'";
    const custParams = [];
    if (customer_id) {
      custQuery += " AND c.id = $1";
      custParams.push(customer_id);
    }
    const custRes = await readFromCRM(custQuery, custParams);

    const generated = [];
    for (const cust of custRes.rows) {
      const qty = parseFloat(cust.daily_quantity || 1);
      const price = parseFloat(cust.price_per_unit || 50);
      const days = billing_cycle === 'weekly' ? 7 : 30;
      const totalAmt = qty * price * days;

      const codeSuffix = cust.customer_code ? cust.customer_code.replace(/[^a-zA-Z0-9]/g, '') : 'CUST';
      const invNum = billing_cycle === 'weekly'
        ? `INV-W-${currYear}${String(currMonth).padStart(2, '0')}-${codeSuffix}`
        : `INV-M-${currYear}${String(currMonth).padStart(2, '0')}-${codeSuffix}`;

      // Insert or update invoice
      const result = await writeToCRM(
        `INSERT INTO invoices (invoice_number, customer_id, month, year, billing_cycle, start_date, end_date, subtotal, grand_total, payment_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, 'Pending')
         ON CONFLICT (invoice_number) DO UPDATE
         SET grand_total = EXCLUDED.grand_total, subtotal = EXCLUDED.subtotal
         RETURNING *`,
        [
          invNum, cust.id, currMonth, currYear, billing_cycle,
          start_date || new Date(now - days * 86400000).toISOString().split('T')[0],
          end_date || now.toISOString().split('T')[0],
          totalAmt
        ]
      );
      generated.push(result.rows[0]);
    }

    res.json({
      success: true,
      message: `Generated ${generated.length} ${billing_cycle} bill(s) successfully.`,
      data: generated,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// POST /api/payments/invoices/:id/send-whatsapp — Send Dedicated Bill via WhatsApp
// ─────────────────────────────────────────────
const sendInvoiceWhatsApp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const invRes = await readFromCRM(
      `SELECT i.*, c.name as customer_name, c.phone, c.customer_code, COALESCE(w.balance, 0) as wallet_balance
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       LEFT JOIN wallet w ON w.customer_id = c.id
       WHERE i.id = $1`,
      [id]
    );

    if (invRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    const inv = invRes.rows[0];
    if (!inv.phone) {
      return res.status(400).json({ success: false, message: 'Customer phone number is missing.' });
    }

    const cycleText = inv.billing_cycle === 'weekly' ? 'WEEKLY BILL STATEMENT' : 'MONTHLY BILL STATEMENT';
    const periodText = inv.start_date && inv.end_date
      ? `${new Date(inv.start_date).toLocaleDateString('en-IN')} to ${new Date(inv.end_date).toLocaleDateString('en-IN')}`
      : `${inv.month}/${inv.year}`;

    const waMessage =
`🧾 *MARAM MILK — ${cycleText}*
Hi *${inv.customer_name}* (${inv.customer_code || 'Customer'}),

Your ${inv.billing_cycle || 'monthly'} bill is ready for period:
📅 *${periodText}*

--------------------------------
💰 *Total Bill Amount:* ₹${parseFloat(inv.grand_total).toLocaleString('en-IN')}
💳 *Current Wallet Balance:* ₹${parseFloat(inv.wallet_balance).toLocaleString('en-IN')}
--------------------------------

🔗 Recharge your wallet to keep your daily milk delivery uninterrupted:
https://marammilk.com/pay/${inv.customer_code || inv.customer_id}

Thank you for subscribing to Maram Milk! 🥛`;

    // Dispatch via Twilio WhatsApp API / Console logger
    await sendWhatsAppMessage(inv.phone, waMessage);

    // Update invoice log
    await writeToCRM("UPDATE invoices SET whatsapp_sent = true, whatsapp_sent_at = NOW() WHERE id = $1", [id]).catch(() => {});

    res.json({
      success: true,
      message: `Bill WhatsApp sent to ${inv.customer_name} (${inv.phone}).`,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/payments/stats
// ─────────────────────────────────────────────
const getPaymentStats = async (req, res, next) => {
  try {
    // Use operational day (7:00 PM IST boundary) for today's revenue
    const opDay = getExpectedOperationalDate();
    const [pending, verified, todayTotal, pendingInvoices, walletRecharges] = await Promise.all([
      readFromCRM("SELECT COUNT(*), COALESCE(SUM(amount),0) as total FROM payments WHERE status='Pending Verification'"),
      readFromCRM("SELECT COUNT(*), COALESCE(SUM(amount),0) as total FROM payments WHERE status='Verified'"),
      readFromCRM("SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE (payment_date=$1 OR DATE(created_at)=$1) AND status='Verified'", [opDay]),
      readFromCRM("SELECT COUNT(*) FROM invoices WHERE payment_status='Pending'"),
      readFromCRM("SELECT COUNT(*), COALESCE(SUM(amount),0) as total FROM wallet_transactions WHERE type='Recharge' AND status='Completed'"),
    ]);
    res.json({
      success: true,
      data: {
        pending_count: parseInt(pending.rows[0].count),
        pending_amount: parseFloat(pending.rows[0].total),
        verified_count: parseInt(verified.rows[0].count),
        verified_amount: parseFloat(verified.rows[0].total),
        today_revenue: parseFloat(todayTotal.rows[0].total),
        pending_invoices: parseInt(pendingInvoices.rows[0].count),
        wallet_recharge_count: parseInt(walletRecharges.rows[0].count),
        wallet_recharge_total: parseFloat(walletRecharges.rows[0].total),
      },
    });
  } catch (err) { next(err); }
};

module.exports = {
  getPayments, verifyPayment, createPayment,
  getInvoices, generateInvoices, sendInvoiceWhatsApp, getPaymentStats
};

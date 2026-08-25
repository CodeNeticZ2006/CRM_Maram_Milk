const { readFromCRM, writeToCRM } = require('../config/database');
const { sendWhatsAppMessage } = require('../services/sms.service');
const { getExpectedOperationalDate } = require('../services/operationalDay.service');

// ─────────────────────────────────────────────
// GET /api/payments — paginated list
// ─────────────────────────────────────────────
const getPayments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status = '', method = '', search = '' } = req.query;
    const offset = (page - 1) * limit;
    let where = ['1=1'];
    const params = [];
    let pi = 1;

    if (status) { where.push(`p.status = $${pi++}`); params.push(status); }
    if (method) { where.push(`p.method = $${pi++}`); params.push(method); }
    if (search) {
      where.push(`(c.name ILIKE $${pi} OR c.phone ILIKE $${pi} OR c.customer_code ILIKE $${pi})`);
      params.push(`%${search}%`);
      pi++;
    }

    const whereStr = where.join(' AND ');
    const [rows, count] = await Promise.all([
      readFromCRM(
        `SELECT p.*, c.name as customer_name, c.phone, c.customer_code, i.invoice_number
         FROM payments p
         LEFT JOIN customers c ON c.id = p.customer_id
         LEFT JOIN invoices i ON i.id = p.invoice_id
         WHERE ${whereStr}
         ORDER BY p.created_at DESC LIMIT $${pi} OFFSET $${pi + 1}`,
        [...params, limit, offset]
      ),
      readFromCRM(`SELECT COUNT(*) FROM payments p LEFT JOIN customers c ON c.id = p.customer_id WHERE ${whereStr}`, params),
    ]);
    res.json({ success: true, data: rows.rows, total: parseInt(count.rows[0].count) });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// PATCH /api/payments/:id/verify
// ─────────────────────────────────────────────
const verifyPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const verified_by = req.admin.name || 'Super Admin';
    await writeToCRM(
      "UPDATE payments SET status='Verified', verified_by=$1 WHERE id=$2",
      [verified_by, id]
    );
    await writeToCRM(
      `INSERT INTO audit_logs (user_type, user_ref_id, action, entity, entity_id, ip_address)
       VALUES ($1,$2,'VERIFY_PAYMENT','payments',$3,$4)`,
      ['SuperAdmin', req.admin.id, id, req.ip]
    );
    res.json({ success: true, message: 'Payment verified.' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// POST /api/payments — record new payment
// ─────────────────────────────────────────────
const createPayment = async (req, res, next) => {
  try {
    const { customer_id, amount, method, transaction_ref, invoice_id, payment_date } = req.body;
    if (!customer_id || !amount || !method)
      return res.status(400).json({ success: false, message: 'Customer, amount, and method required.' });

    const result = await writeToCRM(
      `INSERT INTO payments (customer_id, invoice_id, amount, method, transaction_ref, status, payment_date)
       VALUES ($1,$2,$3,$4,$5,'Pending Verification',$6) RETURNING *`,
      [customer_id, invoice_id || null, amount, method, transaction_ref || '', payment_date || getExpectedOperationalDate()]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
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
    const [pending, verified, todayTotal, pendingInvoices] = await Promise.all([
      readFromCRM("SELECT COUNT(*), COALESCE(SUM(amount),0) as total FROM payments WHERE status='Pending Verification'"),
      readFromCRM("SELECT COUNT(*), COALESCE(SUM(amount),0) as total FROM payments WHERE status='Verified'"),
      readFromCRM("SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE payment_date=$1 AND status='Verified'", [opDay]),
      readFromCRM("SELECT COUNT(*) FROM invoices WHERE payment_status='Pending'"),
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
      },
    });
  } catch (err) { next(err); }
};

module.exports = {
  getPayments, verifyPayment, createPayment,
  getInvoices, generateInvoices, sendInvoiceWhatsApp, getPaymentStats
};

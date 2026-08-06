const { readFromCRM, writeToCRM } = require('../config/database');

// ─────────────────────────────────────────────
// GET /api/subscriptions
// ─────────────────────────────────────────────
const getSubscriptions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status = '', customer_id = '' } = req.query;
    const offset = (page - 1) * limit;
    let where = ['1=1'];
    const params = [];
    let pi = 1;

    if (status) { where.push(`s.status = $${pi++}`); params.push(status); }
    if (customer_id) { where.push(`s.customer_id = $${pi++}`); params.push(customer_id); }

    const whereStr = where.join(' AND ');
    const [rows, count] = await Promise.all([
      readFromCRM(
        `SELECT s.*, c.name as customer_name, c.phone as customer_phone, c.customer_code,
                p.name as product_name, p.unit, p.price_per_unit
         FROM subscriptions s
         LEFT JOIN customers c ON c.id = s.customer_id
         LEFT JOIN products p ON p.id = s.product_id
         WHERE ${whereStr}
         ORDER BY s.created_at DESC LIMIT $${pi} OFFSET $${pi + 1}`,
        [...params, limit, offset]
      ),
      readFromCRM(`SELECT COUNT(*) FROM subscriptions s WHERE ${whereStr}`, params),
    ]);
    res.json({ success: true, data: rows.rows, total: parseInt(count.rows[0].count) });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// POST /api/subscriptions
// ─────────────────────────────────────────────
const createSubscription = async (req, res, next) => {
  try {
    const { customer_id, product_id, quantity, frequency = 'Daily', start_date } = req.body;
    if (!customer_id || !product_id || !quantity)
      return res.status(400).json({ success: false, message: 'Customer, product, and quantity are required.' });

    const result = await writeToCRM(
      `INSERT INTO subscriptions (customer_id, product_id, quantity, frequency, start_date, status)
       VALUES ($1,$2,$3,$4,$5,'Active') RETURNING *`,
      [customer_id, product_id, quantity, frequency, start_date || new Date().toISOString().split('T')[0]]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// PUT /api/subscriptions/:id
// ─────────────────────────────────────────────
const updateSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity, frequency } = req.body;
    await writeToCRM(
      'UPDATE subscriptions SET quantity=$1, frequency=$2 WHERE id=$3',
      [quantity, frequency, id]
    );
    res.json({ success: true, message: 'Subscription updated.' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// PATCH /api/subscriptions/:id/status
// ─────────────────────────────────────────────
const updateSubscriptionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['Active', 'Paused', 'Cancelled'].includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    await writeToCRM('UPDATE subscriptions SET status=$1 WHERE id=$2', [status, id]);
    res.json({ success: true, message: `Subscription ${status.toLowerCase()}.` });
  } catch (err) { next(err); }
};

module.exports = { getSubscriptions, createSubscription, updateSubscription, updateSubscriptionStatus };

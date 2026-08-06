const { readFromCRM, writeToCRM } = require('../config/database');

// ─────────────────────────────────────────────
// GET /api/customers — paginated list
// ─────────────────────────────────────────────
const getCustomers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '', status = '', route_id = '' } = req.query;
    const offset = (page - 1) * limit;

    let where = ['1=1'];
    const params = [];
    let pi = 1;

    if (search) {
      where.push(`(c.name ILIKE $${pi} OR c.phone ILIKE $${pi} OR c.customer_code ILIKE $${pi})`);
      params.push(`%${search}%`);
      pi++;
    }
    if (status) { where.push(`c.status = $${pi++}`); params.push(status); }
    if (route_id) { where.push(`c.assigned_route_id = $${pi++}`); params.push(route_id); }

    const whereStr = where.join(' AND ');

    const [rows, countRes] = await Promise.all([
      readFromCRM(
        `SELECT c.*, r.route_name
         FROM customers c
         LEFT JOIN routes r ON r.id = c.assigned_route_id
         WHERE ${whereStr}
         ORDER BY c.created_at DESC
         LIMIT $${pi} OFFSET $${pi + 1}`,
        [...params, limit, offset]
      ),
      readFromCRM(`SELECT COUNT(*) FROM customers c WHERE ${whereStr}`, params),
    ]);

    res.json({
      success: true,
      data: rows.rows,
      total: parseInt(countRes.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/customers/:id — full detail
// ─────────────────────────────────────────────
const getCustomerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [customer, subscriptions, wallet, ledger] = await Promise.all([
      readFromCRM(
        `SELECT c.*, r.route_name FROM customers c
         LEFT JOIN routes r ON r.id = c.assigned_route_id
         WHERE c.id = $1`,
        [id]
      ),
      readFromCRM(
        `SELECT s.*, p.name as product_name, p.unit, p.price_per_unit
         FROM subscriptions s
         LEFT JOIN products p ON p.id = s.product_id
         WHERE s.customer_id = $1
         ORDER BY s.created_at DESC`,
        [id]
      ),
      readFromCRM('SELECT * FROM wallet WHERE customer_id = $1', [id]),
      readFromCRM(
        `SELECT * FROM customer_ledger WHERE customer_id = $1 ORDER BY date DESC LIMIT 30`,
        [id]
      ),
    ]);

    if (!customer.rows[0]) return res.status(404).json({ success: false, message: 'Customer not found.' });

    res.json({
      success: true,
      data: {
        ...customer.rows[0],
        subscriptions: subscriptions.rows,
        wallet: wallet.rows[0] || null,
        ledger: ledger.rows,
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// POST /api/customers — create
// ─────────────────────────────────────────────
const createCustomer = async (req, res, next) => {
  try {
    const {
      name, phone, whatsapp_number, address, lat, lng,
      assigned_route_id, enquiry_source, status = 'Active',
    } = req.body;

    if (!name || !phone) return res.status(400).json({ success: false, message: 'Name and phone are required.' });

    // Generate customer code
    const countRes = await readFromCRM('SELECT COUNT(*) FROM customers');
    const nextNum = parseInt(countRes.rows[0].count) + 1;
    const customer_code = `MM${String(nextNum).padStart(4, '0')}`;

    const result = await writeToCRM(
      `INSERT INTO customers (customer_code, name, phone, whatsapp_number, address, lat, lng, assigned_route_id, enquiry_source, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [customer_code, name, phone, whatsapp_number || phone, address, lat || null, lng || null, assigned_route_id || null, enquiry_source || 'Direct', status]
    );

    // Create wallet entry
    await writeToCRM('INSERT INTO wallet (customer_id) VALUES ($1) ON CONFLICT DO NOTHING', [result.rows[0].id]);

    // Audit
    await writeToCRM(
      `INSERT INTO audit_logs (user_type, user_ref_id, action, entity, entity_id, ip_address) VALUES ($1,$2,$3,$4,$5,$6)`,
      ['SuperAdmin', req.admin.id, 'CREATE_CUSTOMER', 'customers', result.rows[0].id, req.ip]
    );

    res.status(201).json({ success: true, message: 'Customer created.', data: result.rows[0] });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// PUT /api/customers/:id — update
// ─────────────────────────────────────────────
const updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, whatsapp_number, address, lat, lng, assigned_route_id } = req.body;

    await writeToCRM(
      `UPDATE customers SET name=$1, phone=$2, whatsapp_number=$3, address=$4, lat=$5, lng=$6, assigned_route_id=$7
       WHERE id=$8`,
      [name, phone, whatsapp_number, address, lat || null, lng || null, assigned_route_id || null, id]
    );

    await writeToCRM(
      `INSERT INTO audit_logs (user_type, user_ref_id, action, entity, entity_id, ip_address) VALUES ($1,$2,$3,$4,$5,$6)`,
      ['SuperAdmin', req.admin.id, 'UPDATE_CUSTOMER', 'customers', id, req.ip]
    );

    res.json({ success: true, message: 'Customer updated.' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// PATCH /api/customers/:id/status — toggle
// ─────────────────────────────────────────────
const toggleCustomerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['Active', 'Inactive', 'Suspended'].includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status.' });

    await writeToCRM('UPDATE customers SET status=$1 WHERE id=$2', [status, id]);
    await writeToCRM(
      `INSERT INTO audit_logs (user_type, user_ref_id, action, entity, entity_id, ip_address) VALUES ($1,$2,$3,$4,$5,$6)`,
      ['SuperAdmin', req.admin.id, `STATUS_${status.toUpperCase()}`, 'customers', id, req.ip]
    );

    res.json({ success: true, message: `Customer status set to ${status}.` });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/customers/:id/ledger
// ─────────────────────────────────────────────
const getCustomerLedger = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;
    const result = await readFromCRM(
      'SELECT * FROM customer_ledger WHERE customer_id=$1 ORDER BY date DESC, created_at DESC LIMIT $2 OFFSET $3',
      [id, limit, offset]
    );
    const count = await readFromCRM('SELECT COUNT(*) FROM customer_ledger WHERE customer_id=$1', [id]);
    res.json({ success: true, data: result.rows, total: parseInt(count.rows[0].count) });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// POST /api/customers/:id/notes
// ─────────────────────────────────────────────
const addCustomerNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    if (!note) return res.status(400).json({ success: false, message: 'Note is required.' });
    await writeToCRM(
      'INSERT INTO customer_notes (customer_id, note, created_by) VALUES ($1, $2, $3)',
      [id, note, req.admin.name || 'Super Admin']
    );
    res.json({ success: true, message: 'Note added.' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/customers/:id/notes
// ─────────────────────────────────────────────
const getCustomerNotes = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await readFromCRM('SELECT * FROM customer_notes WHERE customer_id=$1 ORDER BY created_at DESC', [id]);
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// POST /api/customers/enquiry — add enquiry
// ─────────────────────────────────────────────
const createEnquiry = async (req, res, next) => {
  try {
    const { name, phone, address } = req.body;
    if (!name || !phone) return res.status(400).json({ success: false, message: 'Name and phone required.' });
    const result = await writeToCRM(
      `INSERT INTO customer_enquiries (name, phone, address) VALUES ($1,$2,$3) RETURNING *`,
      [name, phone, address || '']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/customers/enquiries
// ─────────────────────────────────────────────
const getEnquiries = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const [rows, count] = await Promise.all([
      readFromCRM('SELECT * FROM customer_enquiries ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]),
      readFromCRM('SELECT COUNT(*) FROM customer_enquiries'),
    ]);
    res.json({ success: true, data: rows.rows, total: parseInt(count.rows[0].count) });
  } catch (err) { next(err); }
};

module.exports = {
  getCustomers, getCustomerById, createCustomer, updateCustomer,
  toggleCustomerStatus, getCustomerLedger, addCustomerNote, getCustomerNotes,
  createEnquiry, getEnquiries,
};

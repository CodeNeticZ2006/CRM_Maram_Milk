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

    if (route_id) {
      // Find route_name if route_id is a UUID or DB2 key
      const routeCheck = await readFromCRM(
        `SELECT id, route_name FROM routes WHERE id::text = $1 OR LOWER(route_name) = LOWER($1)`,
        [route_id]
      ).catch(() => ({ rows: [] }));

      let routeName = route_id;
      if (routeCheck.rows.length > 0) {
        routeName = routeCheck.rows[0].route_name;
      } else {
        const db2Map = {
          'db2-1': 'Alwarpet', 'db2-2': 'Egmore', 'db2-3': 'Mandaveli 1', 'db2-4': 'Mandaveli 2',
          'db2-5': 'MRC Ngr', 'db2-6': 'Mylapore 1', 'db2-7': 'Mylapore 2', 'db2-8': 'Nungambakkam',
          'db2-9': 'Royapettah', 'db2-10': 'T-Nagar', 'db2-11': 'Teynampet', 'db2-12': 'Triplicane',
          'db2-13': 'West Mambalam 1', 'db2-14': 'West Mambalam 2'
        };
        if (db2Map[route_id]) routeName = db2Map[route_id];
      }

      where.push(`(
        c.assigned_route_id = $${pi}
        OR r.id::text = $${pi}
        OR r.route_name ILIKE $${pi + 1}
        OR c.assigned_route_id ILIKE $${pi + 1}
      )`);
      params.push(route_id, `%${routeName}%`);
      pi += 2;
    }

    const whereStr = where.join(' AND ');

    const [rows, countRes] = await Promise.all([
      readFromCRM(
        `SELECT c.*, COALESCE(r.route_name, c.assigned_route_id) AS route_name
         FROM customers c
         LEFT JOIN routes r ON r.id::text = c.assigned_route_id
         WHERE ${whereStr}
         ORDER BY c.created_at DESC
         LIMIT $${pi} OFFSET $${pi + 1}`,
        [...params, limit, offset]
      ),
      readFromCRM(`SELECT COUNT(*) FROM customers c LEFT JOIN routes r ON r.id::text = c.assigned_route_id WHERE ${whereStr}`, params),
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
        `SELECT c.*, COALESCE(r.route_name, c.assigned_route_id) AS route_name FROM customers c
         LEFT JOIN routes r ON r.id::text = c.assigned_route_id
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

// Helper: Generate next unique customer code
const generateCustomerCode = async () => {
  const codeRes = await readFromCRM(`SELECT customer_code FROM customers WHERE customer_code LIKE 'MM%'`);
  let maxNum = 0;
  for (const row of codeRes.rows) {
    const num = parseInt(row.customer_code.replace('MM', ''), 10);
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  }
  let nextNum = maxNum + 1;
  let code = `MM${String(nextNum).padStart(4, '0')}`;

  let check = await readFromCRM('SELECT 1 FROM customers WHERE customer_code = $1', [code]);
  while (check.rows.length > 0) {
    nextNum++;
    code = `MM${String(nextNum).padStart(4, '0')}`;
    check = await readFromCRM('SELECT 1 FROM customers WHERE customer_code = $1', [code]);
  }

  return code;
};

// ─────────────────────────────────────────────
// POST /api/customers — create
// ─────────────────────────────────────────────
const createCustomer = async (req, res, next) => {
  try {
    const {
      name, phone, whatsapp_number, address, lat, lng,
      assigned_route_id, enquiry_source, status = 'Active', maps_url,
    } = req.body;

    if (!name || !phone) return res.status(400).json({ success: false, message: 'Name and phone are required.' });

    // Generate unique customer code safely
    const customer_code = await generateCustomerCode();

    const result = await writeToCRM(
      `INSERT INTO customers (customer_code, name, phone, whatsapp_number, address, lat, lng, assigned_route_id, enquiry_source, status, maps_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [customer_code, name, phone, whatsapp_number || phone, address, lat || null, lng || null, assigned_route_id || null, enquiry_source || 'Direct', status, maps_url || null]
    );

    // Create wallet entry
    await writeToCRM('INSERT INTO wallet (customer_id) VALUES ($1) ON CONFLICT DO NOTHING', [result.rows[0].id]);

    // Audit
    await writeToCRM(
      `INSERT INTO audit_logs (user_type, user_ref_id, action, entity, entity_id, ip_address) VALUES ($1,$2,$3,$4,$5,$6)`,
      ['SuperAdmin', req.admin?.id || null, 'CREATE_CUSTOMER', 'customers', result.rows[0].id, req.ip]
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
    const { name, phone, whatsapp_number, address, lat, lng, assigned_route_id, enquiry_source, status, maps_url } = req.body;

    await writeToCRM(
      `UPDATE customers SET name=$1, phone=$2, whatsapp_number=$3, address=$4, lat=$5, lng=$6, assigned_route_id=$7, enquiry_source=$8, status=$9, maps_url=$10
       WHERE id=$11`,
      [name, phone, whatsapp_number, address, lat || null, lng || null, assigned_route_id || null, enquiry_source || 'Direct', status || 'Active', maps_url || null, id]
    );

    await writeToCRM(
      `INSERT INTO audit_logs (user_type, user_ref_id, action, entity, entity_id, ip_address) VALUES ($1,$2,$3,$4,$5,$6)`,
      ['SuperAdmin', req.admin?.id || null, 'UPDATE_CUSTOMER', 'customers', id, req.ip]
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
// DELETE /api/customers/:id — hard delete
// ─────────────────────────────────────────────
const deleteCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check customer exists first
    const check = await readFromCRM('SELECT id, name, customer_code FROM customers WHERE id=$1', [id]);
    if (!check.rows[0]) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const { name, customer_code } = check.rows[0];

    // Delete related data first (wallet, notes) to avoid FK violations if any
    await writeToCRM('DELETE FROM customer_notes WHERE customer_id=$1', [id]);
    await writeToCRM('DELETE FROM wallet WHERE customer_id=$1', [id]);
    await writeToCRM('DELETE FROM customers WHERE id=$1', [id]);

    await writeToCRM(
      `INSERT INTO audit_logs (user_type, user_ref_id, action, entity, entity_id, ip_address) VALUES ($1,$2,$3,$4,$5,$6)`,
      ['SuperAdmin', req.admin.id, 'DELETE_CUSTOMER', 'customers', id, req.ip]
    );

    res.json({ success: true, message: `Customer ${customer_code} (${name}) deleted successfully.` });
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
  toggleCustomerStatus, deleteCustomer, getCustomerLedger, addCustomerNote, getCustomerNotes,
  createEnquiry, getEnquiries,
};

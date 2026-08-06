const { readFromCRM, writeToCRM } = require('../config/database');

// ─────────────────────────────────────────────
// GET /api/pause — aggregated view of all pending requests
// ─────────────────────────────────────────────
const getPauseRequests = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, tab = 'hold' } = req.query;
    const offset = (page - 1) * limit;

    if (tab === 'hold') {
      const [rows, count] = await Promise.all([
        readFromCRM(
          `SELECT h.*, c.name as customer_name, c.customer_code, c.phone
           FROM hold_requests h LEFT JOIN customers c ON c.id = h.customer_id
           ORDER BY h.created_at DESC LIMIT $1 OFFSET $2`,
          [limit, offset]
        ),
        readFromCRM('SELECT COUNT(*) FROM hold_requests'),
      ]);
      return res.json({ success: true, data: rows.rows, total: parseInt(count.rows[0].count) });
    }

    if (tab === 'vacation') {
      const [rows, count] = await Promise.all([
        readFromCRM(
          `SELECT v.*, c.name as customer_name, c.customer_code, c.phone
           FROM vacation_requests v LEFT JOIN customers c ON c.id = v.customer_id
           ORDER BY v.created_at DESC LIMIT $1 OFFSET $2`,
          [limit, offset]
        ),
        readFromCRM('SELECT COUNT(*) FROM vacation_requests'),
      ]);
      return res.json({ success: true, data: rows.rows, total: parseInt(count.rows[0].count) });
    }

    if (tab === 'change') {
      const [rows, count] = await Promise.all([
        readFromCRM(
          `SELECT cr.*, c.name as customer_name, c.customer_code, c.phone
           FROM change_requests cr LEFT JOIN customers c ON c.id = cr.customer_id
           ORDER BY cr.created_at DESC LIMIT $1 OFFSET $2`,
          [limit, offset]
        ),
        readFromCRM('SELECT COUNT(*) FROM change_requests'),
      ]);
      return res.json({ success: true, data: rows.rows, total: parseInt(count.rows[0].count) });
    }

    res.status(400).json({ success: false, message: 'Invalid tab.' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// POST /api/pause/hold
// ─────────────────────────────────────────────
const createHoldRequest = async (req, res, next) => {
  try {
    const { customer_id, hold_from, hold_to, reason } = req.body;
    if (!customer_id || !hold_from || !hold_to)
      return res.status(400).json({ success: false, message: 'Customer, hold_from, and hold_to required.' });
    const result = await writeToCRM(
      `INSERT INTO hold_requests (customer_id, hold_from, hold_to, reason, status) VALUES ($1,$2,$3,$4,'Pending') RETURNING *`,
      [customer_id, hold_from, hold_to, reason || '']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// PATCH /api/pause/:type/:id — approve or reject
// ─────────────────────────────────────────────
const updateRequestStatus = async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const { action } = req.body; // 'Approved' | 'Rejected'
    const status = action === 'approve' ? 'Approved' : 'Rejected';
    const approved_by = req.admin.name || 'Super Admin';

    const tableMap = { hold: 'hold_requests', vacation: 'vacation_requests', change: 'change_requests' };
    const table = tableMap[type];
    if (!table) return res.status(400).json({ success: false, message: 'Invalid request type.' });

    await writeToCRM(`UPDATE ${table} SET status=$1, approved_by=$2 WHERE id=$3`, [status, approved_by, id]);
    res.json({ success: true, message: `Request ${status.toLowerCase()}.` });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/pause/summary — pending counts
// ─────────────────────────────────────────────
const getPauseSummary = async (req, res, next) => {
  try {
    const [hold, vacation, change] = await Promise.all([
      readFromCRM("SELECT COUNT(*) FROM hold_requests WHERE status='Pending'"),
      readFromCRM("SELECT COUNT(*) FROM vacation_requests WHERE status='Pending'"),
      readFromCRM("SELECT COUNT(*) FROM change_requests WHERE status='Pending'"),
    ]);
    res.json({
      success: true,
      data: {
        hold: parseInt(hold.rows[0].count),
        vacation: parseInt(vacation.rows[0].count),
        change: parseInt(change.rows[0].count),
      },
    });
  } catch (err) { next(err); }
};

module.exports = { getPauseRequests, createHoldRequest, updateRequestStatus, getPauseSummary };

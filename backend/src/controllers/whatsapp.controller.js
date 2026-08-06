const { readFromCRM, writeToCRM } = require('../config/database');

// ─────────────────────────────────────────────
// GET /api/whatsapp — pending requests
// ─────────────────────────────────────────────
const getWhatsappRequests = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status = 'Pending' } = req.query;
    const offset = (page - 1) * limit;
    const [rows, count] = await Promise.all([
      readFromCRM(
        `SELECT w.*, c.name as customer_name, c.phone, c.customer_code
         FROM whatsapp_requests w
         LEFT JOIN customers c ON c.id = w.customer_id
         WHERE w.status = $1
         ORDER BY w.created_at DESC LIMIT $2 OFFSET $3`,
        [status, limit, offset]
      ),
      readFromCRM('SELECT COUNT(*) FROM whatsapp_requests WHERE status=$1', [status]),
    ]);
    res.json({ success: true, data: rows.rows, total: parseInt(count.rows[0].count) });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// PATCH /api/whatsapp/:id — approve/reject
// ─────────────────────────────────────────────
const updateWhatsappStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const status = action === 'approve' ? 'Approved' : 'Rejected';
    const approved_by = req.admin.name || 'Super Admin';
    await writeToCRM('UPDATE whatsapp_requests SET status=$1, approved_by=$2 WHERE id=$3', [status, approved_by, id]);
    res.json({ success: true, message: `Request ${status.toLowerCase()}.` });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/whatsapp/stats
// ─────────────────────────────────────────────
const getWhatsappStats = async (req, res, next) => {
  try {
    const [pending, approved, rejected] = await Promise.all([
      readFromCRM("SELECT COUNT(*) FROM whatsapp_requests WHERE status='Pending'"),
      readFromCRM("SELECT COUNT(*) FROM whatsapp_requests WHERE status='Approved'"),
      readFromCRM("SELECT COUNT(*) FROM whatsapp_requests WHERE status='Rejected'"),
    ]);
    res.json({
      success: true,
      data: {
        pending: parseInt(pending.rows[0].count),
        approved: parseInt(approved.rows[0].count),
        rejected: parseInt(rejected.rows[0].count),
      },
    });
  } catch (err) { next(err); }
};

module.exports = { getWhatsappRequests, updateWhatsappStatus, getWhatsappStats };

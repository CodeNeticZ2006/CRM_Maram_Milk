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
          `SELECT * FROM (
            SELECT
              h.id, h.customer_id,
              h.hold_from::text as hold_from,
              h.hold_to::text as hold_to,
              h.reason, h.status, h.approved_by, h.created_at,
              'hold_request' as source,
              c.name as customer_name, c.customer_code, c.phone
            FROM hold_requests h
            LEFT JOIN customers c ON c.id = h.customer_id

            UNION ALL

            SELECT
              sp.id, sp.customer_id,
              COALESCE(sp.pause_start_date, sp.pause_date)::text as hold_from,
              COALESCE(sp.pause_end_date, sp.resume_date, sp.pause_start_date, sp.pause_date)::text as hold_to,
              COALESCE(sp.reason, 'Subscription Pause') as reason,
              CASE WHEN sp.is_active = FALSE OR sp.status = 'Cancelled' THEN 'Cancelled' ELSE 'Approved' END as status,
              COALESCE(sp.created_by, 'Super Admin') as approved_by,
              sp.created_at,
              'subscription_pause' as source,
              c.name as customer_name, c.customer_code, c.phone
            FROM subscription_pauses sp
            LEFT JOIN customers c ON c.id = sp.customer_id
            WHERE NOT EXISTS (
              SELECT 1 FROM hold_requests hr
              WHERE hr.customer_id = sp.customer_id
                AND hr.hold_from = COALESCE(sp.pause_start_date, sp.pause_date)
            )
          ) combined
          ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
          [limit, offset]
        ),
        readFromCRM(`
          SELECT (
            (SELECT COUNT(*) FROM hold_requests) +
            (SELECT COUNT(*) FROM subscription_pauses sp
             WHERE NOT EXISTS (
               SELECT 1 FROM hold_requests hr
               WHERE hr.customer_id = sp.customer_id
                 AND hr.hold_from = COALESCE(sp.pause_start_date, sp.pause_date)
             ))
          ) as count
        `),
      ]);
      return res.json({ success: true, data: rows.rows, total: parseInt(count.rows[0].count) });
    }

    if (tab === 'vacation') {
      const [rows, count] = await Promise.all([
        readFromCRM(
          `SELECT * FROM (
            SELECT
              v.id, v.customer_id,
              v.start_date::text as start_date,
              v.end_date::text as end_date,
              v.reason, v.status, v.approved_by, v.created_at,
              'vacation_request' as source,
              c.name as customer_name, c.customer_code, c.phone
            FROM vacation_requests v
            LEFT JOIN customers c ON c.id = v.customer_id

            UNION ALL

            SELECT
              sp.id, sp.customer_id,
              COALESCE(sp.pause_start_date, sp.pause_date)::text as start_date,
              COALESCE(sp.pause_end_date, sp.resume_date, sp.pause_start_date, sp.pause_date)::text as end_date,
              COALESCE(sp.reason, 'Vacation') as reason,
              CASE WHEN sp.is_active = FALSE OR sp.status = 'Cancelled' THEN 'Cancelled' ELSE 'Approved' END as status,
              COALESCE(sp.created_by, 'Super Admin') as approved_by,
              sp.created_at,
              'subscription_pause' as source,
              c.name as customer_name, c.customer_code, c.phone
            FROM subscription_pauses sp
            LEFT JOIN customers c ON c.id = sp.customer_id
            WHERE sp.pause_type = 'Vacation' AND NOT EXISTS (
              SELECT 1 FROM vacation_requests vr
              WHERE vr.customer_id = sp.customer_id
                AND vr.start_date = COALESCE(sp.pause_start_date, sp.pause_date)
            )
          ) combined
          ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
          [limit, offset]
        ),
        readFromCRM(`
          SELECT (
            (SELECT COUNT(*) FROM vacation_requests) +
            (SELECT COUNT(*) FROM subscription_pauses sp
             WHERE sp.pause_type = 'Vacation' AND NOT EXISTS (
               SELECT 1 FROM vacation_requests vr
               WHERE vr.customer_id = sp.customer_id
                 AND vr.start_date = COALESCE(sp.pause_start_date, sp.pause_date)
             ))
          ) as count
        `),
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

    const adminName = req.admin?.name || 'Super Admin';
    const result = await writeToCRM(
      `INSERT INTO hold_requests (customer_id, hold_from, hold_to, reason, status, approved_by) VALUES ($1,$2,$3,$4,'Approved',$5) RETURNING *`,
      [customer_id, hold_from, hold_to, reason || 'Super Admin Hold', adminName]
    );

    // Sync to active subscriptions so delivery scheduler pauses delivery
    try {
      const subsRes = await readFromCRM(
        `SELECT id FROM subscriptions WHERE customer_id = $1 AND status = 'Active'`,
        [customer_id]
      );
      for (const sub of subsRes.rows) {
        await writeToCRM(
          `INSERT INTO subscription_pauses
            (subscription_id, customer_id, pause_start_date, pause_end_date, pause_date, resume_date, reason, status, is_active, pause_type, created_by)
           VALUES ($1, $2, $3, $4, $3, $4, $5, 'Active', TRUE, 'Temporary Hold', $6)`,
          [sub.id, customer_id, hold_from, hold_to, reason || 'Super Admin Hold', adminName]
        );
      }
    } catch (syncErr) {
      console.warn('⚠️ subscription_pauses sync warning on hold creation:', syncErr.message);
    }

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// PATCH /api/pause/:type/:id — approve or reject
// ─────────────────────────────────────────────
const updateRequestStatus = async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const { action } = req.body; // 'approve' | 'reject' | 'cancel'
    const status = action === 'approve' ? 'Approved' : 'Rejected';
    const approved_by = req.admin?.name || 'Super Admin';

    const tableMap = { hold: 'hold_requests', vacation: 'vacation_requests', change: 'change_requests' };
    const table = tableMap[type];
    if (!table) return res.status(400).json({ success: false, message: 'Invalid request type.' });

    let updatedRes = await writeToCRM(`UPDATE ${table} SET status=$1, approved_by=$2 WHERE id=$3 RETURNING *`, [status, approved_by, id]);

    // If id belongs to subscription_pauses directly
    if (updatedRes.rows.length === 0 && (type === 'hold' || type === 'vacation')) {
      const pauseUpdate = await writeToCRM(
        `UPDATE subscription_pauses SET is_active=$1, status=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
        [action === 'approve', action === 'approve' ? 'Active' : 'Cancelled', id]
      );
      if (pauseUpdate.rows.length > 0) {
        return res.json({ success: true, message: `Pause request ${status.toLowerCase()}.` });
      }
    }

    // If hold or vacation is Approved, create active subscription_pauses records for the customer's active subscriptions
    if (status === 'Approved' && (type === 'hold' || type === 'vacation') && updatedRes.rows.length > 0) {
      const reqRow = updatedRes.rows[0];
      const customerId = reqRow.customer_id;
      const startDate = reqRow.hold_from || reqRow.start_date;
      const endDate = reqRow.hold_to || reqRow.end_date || startDate;
      const reason = reqRow.reason || (type === 'hold' ? 'Temporary Hold' : 'Vacation Hold');
      const pauseType = type === 'hold' ? 'Temporary Hold' : 'Vacation';

      try {
        const subsRes = await readFromCRM(
          `SELECT id FROM subscriptions WHERE customer_id = $1 AND status = 'Active'`,
          [customerId]
        );

        for (const sub of subsRes.rows) {
          await writeToCRM(
            `INSERT INTO subscription_pauses
              (subscription_id, customer_id, pause_start_date, pause_end_date, pause_date, resume_date, reason, status, is_active, pause_type, created_by)
             VALUES ($1, $2, $3, $4, $3, $4, $5, 'Active', TRUE, $6, $7)`,
            [sub.id, customerId, startDate, endDate, reason, pauseType, approved_by]
          );
        }
      } catch (pauseSyncErr) {
        console.warn('⚠️ subscription_pauses sync warning on approval:', pauseSyncErr.message);
      }
    } else if (status === 'Rejected' && (type === 'hold' || type === 'vacation') && updatedRes.rows.length > 0) {
      // Deactivate any matching subscription_pauses
      const reqRow = updatedRes.rows[0];
      const customerId = reqRow.customer_id;
      const startDate = reqRow.hold_from || reqRow.start_date;
      try {
        await writeToCRM(
          `UPDATE subscription_pauses SET is_active=FALSE, status='Cancelled', updated_at=NOW()
           WHERE customer_id = $1 AND (pause_start_date = $2 OR pause_date = $2) AND is_active = TRUE`,
          [customerId, startDate]
        );
      } catch (pauseCancelErr) {
        console.warn('⚠️ subscription_pauses cancel warning:', pauseCancelErr.message);
      }
    }

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

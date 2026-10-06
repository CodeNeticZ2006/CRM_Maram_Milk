const { readFromCRM, writeToCRM } = require('../config/database');

// ─────────────────────────────────────────────
// Audit Logger Helper for pause history & logs
// ─────────────────────────────────────────────
const logPauseEvent = async ({
  pause_id,
  subscription_id,
  customer_id,
  customer_name,
  customer_code,
  customer_phone,
  action,
  pause_type,
  start_date,
  end_date,
  resume_date,
  reason,
  details = {},
  performed_by = 'Super Admin'
}) => {
  try {
    let name = customer_name;
    let code = customer_code;
    let phone = customer_phone;
    if (customer_id && (!name || !code)) {
      const cRes = await readFromCRM('SELECT name, customer_code, phone FROM customers WHERE id = $1', [customer_id]);
      if (cRes.rows[0]) {
        name = name || cRes.rows[0].name;
        code = code || cRes.rows[0].customer_code;
        phone = phone || cRes.rows[0].phone;
      }
    }

    await writeToCRM(`
      INSERT INTO pause_logs (
        pause_id, subscription_id, customer_id, customer_name, customer_code, customer_phone,
        action, pause_type, start_date, end_date, resume_date, reason, details, performed_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      pause_id || null,
      subscription_id || null,
      customer_id || null,
      name || 'Customer',
      code || null,
      phone || null,
      action,
      pause_type || 'Temporary Hold',
      start_date || null,
      end_date || null,
      resume_date || null,
      reason || null,
      JSON.stringify(details || {}),
      performed_by || 'Super Admin'
    ]);
  } catch (err) {
    console.warn('⚠️ Failed to write to pause_logs:', err.message);
  }
};

// ─────────────────────────────────────────────
// GET /api/pause — aggregated view of all pause requests & subscription pauses
// ─────────────────────────────────────────────
const getPauseRequests = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, tab = 'subscription_pauses', search = '', status_filter = 'all' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const today = new Date().toISOString().slice(0, 10);

    // ── TAB: Subscription Pauses (Direct Subscription Pauses) ──
    if (tab === 'subscription_pauses' || tab === 'all_pauses') {
      const where = ['1=1'];
      const params = [];
      let pi = 1;

      if (search && search.trim()) {
        where.push(`(c.name ILIKE $${pi} OR c.customer_code ILIKE $${pi} OR c.phone ILIKE $${pi})`);
        params.push(`%${search.trim()}%`);
        pi++;
      }

      if (status_filter === 'active') {
        where.push(`sp.is_active = TRUE AND COALESCE(sp.pause_start_date, sp.pause_date) <= '${today}' AND COALESCE(sp.pause_end_date, sp.resume_date, '9999-12-31') >= '${today}' AND sp.status NOT IN ('Cancelled', 'Resumed')`);
      } else if (status_filter === 'upcoming') {
        where.push(`sp.is_active = TRUE AND COALESCE(sp.pause_start_date, sp.pause_date) > '${today}' AND sp.status NOT IN ('Cancelled', 'Resumed')`);
      } else if (status_filter === 'completed') {
        where.push(`(sp.status IN ('Completed', 'Resumed') OR (sp.is_active = TRUE AND COALESCE(sp.pause_end_date, sp.resume_date) < '${today}'))`);
      } else if (status_filter === 'cancelled') {
        where.push(`(sp.status = 'Cancelled' OR (sp.is_active = FALSE AND sp.status NOT IN ('Completed', 'Resumed')))`);
      }

      const whereClause = where.join(' AND ');

      const [rows, count] = await Promise.all([
        readFromCRM(
          `SELECT
            sp.id,
            sp.subscription_id,
            sp.customer_id,
            sp.product_id,
            COALESCE(sp.pause_type, 'Temporary Hold') as pause_type,
            COALESCE(sp.pause_start_date, sp.pause_date)::text as pause_start_date,
            COALESCE(sp.pause_end_date, sp.resume_date, sp.pause_start_date, sp.pause_date)::text as pause_end_date,
            sp.resume_date::text as resume_date,
            sp.reason,
            sp.status as raw_status,
            sp.is_active,
            sp.created_by,
            sp.created_at,
            c.name as customer_name,
            c.customer_code,
            c.phone as customer_phone,
            c.address as customer_address,
            s.frequency_type,
            s.status as subscription_status,
            CASE
              WHEN sp.status = 'Resumed' THEN 'Resumed'
              WHEN sp.status = 'Completed' THEN 'Resumed'
              WHEN sp.status = 'Cancelled' THEN 'Cancelled'
              WHEN sp.is_active = FALSE AND sp.status NOT IN ('Resumed', 'Completed') THEN 'Cancelled'
              WHEN COALESCE(sp.pause_start_date, sp.pause_date) > '${today}' THEN 'Upcoming'
              WHEN COALESCE(sp.pause_start_date, sp.pause_date) <= '${today}' AND COALESCE(sp.pause_end_date, sp.resume_date, '9999-12-31') >= '${today}' THEN 'Active'
              ELSE 'Completed'
            END as computed_status,
            COALESCE((
              SELECT string_agg(p.name || ' (' || si.quantity || ')', ', ')
              FROM subscription_items si
              JOIN products p ON p.id = si.product_id
              WHERE si.subscription_id = sp.subscription_id AND si.is_active = TRUE
            ), 'Subscription #' || substring(sp.subscription_id::text, 1, 8)) as items_summary
          FROM subscription_pauses sp
          LEFT JOIN customers c ON c.id = sp.customer_id
          LEFT JOIN subscriptions s ON s.id = sp.subscription_id
          WHERE ${whereClause}
          ORDER BY sp.created_at DESC
          LIMIT $${pi} OFFSET $${pi + 1}`,
          [...params, limit, offset]
        ),
        readFromCRM(
          `SELECT COUNT(*) FROM subscription_pauses sp
           LEFT JOIN customers c ON c.id = sp.customer_id
           WHERE ${whereClause}`,
          params
        )
      ]);

      return res.json({
        success: true,
        data: rows.rows,
        total: parseInt(count.rows[0].count)
      });
    }

    // ── TAB: Hold Requests ──
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
              CASE
                WHEN sp.status = 'Resumed' THEN 'Resumed'
                WHEN sp.status = 'Completed' THEN 'Resumed'
                WHEN sp.status = 'Cancelled' THEN 'Cancelled'
                WHEN sp.is_active = FALSE AND sp.status NOT IN ('Resumed', 'Completed') THEN 'Cancelled'
                ELSE 'Approved'
              END as status,
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

    // ── TAB: Vacation Requests ──
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
              CASE
                WHEN sp.status = 'Resumed' THEN 'Resumed'
                WHEN sp.status = 'Completed' THEN 'Resumed'
                WHEN sp.status = 'Cancelled' THEN 'Cancelled'
                WHEN sp.is_active = FALSE AND sp.status NOT IN ('Resumed', 'Completed') THEN 'Cancelled'
                ELSE 'Approved'
              END as status,
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

    // ── TAB: Change Requests ──
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

    // ── TAB: History & Archive ──
    if (tab === 'history') {
      const historyWhere = ['1=1'];
      const historyParams = [];
      let hPi = 1;

      if (search && search.trim()) {
        historyWhere.push(`(pl.customer_name ILIKE $${hPi} OR pl.customer_code ILIKE $${hPi} OR pl.action ILIKE $${hPi} OR pl.reason ILIKE $${hPi})`);
        historyParams.push(`%${search.trim()}%`);
        hPi++;
      }

      const historyWhereClause = historyWhere.join(' AND ');

      const [rows, count] = await Promise.all([
        readFromCRM(
          `SELECT
            pl.id,
            pl.pause_id,
            pl.subscription_id,
            pl.customer_id,
            COALESCE(pl.customer_name, c.name, 'Customer') as customer_name,
            COALESCE(pl.customer_code, c.customer_code, '—') as customer_code,
            COALESCE(pl.customer_phone, c.phone, '—') as customer_phone,
            COALESCE(pl.action, 'PAUSE_LOGGED') as action,
            COALESCE(pl.pause_type, 'Temporary Hold') as pause_type,
            pl.start_date::text as pause_start_date,
            pl.end_date::text as pause_end_date,
            pl.resume_date::text as resume_date,
            COALESCE(pl.reason, '—') as reason,
            CASE
              WHEN pl.action IN ('DELIVERY_RESUMED', 'RESUMED') THEN 'Resumed'
              WHEN pl.action IN ('PAUSE_CANCELLED', 'CANCELLED', 'PAUSE_DELETED') THEN 'Cancelled'
              WHEN pl.action IN ('HOLD_APPROVED', 'VACATION_APPROVED', 'CHANGE_APPROVED') THEN 'Approved'
              WHEN pl.action IN ('HOLD_REJECTED', 'VACATION_REJECTED', 'CHANGE_REJECTED') THEN 'Rejected'
              ELSE 'Active'
            END as status,
            COALESCE(pl.performed_by, 'Super Admin') as created_by,
            pl.created_at
          FROM pause_logs pl
          LEFT JOIN customers c ON c.id = pl.customer_id
          WHERE ${historyWhereClause}
          ORDER BY pl.created_at DESC
          LIMIT $${hPi} OFFSET $${hPi + 1}`,
          [...historyParams, limit, offset]
        ),
        readFromCRM(
          `SELECT COUNT(*) FROM pause_logs pl
           WHERE ${historyWhereClause}`,
          historyParams
        )
      ]);

      return res.json({
        success: true,
        data: rows.rows,
        total: parseInt(count.rows[0].count)
      });
    }

    res.status(400).json({ success: false, message: 'Invalid tab.' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/pause/customer-subscriptions/:customerId
// Returns all active subscriptions with product items for a customer
// ─────────────────────────────────────────────
const getCustomerSubscriptions = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const subsRes = await readFromCRM(
      `SELECT
        s.id,
        s.frequency_type,
        s.status,
        s.start_date::text as start_date,
        s.end_date::text as end_date,
        COALESCE((
          SELECT string_agg(p.name || ' (' || si.quantity || ' ' || COALESCE(p.unit, 'pkt') || ')', ', ')
          FROM subscription_items si
          JOIN products p ON p.id = si.product_id
          WHERE si.subscription_id = s.id AND si.is_active = TRUE
        ), 'Subscription') as items_summary
       FROM subscriptions s
       WHERE s.customer_id = $1 AND s.status IN ('Active', 'Paused')
       ORDER BY s.created_at DESC`,
      [customerId]
    );
    res.json({ success: true, data: subsRes.rows });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// POST /api/pause/create or POST /api/pause
// Create a new pause activity (for customer or specific subscription)
// ─────────────────────────────────────────────
const createPause = async (req, res, next) => {
  try {
    const {
      customer_id,
      subscription_id,
      pause_type = 'Temporary Hold',
      pause_start_date,
      pause_end_date,
      reason
    } = req.body;

    if (!customer_id)
      return res.status(400).json({ success: false, message: 'Customer selection is required.' });
    if (!pause_start_date)
      return res.status(400).json({ success: false, message: 'Pause start date is required.' });

    const startDate = pause_start_date;
    const endDate = pause_end_date || pause_start_date;

    if (endDate < startDate)
      return res.status(400).json({ success: false, message: 'Pause end date cannot be earlier than start date.' });

    const adminName = req.admin?.name || 'Super Admin';
    const pauseReason = reason || `${pause_type} scheduled`;
    const today = new Date().toISOString().slice(0, 10);
    const isEffectiveToday = startDate <= today && today <= endDate;

    // Determine target subscriptions
    let targetSubIds = [];
    if (subscription_id && subscription_id !== 'all') {
      const subCheck = await readFromCRM(
        `SELECT id, status FROM subscriptions WHERE id = $1 AND customer_id = $2`,
        [subscription_id, customer_id]
      );
      if (subCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Selected subscription not found.' });
      }
      targetSubIds = [subscription_id];
    } else {
      // Pause all active/paused subscriptions of this customer
      const subsRes = await readFromCRM(
        `SELECT id FROM subscriptions WHERE customer_id = $1 AND status IN ('Active', 'Paused')`,
        [customer_id]
      );
      targetSubIds = subsRes.rows.map(r => r.id);
    }

    if (targetSubIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No active subscriptions found for this customer.' });
    }

    const createdRecords = [];
    for (const subId of targetSubIds) {
      const pauseRes = await writeToCRM(
        `INSERT INTO subscription_pauses
          (subscription_id, customer_id, pause_start_date, pause_end_date, pause_date, resume_date, reason, status, is_active, pause_type, created_by)
         VALUES ($1, $2, $3, $4, $3, $4, $5, 'Active', TRUE, $6, $7)
         RETURNING *`,
        [subId, customer_id, startDate, endDate, pauseReason, pause_type, adminName]
      );
      createdRecords.push(pauseRes.rows[0]);

      // Log to pause_logs audit trail
      await logPauseEvent({
        pause_id: pauseRes.rows[0].id,
        subscription_id: subId,
        customer_id,
        action: 'PAUSE_CREATED',
        pause_type,
        start_date: startDate,
        end_date: endDate,
        reason: pauseReason,
        performed_by: adminName
      });

      // If effective today, mark subscription as Paused
      if (isEffectiveToday) {
        await writeToCRM(`UPDATE subscriptions SET status = 'Paused', updated_at = NOW() WHERE id = $1`, [subId]);
      }
    }

    // Sync to hold_requests or vacation_requests so manager app and report sync
    if (pause_type === 'Vacation') {
      await writeToCRM(
        `INSERT INTO vacation_requests (customer_id, start_date, end_date, reason, status, approved_by)
         VALUES ($1, $2, $3, $4, 'Approved', $5)`,
        [customer_id, startDate, endDate, pauseReason, adminName]
      );
    } else {
      await writeToCRM(
        `INSERT INTO hold_requests (customer_id, hold_from, hold_to, reason, status, approved_by)
         VALUES ($1, $2, $3, $4, 'Approved', $5)`,
        [customer_id, startDate, endDate, pauseReason, adminName]
      );
    }

    res.status(201).json({
      success: true,
      message: `Successfully paused delivery from ${startDate} to ${endDate}.`,
      data: createdRecords
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// POST /api/pause/:id/resume — Resume delivery immediately or on specific date
// ─────────────────────────────────────────────
const resumePause = async (req, res, next) => {
  try {
    const { id } = req.params;
    const today = new Date().toISOString().slice(0, 10);
    const resumeDate = req.body?.resume_date || today;

    // Update the pause record
    const updateRes = await writeToCRM(
      `UPDATE subscription_pauses
       SET is_active = FALSE, status = 'Resumed', resume_date = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING subscription_id, customer_id, pause_start_date`,
      [resumeDate, id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pause record not found.' });
    }

    const { subscription_id, customer_id, pause_start_date } = updateRes.rows[0];

    // Check if subscription has any other active pause records covering today
    if (subscription_id) {
      const activeCheck = await readFromCRM(
        `SELECT id FROM subscription_pauses
         WHERE subscription_id = $1 AND is_active = TRUE
           AND COALESCE(pause_start_date, pause_date) <= $2
           AND COALESCE(pause_end_date, resume_date, '9999-12-31') >= $2`,
        [subscription_id, today]
      );

      if (activeCheck.rows.length === 0) {
        await writeToCRM(
          `UPDATE subscriptions SET status = 'Active', updated_at = NOW() WHERE id = $1 AND status != 'Cancelled'`,
          [subscription_id]
        );
      }
    }

    // Mark matching hold_requests as completed
    if (customer_id && pause_start_date) {
      await writeToCRM(
        `UPDATE hold_requests SET status = 'Completed'
         WHERE customer_id = $1 AND hold_from = $2 AND status = 'Approved'`,
        [customer_id, pause_start_date]
      );
    }

    let customerName = 'customer';
    if (customer_id) {
      const custRes = await readFromCRM('SELECT name FROM customers WHERE id = $1', [customer_id]);
      if (custRes.rows[0]?.name) customerName = custRes.rows[0].name;
    }

    // Log resume event
    await logPauseEvent({
      pause_id: id,
      subscription_id,
      customer_id,
      customer_name: customerName,
      action: 'DELIVERY_RESUMED',
      resume_date: resumeDate,
      reason: `Deliveries resumed effective ${resumeDate}`,
      performed_by: req.admin?.name || 'Super Admin'
    });

    res.json({
      success: true,
      message: `Deliveries for ${customerName} successfully resumed (Effective: ${resumeDate}). Subscription dispatch is now Active.`
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// POST /api/pause/bulk-resume
// ─────────────────────────────────────────────
const bulkResumePauses = async (req, res, next) => {
  try {
    const { ids = [], resume_date } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No pause IDs provided.' });
    }
    const today = new Date().toISOString().slice(0, 10);
    const resumeDate = resume_date || today;
    let count = 0;

    for (const id of ids) {
      const updateRes = await writeToCRM(
        `UPDATE subscription_pauses
         SET is_active = FALSE, status = 'Resumed', resume_date = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING subscription_id, customer_id, pause_start_date`,
        [resumeDate, id]
      );
      if (updateRes.rows.length > 0) {
        count++;
        const { subscription_id, customer_id, pause_start_date } = updateRes.rows[0];
        if (subscription_id) {
          const activeCheck = await readFromCRM(
            `SELECT id FROM subscription_pauses
             WHERE subscription_id = $1 AND is_active = TRUE
               AND COALESCE(pause_start_date, pause_date) <= $2
               AND COALESCE(pause_end_date, resume_date, '9999-12-31') >= $2`,
            [subscription_id, today]
          );
          if (activeCheck.rows.length === 0) {
            await writeToCRM(
              `UPDATE subscriptions SET status = 'Active', updated_at = NOW() WHERE id = $1 AND status != 'Cancelled'`,
              [subscription_id]
            );
          }
        }
        if (customer_id && pause_start_date) {
          await writeToCRM(
            `UPDATE hold_requests SET status = 'Completed'
             WHERE customer_id = $1 AND hold_from = $2 AND status = 'Approved'`,
            [customer_id, pause_start_date]
          );
        }

        // Log bulk resume
        await logPauseEvent({
          pause_id: id,
          subscription_id,
          customer_id,
          action: 'DELIVERY_RESUMED',
          resume_date: resumeDate,
          reason: `Bulk delivery resumed effective ${resumeDate}`,
          performed_by: req.admin?.name || 'Super Admin'
        });
      }
    }

    res.json({ success: true, message: `Successfully resumed deliveries for ${count} subscription(s). Dispatch schedules are now Active.` });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// POST /api/pause/bulk-cancel
// ─────────────────────────────────────────────
const bulkCancelPauses = async (req, res, next) => {
  try {
    const { ids = [] } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No pause IDs provided.' });
    }
    const today = new Date().toISOString().slice(0, 10);
    let count = 0;

    for (const id of ids) {
      const updateRes = await writeToCRM(
        `UPDATE subscription_pauses
         SET is_active = FALSE, status = 'Cancelled', updated_at = NOW()
         WHERE id = $1
         RETURNING subscription_id, customer_id, pause_start_date`,
        [id]
      );
      if (updateRes.rows.length > 0) {
        count++;
        const { subscription_id, customer_id, pause_start_date } = updateRes.rows[0];
        if (subscription_id) {
          const activeCheck = await readFromCRM(
            `SELECT id FROM subscription_pauses
             WHERE subscription_id = $1 AND is_active = TRUE
               AND COALESCE(pause_start_date, pause_date) <= $2
               AND COALESCE(pause_end_date, resume_date, '9999-12-31') >= $2`,
            [subscription_id, today]
          );
          if (activeCheck.rows.length === 0) {
            await writeToCRM(
              `UPDATE subscriptions SET status = 'Active', updated_at = NOW() WHERE id = $1 AND status != 'Cancelled'`,
              [subscription_id]
            );
          }
        }
        if (customer_id && pause_start_date) {
          await writeToCRM(
            `UPDATE hold_requests SET status = 'Cancelled'
             WHERE customer_id = $1 AND hold_from = $2 AND status = 'Approved'`,
            [customer_id, pause_start_date]
          );
        }

        // Log bulk cancel
        await logPauseEvent({
          pause_id: id,
          subscription_id,
          customer_id,
          action: 'PAUSE_CANCELLED',
          reason: 'Bulk pause cancelled by admin',
          performed_by: req.admin?.name || 'Super Admin'
        });
      }
    }

    res.json({ success: true, message: `Successfully cancelled ${count} pause(s).` });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// POST /api/pause/:id/cancel or DELETE /api/pause/:id — Cancel a pause
// ─────────────────────────────────────────────
const cancelPause = async (req, res, next) => {
  try {
    const { id } = req.params;
    const today = new Date().toISOString().slice(0, 10);

    const updateRes = await writeToCRM(
      `UPDATE subscription_pauses
       SET is_active = FALSE, status = 'Cancelled', updated_at = NOW()
       WHERE id = $1
       RETURNING subscription_id, customer_id, pause_start_date`,
      [id]
    );

    if (updateRes.rows.length === 0) {
      // Check if it's a hold_request or vacation_request id
      const holdRes = await writeToCRM(`UPDATE hold_requests SET status = 'Cancelled' WHERE id = $1 RETURNING customer_id`, [id]);
      if (holdRes.rows.length > 0) {
        return res.json({ success: true, message: 'Hold request cancelled.' });
      }
      const vacRes = await writeToCRM(`UPDATE vacation_requests SET status = 'Cancelled' WHERE id = $1 RETURNING customer_id`, [id]);
      if (vacRes.rows.length > 0) {
        return res.json({ success: true, message: 'Vacation request cancelled.' });
      }
      return res.status(404).json({ success: false, message: 'Pause record not found.' });
    }

    const { subscription_id, customer_id, pause_start_date } = updateRes.rows[0];

    // If subscription has no other active pauses, ensure it's Active
    if (subscription_id) {
      const activeCheck = await readFromCRM(
        `SELECT id FROM subscription_pauses
         WHERE subscription_id = $1 AND is_active = TRUE
           AND COALESCE(pause_start_date, pause_date) <= $2
           AND COALESCE(pause_end_date, resume_date, '9999-12-31') >= $2`,
        [subscription_id, today]
      );

      if (activeCheck.rows.length === 0) {
        await writeToCRM(
          `UPDATE subscriptions SET status = 'Active', updated_at = NOW() WHERE id = $1 AND status != 'Cancelled'`,
          [subscription_id]
        );
      }
    }

    // Cancel matching hold_requests
    if (customer_id && pause_start_date) {
      await writeToCRM(
        `UPDATE hold_requests SET status = 'Cancelled'
         WHERE customer_id = $1 AND hold_from = $2 AND status = 'Approved'`,
        [customer_id, pause_start_date]
      );
    }

    let customerName = 'customer';
    if (customer_id) {
      const custRes = await readFromCRM('SELECT name FROM customers WHERE id = $1', [customer_id]);
      if (custRes.rows[0]?.name) customerName = custRes.rows[0].name;
    }

    // Log cancel event
    await logPauseEvent({
      pause_id: id,
      subscription_id,
      customer_id,
      customer_name: customerName,
      action: 'PAUSE_CANCELLED',
      reason: 'Pause schedule cancelled by admin',
      performed_by: req.admin?.name || 'Super Admin'
    });

    res.json({ success: true, message: `Pause schedule for ${customerName} cancelled. Regular delivery schedule restored.` });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// PUT /api/pause/:id — Extend / modify pause dates & reason
// ─────────────────────────────────────────────
const extendPause = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { pause_start_date, pause_end_date, reason } = req.body;

    if (!pause_start_date || !pause_end_date)
      return res.status(400).json({ success: false, message: 'Start date and end date are required.' });
    if (pause_end_date < pause_start_date)
      return res.status(400).json({ success: false, message: 'End date cannot be earlier than start date.' });

    const updateRes = await writeToCRM(
      `UPDATE subscription_pauses
       SET pause_start_date = $1, pause_date = $1,
           pause_end_date = $2, resume_date = $2,
           reason = COALESCE($3, reason),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [pause_start_date, pause_end_date, reason, id]
    );

    if (updateRes.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Pause record not found.' });

    // Log modification event
    await logPauseEvent({
      pause_id: id,
      customer_id: updateRes.rows[0].customer_id,
      subscription_id: updateRes.rows[0].subscription_id,
      action: 'PAUSE_MODIFIED',
      start_date: pause_start_date,
      end_date: pause_end_date,
      reason: reason || 'Pause schedule dates modified',
      performed_by: req.admin?.name || 'Super Admin'
    });

    res.json({ success: true, message: 'Pause dates updated successfully.', data: updateRes.rows[0] });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// POST /api/pause/hold — Legacy Hold Request route (kept for backwards compatibility)
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
// PATCH /api/pause/:type/:id — approve or reject hold/vacation/change
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

    const typeLabels = {
      hold: action === 'approve' ? 'Customer hold request approved and delivery pause activated.' : 'Customer hold request rejected.',
      vacation: action === 'approve' ? 'Vacation request approved and delivery schedule paused.' : 'Vacation request rejected.',
      change: action === 'approve' ? 'Customer subscription change request approved and applied.' : 'Customer subscription change request rejected.'
    };

    res.json({ success: true, message: typeLabels[type] || `Request ${status.toLowerCase()}.` });

    if (updatedRes.rows.length > 0) {
      await logPauseEvent({
        action: `${type.toUpperCase()}_${status.toUpperCase()}`,
        customer_id: updatedRes.rows[0]?.customer_id,
        reason: `${type} request ${status.toLowerCase()}`,
        performed_by: approved_by
      });
    }
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// DELETE /api/pause/:id/record — Permanently remove a pause record
// ─────────────────────────────────────────────
const deletePauseRecord = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await readFromCRM('SELECT * FROM subscription_pauses WHERE id = $1', [id]);
    if (existing.rows.length > 0) {
      await logPauseEvent({
        pause_id: id,
        customer_id: existing.rows[0].customer_id,
        subscription_id: existing.rows[0].subscription_id,
        action: 'PAUSE_DELETED',
        pause_type: existing.rows[0].pause_type,
        start_date: existing.rows[0].pause_start_date,
        end_date: existing.rows[0].pause_end_date,
        reason: 'Pause record deleted by admin',
        performed_by: req.admin?.name || 'Super Admin'
      });
    }

    const deleteRes = await writeToCRM('DELETE FROM subscription_pauses WHERE id = $1 RETURNING id', [id]);
    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pause record not found.' });
    }
    res.json({ success: true, message: 'Pause record permanently removed from active list.' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/pause/summary — comprehensive KPI summary
// ─────────────────────────────────────────────
const getPauseSummary = async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const startOfMonth = today.slice(0, 7) + '-01';

    const [activeRes, upcomingRes, holdRes, vacationRes, changeRes, resumedRes] = await Promise.all([
      // Currently active pauses (today falls inside the pause window)
      readFromCRM(`
        SELECT COUNT(DISTINCT sp.id) FROM subscription_pauses sp
        WHERE sp.is_active = TRUE
          AND COALESCE(sp.pause_start_date, sp.pause_date) <= $1
          AND COALESCE(sp.pause_end_date, sp.resume_date, '9999-12-31') >= $1
          AND sp.status != 'Cancelled'
      `, [today]),

      // Upcoming pauses scheduled for the future
      readFromCRM(`
        SELECT COUNT(DISTINCT sp.id) FROM subscription_pauses sp
        WHERE sp.is_active = TRUE
          AND COALESCE(sp.pause_start_date, sp.pause_date) > $1
          AND sp.status != 'Cancelled'
      `, [today]),

      // Pending hold requests
      readFromCRM("SELECT COUNT(*) FROM hold_requests WHERE status='Pending'"),

      // Pending vacation requests
      readFromCRM("SELECT COUNT(*) FROM vacation_requests WHERE status='Pending'"),

      // Pending change requests
      readFromCRM("SELECT COUNT(*) FROM change_requests WHERE status='Pending'"),

      // Resumed / Completed this month
      readFromCRM(`
        SELECT COUNT(*) FROM subscription_pauses
        WHERE (status = 'Completed' OR resume_date IS NOT NULL)
          AND (resume_date >= $1 OR updated_at >= $1)
      `, [startOfMonth])
    ]);

    res.json({
      success: true,
      data: {
        activePauses: parseInt(activeRes.rows[0].count) || 0,
        upcomingPauses: parseInt(upcomingRes.rows[0].count) || 0,
        hold: parseInt(holdRes.rows[0].count) || 0,
        vacation: parseInt(vacationRes.rows[0].count) || 0,
        change: parseInt(changeRes.rows[0].count) || 0,
        pendingTotal: (parseInt(holdRes.rows[0].count) || 0) + (parseInt(vacationRes.rows[0].count) || 0),
        resumedThisMonth: parseInt(resumedRes.rows[0].count) || 0,
      },
    });
  } catch (err) { next(err); }
};

module.exports = {
  getPauseRequests,
  getCustomerSubscriptions,
  createPause,
  resumePause,
  bulkResumePauses,
  bulkCancelPauses,
  cancelPause,
  deletePauseRecord,
  extendPause,
  createHoldRequest,
  updateRequestStatus,
  getPauseSummary
};


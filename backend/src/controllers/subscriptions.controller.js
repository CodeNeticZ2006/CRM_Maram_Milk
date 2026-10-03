const { readFromCRM, writeToCRM } = require('../config/database');
const { getDeliveriesForDate, generateDeliveryPreview } = require('../services/subscriptionScheduler.service');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/subscriptions/daily?date=YYYY-MM-DD
// Returns all delivery-applicable subscriptions for the given date.
// MUST be defined BEFORE /:id routes to avoid Express treating 'daily' as an ID.
// ─────────────────────────────────────────────────────────────────────────────
const getDailyDeliveries = async (req, res, next) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
      return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD.' });

    const deliveries = await getDeliveriesForDate(dateStr);
    res.json({
      success: true,
      date: dateStr,
      totalCustomers: deliveries.length,
      data: deliveries,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/subscriptions
// List subscriptions with customer + aggregated item count
// ─────────────────────────────────────────────────────────────────────────────
const getSubscriptions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status = '', customer_id = '', frequency_type = '', search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where = ['1=1'];
    const params = [];
    let pi = 1;

    if (status)       { where.push(`s.status = $${pi++}`);             params.push(status); }
    if (customer_id)  { where.push(`s.customer_id = $${pi++}`);        params.push(customer_id); }
    if (frequency_type) { where.push(`s.frequency_type = $${pi++}`);   params.push(frequency_type.toUpperCase()); }
    if (search) {
      where.push(`(c.name ILIKE $${pi} OR c.customer_code ILIKE $${pi} OR c.phone ILIKE $${pi})`);
      params.push(`%${search}%`); pi++;
    }

    const whereStr = where.join(' AND ');

    const [rows, count] = await Promise.all([
      readFromCRM(
        `SELECT
          s.*,
          c.name AS customer_name, c.phone AS customer_phone, c.customer_code,
          c.address,
          (SELECT COUNT(*) FROM subscription_items si WHERE si.subscription_id = s.id AND si.is_active = TRUE) AS item_count,
          (SELECT json_agg(json_build_object(
            'id', si.id,
            'product_id', si.product_id,
            'product_name', p.name,
            'quantity', si.quantity,
            'unit', p.unit,
            'rate', COALESCE(si.rate_snapshot, p.price_per_unit)
          ) ORDER BY p.name)
           FROM subscription_items si
           JOIN products p ON p.id = si.product_id
           WHERE si.subscription_id = s.id AND si.is_active = TRUE) AS items
         FROM subscriptions s
         LEFT JOIN customers c ON c.id = s.customer_id
         WHERE ${whereStr}
         ORDER BY s.created_at DESC LIMIT $${pi} OFFSET $${pi + 1}`,
        [...params, parseInt(limit), offset]
      ),
      readFromCRM(`SELECT COUNT(*) FROM subscriptions s LEFT JOIN customers c ON c.id = s.customer_id WHERE ${whereStr}`, params),
    ]);

    res.json({ success: true, data: rows.rows, total: parseInt(count.rows[0].count) });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/subscriptions/:id
// Full subscription detail with items, schedule, pauses
// ─────────────────────────────────────────────────────────────────────────────
const getSubscriptionById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [subRes, itemsRes, scheduleRes, pausesRes] = await Promise.all([
      readFromCRM(`
        SELECT s.*, c.name AS customer_name, c.phone AS customer_phone, c.customer_code,
               c.address, c.whatsapp_number, c.lat, c.lng,
               r.route_name
        FROM subscriptions s
        LEFT JOIN customers c ON c.id = s.customer_id
        LEFT JOIN routes r ON r.id::text = s.area OR LOWER(r.route_name) = LOWER(COALESCE(s.area,''))
        WHERE s.id = $1
      `, [id]),

      readFromCRM(`
        SELECT si.*, p.name AS product_name, p.unit, p.price_per_unit, p.category, p.packing_type
        FROM subscription_items si
        JOIN products p ON p.id = si.product_id
        WHERE si.subscription_id = $1 AND si.is_active = TRUE
        ORDER BY p.name
      `, [id]),

      readFromCRM(`SELECT * FROM subscription_schedules WHERE subscription_id = $1`, [id]),

      readFromCRM(`
        SELECT * FROM subscription_pauses WHERE subscription_id = $1
        ORDER BY COALESCE(pause_start_date, pause_date) DESC
      `, [id]),
    ]);

    if (subRes.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Subscription not found.' });

    const sub = subRes.rows[0];
    const schedule = scheduleRes.rows[0] || null;
    const pauses = pausesRes.rows;

    // Generate 30-day delivery preview
    const previewInput = {
      frequency_type: schedule?.frequency_type || sub.frequency_type || 'DAILY',
      start_date: sub.start_date,
      first_delivery_date: sub.first_delivery_date,
      end_date: sub.end_date,
      cancelled_date: sub.cancelled_date,
      alternate_anchor_date: schedule?.alternate_anchor_date,
      custom_weekdays: schedule?.custom_weekdays || [],
    };
    const preview = generateDeliveryPreview(previewInput, pauses, 30);

    res.json({
      success: true,
      data: {
        ...sub,
        items: itemsRes.rows,
        schedule,
        pauses,
        deliveryPreview: preview,
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/subscriptions
// Create subscription with multiple product items
// Body: { customer_id, frequency_type, start_date, first_delivery_date,
//         billing_cycle_start, hub, area, delivery_person_name, delivery_person_id,
//         customer_type, delivery_type, notes,
//         custom_weekdays: ['MONDAY','TUESDAY'...],
//         items: [{ product_id, quantity, rate_snapshot? }] }
// ─────────────────────────────────────────────────────────────────────────────
const createSubscription = async (req, res, next) => {
  try {
    const {
      customer_id, frequency_type = 'DAILY', start_date, first_delivery_date,
      billing_cycle_start, hub, area, delivery_person_name, delivery_person_id,
      customer_type = 'Regular', delivery_type = 'Home Delivery', notes,
      custom_weekdays, items,
      // Legacy single-product support
      product_id, quantity, frequency,
    } = req.body;

    if (!customer_id)
      return res.status(400).json({ success: false, message: 'Customer is required.' });

    const ft = frequency_type.toUpperCase();
    const validFrequencies = ['DAILY', 'ALTERNATE_DAY', 'CUSTOM_WEEKLY'];
    if (!validFrequencies.includes(ft))
      return res.status(400).json({ success: false, message: `Invalid frequency type. Must be one of: ${validFrequencies.join(', ')}.` });

    if (ft === 'CUSTOM_WEEKLY' && (!custom_weekdays || custom_weekdays.length === 0))
      return res.status(400).json({ success: false, message: 'Custom Weekly subscription requires at least one weekday.' });

    // Normalize items — support both multi-product items array and legacy single product
    let subscriptionItems = items;
    if (!subscriptionItems || subscriptionItems.length === 0) {
      if (product_id && quantity) {
        subscriptionItems = [{ product_id, quantity }];
      } else {
        return res.status(400).json({ success: false, message: 'At least one product with quantity is required.' });
      }
    }

    for (const item of subscriptionItems) {
      if (!item.product_id) return res.status(400).json({ success: false, message: 'Each item must have a product_id.' });
      if (!item.quantity || parseFloat(item.quantity) <= 0)
        return res.status(400).json({ success: false, message: 'Each item must have a quantity greater than zero.' });
    }

    const effectiveStartDate = start_date || new Date().toISOString().slice(0, 10);
    const firstDelivery = first_delivery_date || effectiveStartDate;
    const billingStart = billing_cycle_start || effectiveStartDate;

    // Legacy frequency column (keep for backwards compatibility)
    const legacyFrequency = ft === 'DAILY' ? 'Daily' : ft === 'ALTERNATE_DAY' ? 'Alternate Day' : 'Weekly';

    // Compute total quantity and primary product for subscriptions table columns
    const totalQuantity = subscriptionItems.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0) || parseFloat(quantity || 1);
    const primaryProductId = subscriptionItems[0]?.product_id || product_id || null;

    // Create subscription header
    const subResult = await writeToCRM(
      `INSERT INTO subscriptions
        (customer_id, product_id, quantity, frequency_type, frequency, start_date, first_delivery_date,
         billing_cycle_start, hub, area, delivery_person_name, delivery_person_id,
         customer_type, delivery_type, notes, status, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'Active',NOW()) RETURNING *`,
      [customer_id, primaryProductId, totalQuantity, ft, legacyFrequency, effectiveStartDate, firstDelivery,
       billingStart, hub || null, area || null, delivery_person_name || null,
       delivery_person_id || null, customer_type, delivery_type, notes || null]
    );

    const sub = subResult.rows[0];

    // Get product rates for snapshot
    const productIds = subscriptionItems.map(i => i.product_id);
    const productsRes = await readFromCRM(
      `SELECT id, price_per_unit FROM products WHERE id = ANY($1::uuid[])`,
      [productIds]
    );
    const priceMap = {};
    for (const p of productsRes.rows) priceMap[p.id] = parseFloat(p.price_per_unit);

    // Insert subscription items
    for (const item of subscriptionItems) {
      const rateSnapshot = item.rate_snapshot || priceMap[item.product_id] || 0;
      await writeToCRM(
        `INSERT INTO subscription_items
          (subscription_id, product_id, quantity, rate_snapshot, effective_from, is_active)
         VALUES ($1,$2,$3,$4,$5,TRUE)`,
        [sub.id, item.product_id, parseFloat(item.quantity), rateSnapshot, effectiveStartDate]
      );
    }

    // Insert schedule record for ALTERNATE_DAY or CUSTOM_WEEKLY
    if (ft !== 'DAILY') {
      await writeToCRM(
        `INSERT INTO subscription_schedules
          (subscription_id, frequency_type, alternate_anchor_date, custom_weekdays)
         VALUES ($1,$2,$3,$4)`,
        [sub.id, ft,
         ft === 'ALTERNATE_DAY' ? firstDelivery : null,
         ft === 'CUSTOM_WEEKLY' ? custom_weekdays : null]
      );
    }

    res.status(201).json({ success: true, data: sub, message: 'Subscription created successfully.' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/subscriptions/:id
// Update subscription header + items (replaces items)
// ─────────────────────────────────────────────────────────────────────────────
const updateSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      frequency_type, start_date, first_delivery_date, billing_cycle_start,
      end_date, hub, area, delivery_person_name, delivery_person_id,
      customer_type, delivery_type, notes, custom_weekdays,
      items,
      // Legacy
      quantity, frequency,
    } = req.body;

    const ft = frequency_type ? frequency_type.toUpperCase() : undefined;

    // Update subscription header
    const setClauses = [];
    const updateParams = [];
    let pi = 1;

    if (ft)                    { setClauses.push(`frequency_type=$${pi++}`); updateParams.push(ft); }
    if (start_date)            { setClauses.push(`start_date=$${pi++}`);     updateParams.push(start_date); }
    if (first_delivery_date)   { setClauses.push(`first_delivery_date=$${pi++}`); updateParams.push(first_delivery_date); }
    if (billing_cycle_start)   { setClauses.push(`billing_cycle_start=$${pi++}`); updateParams.push(billing_cycle_start); }
    if (end_date !== undefined) { setClauses.push(`end_date=$${pi++}`);      updateParams.push(end_date || null); }
    if (hub !== undefined)     { setClauses.push(`hub=$${pi++}`);            updateParams.push(hub || null); }
    if (area !== undefined)    { setClauses.push(`area=$${pi++}`);           updateParams.push(area || null); }
    if (delivery_person_name !== undefined) { setClauses.push(`delivery_person_name=$${pi++}`); updateParams.push(delivery_person_name || null); }
    if (delivery_person_id !== undefined)   { setClauses.push(`delivery_person_id=$${pi++}`);   updateParams.push(delivery_person_id || null); }
    if (customer_type)         { setClauses.push(`customer_type=$${pi++}`);  updateParams.push(customer_type); }
    if (delivery_type)         { setClauses.push(`delivery_type=$${pi++}`);  updateParams.push(delivery_type); }
    if (notes !== undefined)   { setClauses.push(`notes=$${pi++}`);          updateParams.push(notes || null); }
    if (quantity)              { setClauses.push(`quantity=$${pi++}`);       updateParams.push(quantity); } // legacy
    if (frequency)             { setClauses.push(`frequency=$${pi++}`);      updateParams.push(frequency); } // legacy

    setClauses.push(`updated_at=NOW()`);

    if (setClauses.length > 1) {
      updateParams.push(id);
      await writeToCRM(`UPDATE subscriptions SET ${setClauses.join(',')} WHERE id=$${pi}`, updateParams);
    }

    // Update items if provided
    if (items && items.length > 0) {
      // Soft-deactivate existing items
      await writeToCRM(`UPDATE subscription_items SET is_active=FALSE, effective_to=CURRENT_DATE WHERE subscription_id=$1 AND is_active=TRUE`, [id]);

      // Get sub start date for effective_from
      const subRes = await readFromCRM('SELECT start_date, first_delivery_date FROM subscriptions WHERE id=$1', [id]);
      const effectiveFrom = subRes.rows[0]?.first_delivery_date || subRes.rows[0]?.start_date || new Date().toISOString().slice(0, 10);

      const productIds = items.map(i => i.product_id);
      const productsRes = await readFromCRM(`SELECT id, price_per_unit FROM products WHERE id = ANY($1::uuid[])`, [productIds]);
      const priceMap = {};
      for (const p of productsRes.rows) priceMap[p.id] = parseFloat(p.price_per_unit);

      for (const item of items) {
        if (!item.product_id || !item.quantity || parseFloat(item.quantity) <= 0) continue;
        const rateSnapshot = item.rate_snapshot || priceMap[item.product_id] || 0;
        await writeToCRM(
          `INSERT INTO subscription_items (subscription_id, product_id, quantity, rate_snapshot, effective_from, is_active)
           VALUES ($1,$2,$3,$4,$5,TRUE)`,
          [id, item.product_id, parseFloat(item.quantity), rateSnapshot, effectiveFrom]
        );
      }

      // Keep subscriptions table quantity and product_id in sync
      const validItems = items.filter(i => i.product_id && parseFloat(i.quantity) > 0);
      if (validItems.length > 0) {
        const totalQty = validItems.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);
        await writeToCRM('UPDATE subscriptions SET quantity=$1, product_id=$2 WHERE id=$3', [totalQty, validItems[0].product_id, id]);
      }
    }

    // Update schedule if frequency/weekdays changed
    if (ft && ft !== 'DAILY') {
      const anchorDate = first_delivery_date || start_date;
      const existingSch = await readFromCRM('SELECT id FROM subscription_schedules WHERE subscription_id=$1', [id]);
      if (existingSch.rows.length > 0) {
        await writeToCRM(
          `UPDATE subscription_schedules SET frequency_type=$1, alternate_anchor_date=$2, custom_weekdays=$3, updated_at=NOW() WHERE subscription_id=$4`,
          [ft, ft === 'ALTERNATE_DAY' ? anchorDate : null, ft === 'CUSTOM_WEEKLY' ? custom_weekdays : null, id]
        );
      } else {
        await writeToCRM(
          `INSERT INTO subscription_schedules (subscription_id, frequency_type, alternate_anchor_date, custom_weekdays) VALUES ($1,$2,$3,$4)`,
          [id, ft, ft === 'ALTERNATE_DAY' ? anchorDate : null, ft === 'CUSTOM_WEEKLY' ? custom_weekdays : null]
        );
      }
    } else if (ft === 'DAILY') {
      // Remove schedule record if switching to daily
      await writeToCRM('DELETE FROM subscription_schedules WHERE subscription_id=$1', [id]).catch(() => {});
    }

    res.json({ success: true, message: 'Subscription updated.' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/subscriptions/:id/status
// ─────────────────────────────────────────────────────────────────────────────
const updateSubscriptionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['Active', 'Paused', 'Cancelled'].includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status. Must be Active, Paused, or Cancelled.' });

    const updates = { status };
    if (status === 'Cancelled') updates.cancelled_date = new Date().toISOString().slice(0, 10);

    const setClauses = Object.keys(updates).map((k, i) => `${k}=$${i + 1}`);
    const vals = [...Object.values(updates), id];
    await writeToCRM(`UPDATE subscriptions SET ${setClauses.join(',')}, updated_at=NOW() WHERE id=$${vals.length}`, vals);

    res.json({ success: true, message: `Subscription ${status.toLowerCase()}.` });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/subscriptions/:id/pause
// Create a pause/suspension for a date range
// Body: { pause_start_date, pause_end_date, reason }
// ─────────────────────────────────────────────────────────────────────────────
const createPause = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { pause_start_date, pause_end_date, reason } = req.body;

    if (!pause_start_date)
      return res.status(400).json({ success: false, message: 'Pause start date is required.' });

    const endDate = pause_end_date || pause_start_date; // single day if no end date

    if (pause_end_date && pause_end_date < pause_start_date)
      return res.status(400).json({ success: false, message: 'Pause end date cannot be before start date.' });

    // Check subscription exists and is Active
    const subCheck = await readFromCRM('SELECT id, status, customer_id FROM subscriptions WHERE id=$1', [id]);
    if (subCheck.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Subscription not found.' });
    if (subCheck.rows[0].status === 'Cancelled')
      return res.status(400).json({ success: false, message: 'Cannot pause a cancelled subscription.' });

    const result = await writeToCRM(
      `INSERT INTO subscription_pauses
        (subscription_id, customer_id, pause_start_date, pause_end_date,
         pause_date, resume_date, reason, status, is_active, pause_type, created_by)
       VALUES ($1,$2,$3,$4,$3,$4,$5,'Active',TRUE,'Vacation',$6) RETURNING *`,
      [id, subCheck.rows[0].customer_id, pause_start_date, endDate,
       reason || '', req.admin?.name || 'Super Admin']
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: `Subscription paused from ${pause_start_date} to ${endDate}.`,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/subscriptions/:id/pauses
// ─────────────────────────────────────────────────────────────────────────────
const getPauses = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await readFromCRM(
      `SELECT * FROM subscription_pauses WHERE subscription_id=$1
       ORDER BY COALESCE(pause_start_date, pause_date) DESC`,
      [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/subscriptions/:id/pause/:pauseId
// Remove/cancel a pause
// ─────────────────────────────────────────────────────────────────────────────
const deletePause = async (req, res, next) => {
  try {
    const { id, pauseId } = req.params;
    await writeToCRM(
      `UPDATE subscription_pauses SET is_active=FALSE, status='Cancelled', updated_at=NOW()
       WHERE id=$1 AND subscription_id=$2`,
      [pauseId, id]
    );
    res.json({ success: true, message: 'Pause cancelled.' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/subscriptions/:id/delivery-preview
// Returns 30-day delivery preview
// ─────────────────────────────────────────────────────────────────────────────
const getDeliveryPreview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const days = parseInt(req.query.days) || 30;

    const [subRes, scheduleRes, pausesRes] = await Promise.all([
      readFromCRM('SELECT * FROM subscriptions WHERE id=$1', [id]),
      readFromCRM('SELECT * FROM subscription_schedules WHERE subscription_id=$1', [id]),
      readFromCRM('SELECT * FROM subscription_pauses WHERE subscription_id=$1 AND is_active IS DISTINCT FROM FALSE', [id]),
    ]);

    if (subRes.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Subscription not found.' });

    const sub = subRes.rows[0];
    const schedule = scheduleRes.rows[0] || null;
    const pauses = pausesRes.rows;

    const previewInput = {
      frequency_type: schedule?.frequency_type || sub.frequency_type || 'DAILY',
      start_date: sub.start_date,
      first_delivery_date: sub.first_delivery_date,
      end_date: sub.end_date,
      cancelled_date: sub.cancelled_date,
      alternate_anchor_date: schedule?.alternate_anchor_date,
      custom_weekdays: schedule?.custom_weekdays || [],
    };

    const preview = generateDeliveryPreview(previewInput, pauses, Math.min(days, 90));
    res.json({ success: true, data: preview });
  } catch (err) { next(err); }
};

module.exports = {
  getSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  updateSubscriptionStatus,
  getDailyDeliveries,
  createPause,
  getPauses,
  deletePause,
  getDeliveryPreview,
};


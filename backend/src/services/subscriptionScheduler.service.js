const { readFromCRM } = require('../config/database');

// ──────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION SCHEDULING SERVICE
// Central source of truth for delivery determination.
// DO NOT duplicate this logic in React frontend or other controllers.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Determine if a given date is a scheduled delivery day for a subscription.
 *
 * @param {string} frequencyType - 'DAILY' | 'ALTERNATE_DAY' | 'CUSTOM_WEEKLY'
 * @param {string} dateStr - ISO date string 'YYYY-MM-DD'
 * @param {string|null} anchorDate - First delivery date (anchor for ALTERNATE_DAY)
 * @param {string[]} customWeekdays - e.g. ['MONDAY','WEDNESDAY','FRIDAY'] for CUSTOM_WEEKLY
 * @returns {boolean}
 */
function isDeliveryApplicable(frequencyType, dateStr, anchorDate, customWeekdays) {
  const ft = (frequencyType || 'DAILY').toUpperCase();

  if (ft === 'DAILY') {
    return true;
  }

  if (ft === 'ALTERNATE_DAY') {
    if (!anchorDate) return true; // fallback to daily if no anchor
    const anchor = new Date(`${anchorDate}T12:00:00Z`);
    const check  = new Date(`${dateStr}T12:00:00Z`);
    const diffMs = check.getTime() - anchor.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    // Delivery on anchor day and every 2 days after
    return diffDays >= 0 && diffDays % 2 === 0;
  }

  if (ft === 'CUSTOM_WEEKLY') {
    if (!customWeekdays || customWeekdays.length === 0) return false;
    const check = new Date(`${dateStr}T12:00:00Z`);
    const dayNames = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
    const dayOfWeek = dayNames[check.getDay()];
    return customWeekdays.map(d => d.toUpperCase()).includes(dayOfWeek);
  }

  return false;
}

/**
 * Check if a subscription is paused on a specific date.
 *
 * @param {Array} pauses - Array of pause records from subscription_pauses
 * @param {string} dateStr - ISO date string 'YYYY-MM-DD'
 * @returns {{ paused: boolean, pause: object|null }}
 */
function isPausedOnDate(pauses, dateStr) {
  if (!pauses || pauses.length === 0) return { paused: false, pause: null };

  const checkDate = dateStr;
  for (const p of pauses) {
    if (p.is_active === false) continue;
    const start = p.pause_start_date || p.pause_date;
    const end   = p.pause_end_date   || p.resume_date || p.pause_date;
    if (!start) continue;
    // Date comparison: YYYY-MM-DD strings compare lexicographically correctly
    if (checkDate >= start && checkDate <= end) {
      return { paused: true, pause: p };
    }
  }
  return { paused: false, pause: null };
}

/**
 * Get all active subscriptions applicable for a given date.
 * Returns full customer + product details for delivery planning.
 *
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {Promise<Array>}
 */
async function getDeliveriesForDate(dateStr) {
  // Fetch all active subscriptions with customer, items, schedules, pauses
  const [subsRes, itemsRes, schedulesRes, pausesRes] = await Promise.all([
    readFromCRM(`
      SELECT
        s.id AS subscription_id,
        s.customer_id,
        s.frequency_type,
        s.frequency,
        s.start_date,
        s.first_delivery_date,
        s.end_date,
        s.cancelled_date,
        s.status,
        s.hub,
        s.area,
        s.delivery_person_name,
        s.delivery_person_id,
        s.customer_type,
        s.delivery_type,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.customer_code,
        c.address,
        c.whatsapp_number
      FROM subscriptions s
      JOIN customers c ON c.id = s.customer_id
      WHERE s.status = 'Active'
        AND s.start_date <= $1
        AND (s.end_date IS NULL OR s.end_date >= $1)
        AND (s.cancelled_date IS NULL OR s.cancelled_date > $1)
        AND c.status = 'Active'
    `, [dateStr]),

    readFromCRM(`
      SELECT
        si.subscription_id,
        si.id AS item_id,
        si.product_id,
        si.quantity,
        si.rate_snapshot,
        p.name AS product_name,
        p.unit,
        p.price_per_unit,
        p.category
      FROM subscription_items si
      JOIN products p ON p.id = si.product_id
      WHERE si.is_active = TRUE
        AND p.status IN ('Active')
        AND (si.effective_to IS NULL OR si.effective_to >= $1)
    `, [dateStr]),

    readFromCRM(`
      SELECT subscription_id, frequency_type, alternate_anchor_date, custom_weekdays
      FROM subscription_schedules
    `),

    readFromCRM(`
      SELECT subscription_id, pause_start_date, pause_end_date, pause_date, resume_date, reason, is_active
      FROM subscription_pauses
      WHERE is_active IS DISTINCT FROM FALSE
    `),
  ]);

  const subs      = subsRes.rows;
  const allItems  = itemsRes.rows;
  const schedules = schedulesRes.rows;
  const pauses    = pausesRes.rows;

  // Build lookup maps
  const itemsBySubId     = {};
  const scheduleBySubId  = {};
  const pausesBySubId    = {};

  for (const item of allItems) {
    if (!itemsBySubId[item.subscription_id]) itemsBySubId[item.subscription_id] = [];
    itemsBySubId[item.subscription_id].push(item);
  }
  for (const sch of schedules) {
    scheduleBySubId[sch.subscription_id] = sch;
  }
  for (const p of pauses) {
    if (!pausesBySubId[p.subscription_id]) pausesBySubId[p.subscription_id] = [];
    pausesBySubId[p.subscription_id].push(p);
  }

  const results = [];

  for (const sub of subs) {
    const subPauses = pausesBySubId[sub.subscription_id] || [];
    const schedule  = scheduleBySubId[sub.subscription_id];
    const items     = itemsBySubId[sub.subscription_id] || [];

    // Determine effective frequency type
    const freqType = (schedule?.frequency_type || sub.frequency_type || 'DAILY').toUpperCase();
    const anchor   = schedule?.alternate_anchor_date || sub.first_delivery_date || sub.start_date;
    const weekdays = schedule?.custom_weekdays || [];

    // Priority: CANCELLED/INACTIVE → skip
    // (Already filtered via SQL WHERE s.status = 'Active')

    // Check pause
    const { paused, pause } = isPausedOnDate(subPauses, dateStr);
    if (paused) continue;

    // Check delivery schedule applicability
    const applicable = isDeliveryApplicable(freqType, dateStr, anchor, weekdays);
    if (!applicable) continue;

    // Skip if no items configured (legacy subscriptions with product_id directly)
    // For legacy support, synthesize an item from the subscription itself if items is empty
    let deliveryItems = items;
    if (deliveryItems.length === 0 && sub.product_id) {
      // Legacy single-product subscription
      deliveryItems = [{
        subscription_id: sub.subscription_id,
        product_id: sub.product_id,
        quantity: sub.quantity || 1,
        rate_snapshot: null,
        product_name: sub.product_name || 'Unknown',
        unit: sub.unit || '',
        price_per_unit: sub.price_per_unit || 0,
        category: sub.category || '',
      }];
    }
    if (deliveryItems.length === 0) continue;

    results.push({
      subscriptionId: sub.subscription_id,
      customerId: sub.customer_id,
      customerName: sub.customer_name,
      customerCode: sub.customer_code,
      customerPhone: sub.customer_phone,
      customerWhatsapp: sub.whatsapp_number,
      address: sub.address,
      hub: sub.hub,
      area: sub.area,
      deliveryPersonName: sub.delivery_person_name,
      deliveryPersonId: sub.delivery_person_id,
      customerType: sub.customer_type,
      deliveryType: sub.delivery_type,
      frequency: freqType,
      startDate: sub.start_date,
      firstDeliveryDate: sub.first_delivery_date,
      deliveryDate: dateStr,
      products: deliveryItems.map(item => ({
        itemId: item.item_id,
        productId: item.product_id,
        productName: item.product_name,
        quantity: parseFloat(item.quantity),
        unit: item.unit,
        unitRate: parseFloat(item.rate_snapshot || item.price_per_unit || 0),
        category: item.category,
        dailyValue: parseFloat(item.quantity) * parseFloat(item.rate_snapshot || item.price_per_unit || 0),
      })),
    });
  }

  return results;
}

/**
 * Generate a delivery preview for the next N days for a specific subscription.
 *
 * @param {object} sub - Subscription row with schedule info
 * @param {Array} pauses - Pause records for this subscription
 * @param {number} days - Number of days to preview (default 30)
 * @returns {Array} - Array of { date, status: 'Delivery'|'Paused'|'No Delivery'|'Not Started'|'Ended' }
 */
function generateDeliveryPreview(sub, pauses, days = 30) {
  const preview = [];
  const today = new Date();

  const freqType = (sub.frequency_type || 'DAILY').toUpperCase();
  const anchor   = sub.alternate_anchor_date || sub.first_delivery_date || sub.start_date;
  const weekdays = sub.custom_weekdays || [];

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);

    // Not started yet
    if (sub.start_date && dateStr < sub.start_date) {
      preview.push({ date: dateStr, status: 'Not Started', label: 'Before start date' });
      continue;
    }

    // Ended / cancelled
    if ((sub.end_date && dateStr > sub.end_date) || (sub.cancelled_date && dateStr >= sub.cancelled_date)) {
      preview.push({ date: dateStr, status: 'Ended', label: 'Subscription ended' });
      continue;
    }

    // Paused?
    const { paused, pause } = isPausedOnDate(pauses, dateStr);
    if (paused) {
      preview.push({ date: dateStr, status: 'Paused', label: `Paused: ${pause.reason || 'Pause'}` });
      continue;
    }

    // Frequency check
    if (isDeliveryApplicable(freqType, dateStr, anchor, weekdays)) {
      preview.push({ date: dateStr, status: 'Delivery', label: 'Delivery' });
    } else {
      preview.push({ date: dateStr, status: 'No Delivery', label: 'No delivery (schedule)' });
    }
  }

  return preview;
}

module.exports = { isDeliveryApplicable, isPausedOnDate, getDeliveriesForDate, generateDeliveryPreview };


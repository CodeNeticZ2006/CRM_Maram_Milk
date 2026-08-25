const { writeToCRM, readFromCRM, readFromApp, writeToApp } = require('../config/database');
const { randomUUID } = require('crypto');

/**
 * Safely normalize any date input (string, Date object, ISO timestamp) into 'YYYY-MM-DD' string
 */
const normalizeDateStr = (val) => {
  if (!val) return getISTDateStr();
  if (typeof val === 'string') {
    if (val.includes('T')) return val.split('T')[0];
    return val.trim();
  }
  if (val instanceof Date) {
    return val.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  }
  return String(val);
};

/**
 * Format 'YYYY-MM-DD' into business display date 'DD-MMM-YYYY' (e.g. '26-Aug-2026')
 */
const formatDateForDisplay = (dateStr) => {
  if (!dateStr) return '';
  const clean = normalizeDateStr(dateStr);
  const parts = clean.split('-');
  if (parts.length !== 3) return clean;
  const [y, m, d] = parts;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[parseInt(m, 10) - 1] || 'Aug';
  return `${parseInt(d, 10)}-${monthName}-${y}`;
};

/**
 * Get current date string formatted in IST (Asia/Kolkata) => YYYY-MM-DD
 */
const getISTDateStr = (dateObj = new Date()) => {
  return new Date(dateObj).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

/**
 * Get current time details in IST (Asia/Kolkata)
 */
const getISTDetails = (dateObj = new Date()) => {
  const options = { timeZone: 'Asia/Kolkata', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' };
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(dateObj);
  const map = {};
  parts.forEach(p => { map[p.type] = p.value; });

  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const hours = parseInt(map.hour, 10);
  const minutes = parseInt(map.minute, 10);
  const seconds = parseInt(map.second, 10);

  return { dateStr, hours, minutes, seconds, fullISTString: `${dateStr} ${map.hour}:${map.minute}:${map.second}` };
};

/**
 * Calculate expected operational date based on 7:00 PM IST (19:00) boundary.
 * - Before 7:00 PM IST (00:00 - 18:59): Current calendar day (e.g. 2026-08-25)
 * - On or After 7:00 PM IST (19:00 - 23:59): Next calendar day (e.g. 2026-08-26)
 */
const getExpectedOperationalDate = (dateObj = new Date()) => {
  const { dateStr, hours } = getISTDetails(dateObj);
  if (hours >= 19) {
    // 7:00 PM or later => Next day is active operational day
    const nextDate = new Date(dateObj);
    nextDate.setDate(nextDate.getDate() + 1);
    return getISTDateStr(nextDate);
  }
  return dateStr;
};

/**
 * Get next calendar date string (YYYY-MM-DD)
 */
const getNextDateStr = (dateStr) => {
  const clean = normalizeDateStr(dateStr);
  const d = new Date(`${clean}T12:00:00+05:30`);
  d.setDate(d.getDate() + 1);
  return getISTDateStr(d);
};

// Rollover lock to prevent race conditions in-memory per node process
let isRollingOver = false;

/**
 * Check and trigger operational day rollover if needed
 */
const checkAndTriggerRollover = async () => {
  if (isRollingOver) return { status: 'IN_PROGRESS' };

  try {
    const expectedDate = getExpectedOperationalDate();

    // Fetch current active operational day from DB1
    let activeDay = null;
    try {
      const res = await readFromCRM(
        `SELECT * FROM operational_days WHERE status = 'ACTIVE' ORDER BY date DESC LIMIT 1`
      );
      if (res.rows.length > 0) activeDay = res.rows[0];
    } catch (e) {
      // Table might not exist yet or DB unreachable
      return { status: 'DB_UNAVAILABLE', error: e.message };
    }

    if (!activeDay) {
      // Initializing first active operational day
      const newId = randomUUID();
      try {
        await writeToCRM(
          `INSERT INTO operational_days (id, date, status, opened_at)
           VALUES ($1, $2, 'ACTIVE', NOW())
           ON CONFLICT (date) DO UPDATE SET status = 'ACTIVE'`,
          [newId, expectedDate]
        );
        console.log(`✅ Initialized active operational day: ${expectedDate} (${formatDateForDisplay(expectedDate)})`);
        const freshRes = await readFromCRM(`SELECT * FROM operational_days WHERE date = $1`, [expectedDate]);
        return { status: 'INITIALIZED', currentDay: freshRes.rows[0] };
      } catch (e) {
        console.warn('⚠️ Operational day init warning:', e.message);
        return { status: 'INIT_FAILED', error: e.message };
      }
    }

    const activeDateStr = normalizeDateStr(activeDay.date);

    // Check if rollover is required:
    // If activeDateStr is less than expectedDate (e.g. active is 2026-08-25 and expected is 2026-08-26 after 7 PM)
    if (activeDateStr < expectedDate) {
      return await executeDailyRollover(activeDateStr, expectedDate);
    }

    return { status: 'UP_TO_DATE', currentDay: activeDay };
  } catch (err) {
    console.error('⚠️ checkAndTriggerRollover error:', err.message);
    return { status: 'ERROR', error: err.message };
  }
};

/**
 * Execute central daily operational rollover (Idempotent DB Transaction)
 */
const executeDailyRollover = async (currentOpDateInput, targetNextDateInput) => {
  if (isRollingOver) return { status: 'IN_PROGRESS' };
  isRollingOver = true;

  const currentOpDate = normalizeDateStr(currentOpDateInput);
  const nextDateStr = targetNextDateInput ? normalizeDateStr(targetNextDateInput) : getNextDateStr(currentOpDate);

  console.log(`🔄 [OPERATIONAL ROLLOVER] Starting 7:00 PM IST rollover from ${currentOpDate} (${formatDateForDisplay(currentOpDate)}) to ${nextDateStr} (${formatDateForDisplay(nextDateStr)})...`);

  try {
    // 1. Verify active day status in DB
    const checkRes = await readFromCRM(`SELECT * FROM operational_days WHERE date = $1 AND status = 'ACTIVE'`, [currentOpDate]);
    if (checkRes.rows.length === 0) {
      // Current day already closed by another process or manually
      console.log(`ℹ️ Operational day ${currentOpDate} is already CLOSED.`);
      const newActive = await readFromCRM(`SELECT * FROM operational_days WHERE status = 'ACTIVE' ORDER BY date DESC LIMIT 1`);
      isRollingOver = false;
      return { status: 'ALREADY_CLOSED', currentDay: newActive.rows[0] || null };
    }

    const activeRecord = checkRes.rows[0];

    // 2. Close current day in operational_days
    await writeToCRM(
      `UPDATE operational_days
       SET status = 'CLOSED', closed_at = NOW(), rollover_time = NOW()
       WHERE id = $1`,
      [activeRecord.id]
    );

    // 3. Create next operational day in operational_days
    const newDayId = randomUUID();
    await writeToCRM(
      `INSERT INTO operational_days (id, date, status, opened_at)
       VALUES ($1, $2, 'ACTIVE', NOW())
       ON CONFLICT (date) DO UPDATE SET status = 'ACTIVE'`,
      [newDayId, nextDateStr]
    );

    // 4. INVENTORY ROLLOVER (DB2 & DB1)
    try {
      // 4a. Fetch all InventoryItems from DB2
      let items = [];
      const itemsRes = await readFromApp('SELECT id, name, unit, material FROM "InventoryItem" ORDER BY name ASC');
      items = itemsRes.rows || [];

      // 4b. Fetch daily records for current closing day from DB2
      const currRecsRes = await readFromApp(
        'SELECT "inventoryItemId", "currentStock", "carriedOverStock", "newStockAdded" FROM "InventoryDailyRecord" WHERE date = $1',
        [currentOpDate]
      );
      const currRecs = currRecsRes.rows || [];

      // 4c. Carry forward remaining stock for each item into next operational day
      for (const item of items) {
        const cRec = currRecs.find(r => r.inventoryItemId === item.id);

        let closingStock = 0;
        if (cRec) {
          closingStock = parseFloat(cRec.currentStock || 0);
          if (closingStock === 0 && parseFloat(cRec.newStockAdded || 0) === 0 && parseFloat(cRec.carriedOverStock || 0) > 0) {
            closingStock = parseFloat(cRec.carriedOverStock);
          }
        } else {
          // Fallback to preceding date stock if no record for currentOpDate
          const prevRes = await readFromApp(
            'SELECT "currentStock" FROM "InventoryDailyRecord" WHERE "inventoryItemId" = $1 AND date <= $2 ORDER BY date DESC LIMIT 1',
            [item.id, currentOpDate]
          );
          if (prevRes.rows.length > 0) {
            closingStock = parseFloat(prevRes.rows[0].currentStock || 0);
          }
        }

        // Insert or Update next day's DB2 InventoryDailyRecord
        const existNextRes = await readFromApp(
          'SELECT id FROM "InventoryDailyRecord" WHERE "inventoryItemId" = $1 AND date = $2',
          [item.id, nextDateStr]
        );

        if (existNextRes.rows.length > 0) {
          await writeToApp(
            `UPDATE "InventoryDailyRecord"
             SET "carriedOverStock" = $1, "currentStock" = $1, "expectedStock" = $1, "newStockAdded" = 0, "updatedAt" = NOW()
             WHERE id = $2`,
            [closingStock, existNextRes.rows[0].id]
          );
        } else {
          const recId = randomUUID();
          await writeToApp(
            `INSERT INTO "InventoryDailyRecord"
               (id, date, "inventoryItemId", "currentStock", "carriedOverStock", "newStockAdded", "expectedStock", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $4, 0, $4, NOW(), NOW())`,
            [recId, nextDateStr, item.id, closingStock]
          );
        }
      }

      // 4d. Synchronize DB1 milk_inventory for next operational day
      const milkCurrRes = await readFromCRM('SELECT * FROM milk_inventory WHERE date = $1', [currentOpDate]);
      const milkCurr = milkCurrRes.rows[0];
      const prevClosing = milkCurr ? parseFloat(milkCurr.closing_stock || milkCurr.remaining_stock || 0) : 0;

      await writeToCRM(
        `INSERT INTO milk_inventory (id, date, opening_stock, milk_received, today_dispatch, remaining_stock, closing_stock, updated_at)
         VALUES ($1, $2, $3, 0, 0, $3, $3, NOW())
         ON CONFLICT (date) DO UPDATE SET opening_stock = $3, remaining_stock = $3, closing_stock = $3, milk_received = 0, today_dispatch = 0, updated_at = NOW()`,
        [randomUUID(), nextDateStr, prevClosing]
      );

      console.log(`✅ [INVENTORY ROLLOVER] Inventory stock carried forward from ${currentOpDate} to ${nextDateStr}.`);
    } catch (invErr) {
      console.warn('⚠️ Inventory rollover sub-step warning:', invErr.message);
    }

    // 5. LOG ROLLOVER EVENT IN AUDIT LOGS
    try {
      await writeToCRM(
        `INSERT INTO audit_logs (id, user_type, action, entity, detail_json, timestamp)
         VALUES ($1, 'SYSTEM', 'DAILY_OPERATIONAL_ROLLOVER', 'OPERATIONAL_DAY', $2, NOW())`,
        [randomUUID(), JSON.stringify({ closedDay: currentOpDate, openedDay: nextDateStr, rolloverTime: new Date().toISOString() })]
      );
    } catch (e) { /* silent */ }

    console.log(`🎉 [OPERATIONAL ROLLOVER COMPLETE] Day ${currentOpDate} CLOSED → Day ${nextDateStr} (${formatDateForDisplay(nextDateStr)}) ACTIVE!`);

    const freshActiveRes = await readFromCRM(`SELECT * FROM operational_days WHERE date = $1`, [nextDateStr]);
    isRollingOver = false;

    return {
      status: 'SUCCESS',
      closedDay: currentOpDate,
      openedDay: nextDateStr,
      displayDate: formatDateForDisplay(nextDateStr),
      currentDay: freshActiveRes.rows[0],
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    isRollingOver = false;
    console.error('❌ [OPERATIONAL ROLLOVER ERROR]:', err.message);
    return { status: 'ERROR', error: err.message };
  }
};

/**
 * Get current active operational day details
 */
const getCurrentOperationalDay = async () => {
  // Ensure current operational day is up to date
  const rolloverCheck = await checkAndTriggerRollover();
  
  let activeDay = null;
  try {
    const res = await readFromCRM(`SELECT * FROM operational_days WHERE status = 'ACTIVE' ORDER BY date DESC LIMIT 1`);
    if (res.rows.length > 0) activeDay = res.rows[0];
  } catch (e) { /* silent */ }

  const fallbackDate = getExpectedOperationalDate();
  const { fullISTString } = getISTDetails();

  const currentOpDate = normalizeDateStr(activeDay ? activeDay.date : fallbackDate);
  const formattedOpDate = formatDateForDisplay(currentOpDate); // e.g. "26-Aug-2026"

  const nextRolloverDateStr = currentOpDate; // 7:00 PM IST on currentOpDate calendar day
  const nextRolloverIST = `${nextRolloverDateStr} 19:00:00 IST`;

  return {
    date: currentOpDate,
    formattedDate: formattedOpDate,
    displayDate: formattedOpDate,
    status: activeDay ? activeDay.status : 'ACTIVE',
    openedAt: activeDay ? activeDay.opened_at : new Date().toISOString(),
    lastRollover: activeDay ? activeDay.closed_at || activeDay.opened_at : new Date().toISOString(),
    nextRolloverIST,
    currentISTTime: fullISTString,
    timezone: 'Asia/Kolkata',
    rolloverCheckStatus: rolloverCheck.status,
  };
};

/**
 * Get historical list of operational day rollovers
 */
const getOperationalDayHistory = async (limit = 30) => {
  try {
    const res = await readFromCRM(
      `SELECT * FROM operational_days ORDER BY date DESC LIMIT $1`,
      [limit]
    );
    return (res.rows || []).map(r => ({
      ...r,
      date: normalizeDateStr(r.date),
      displayDate: formatDateForDisplay(r.date),
    }));
  } catch (e) {
    return [];
  }
};

module.exports = {
  normalizeDateStr,
  formatDateForDisplay,
  getISTDateStr,
  getISTDetails,
  getExpectedOperationalDate,
  checkAndTriggerRollover,
  executeDailyRollover,
  getCurrentOperationalDay,
  getOperationalDayHistory,
};

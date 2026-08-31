const { readFromApp, readFromCRM, writeToCRM } = require('../config/database');
const { getExpectedOperationalDate } = require('../services/operationalDay.service');

// 1L Bottle InventoryItem ID: 04cca8e6-0c08-4245-bb9d-d1c562df30e9
// 500ml Bottle InventoryItem ID: ec1714a6-6653-4c62-8b27-5c4c4c71223a
const BOTTLE_1L_ID = '04cca8e6-0c08-4245-bb9d-d1c562df30e9';
const BOTTLE_500ML_ID = 'ec1714a6-6653-4c62-8b27-5c4c4c71223a';

// Helper: match an allocation/log row to a DP by id or dpCode
function matchDp(row, dp) {
  if (!row || !dp) return false;
  return String(row.dpId) === String(dp.id) || String(row.dpId) === String(dp.dpCode);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/empty-bottles
// Query params:
//   mode        = 'daily' | 'weekly' | 'monthly' | 'custom'  (default: 'daily')
//   date        = 'YYYY-MM-DD'  (daily mode  — defaults to active operational day)
//   weekStart   = 'YYYY-MM-DD'  (weekly mode — start of 7-day window)
//   month       = 'YYYY-MM'     (monthly mode)
//   startDate   = 'YYYY-MM-DD'  (custom mode)
//   endDate     = 'YYYY-MM-DD'  (custom mode)
//   dpId        = string        (optional DP filter)
// ─────────────────────────────────────────────────────────────────────────────
const getEmptyBottleLogs = async (req, res, next) => {
  try {
    const { mode = 'daily', dpId, weekStart, month, startDate, endDate } = req.query;

    // Active operational day — centralized 7:00 PM IST source of truth
    const opDay = getExpectedOperationalDate();

    // Resolve the requested date for daily mode.
    // If no date param, default to active operational day.
    const requestedDate = (req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date))
      ? req.query.date
      : opDay;

    // ── DB2 Data Fetch ────────────────────────────────────────────────────────
    const [dpRes, rRes, allocHeadersRes, allocItemsRes, logHeadersRes, logItemsRes] = await Promise.all([
      readFromApp('SELECT id, name, "dpCode", "mobileNumber", "vehicleNumber", zone, "isActive" FROM "DeliveryPerson" WHERE "isActive" = true AND LOWER(name) NOT IN (\'adam\', \'pradeep\', \'praddep\', \'test\', \'test dp\') AND "dpCode" NOT IN (\'DP018\', \'DP019\', \'DP020\') ORDER BY name ASC'),
      readFromApp('SELECT id, name, zone, "assignedDpId" FROM "Route" ORDER BY name ASC'),
      readFromApp('SELECT id, "routeId", "dpId", date, status FROM "RouteAllocation" ORDER BY "createdAt" DESC'),
      readFromApp(`
        SELECT rai.id, rai."routeAllocationId", rai."inventoryItemId", rai.quantity, ra."dpId", ra.date, ii.name as item_name, ii.material, ii.unit
        FROM "RouteAllocationItem" rai
        JOIN "RouteAllocation" ra ON rai."routeAllocationId" = ra.id
        JOIN "InventoryItem" ii ON rai."inventoryItemId" = ii.id
        ORDER BY ra."createdAt" DESC
      `),
      readFromApp('SELECT id, "routeId", "dpId", date, "deliveryCompleted", "flagIssue", notes, reason FROM "EmptyBottleLog" ORDER BY "createdAt" DESC'),
      readFromApp(`
        SELECT ebli.id, ebli."emptyBottleLogId", ebli."inventoryItemId", ebli."actualDelivered", ebli.expected, ebli.collected, ebli.broken, ebl."dpId", ebl.date, ii.name as item_name, ii.material, ii.unit
        FROM "EmptyBottleLogItem" ebli
        JOIN "EmptyBottleLog" ebl ON ebli."emptyBottleLogId" = ebl.id
        JOIN "InventoryItem" ii ON ebli."inventoryItemId" = ii.id
        ORDER BY ebl."createdAt" DESC
      `),
    ]);

    const dpRows = dpRes.rows || [];
    const routeRows = rRes.rows || [];
    const allocHeaders = allocHeadersRes.rows || [];
    const allocItems = allocItemsRes.rows || [];
    const logHeaders = logHeadersRes.rows || [];
    const logItems = logItemsRes.rows || [];

    // ── Fetch CRM Incidents ───────────────────────────────────────────────────
    let crmIncidents = [];
    try {
      const incRes = await readFromCRM('SELECT * FROM empty_bottle_incidents ORDER BY created_at DESC LIMIT 50');
      crmIncidents = incRes.rows || [];
    } catch (e) { /* silent */ }

    // DB2 system inception date — no records before this
    const DB2_START_DATE = '2026-07-15';

    // ── Build datesList based on mode ─────────────────────────────────────────
    let datesList = [];

    if (mode === 'daily') {
      // Single operational date
      datesList = [requestedDate];

    } else if (mode === 'weekly') {
      // 7-day window starting from weekStart (or 6 days before opDay if unset)
      const start = weekStart && /^\d{4}-\d{2}-\d{2}$/.test(weekStart)
        ? weekStart
        : (() => {
            const d = new Date(`${opDay}T12:00:00+05:30`);
            d.setDate(d.getDate() - 6);
            return d.toISOString().slice(0, 10);
          })();
      const curr = new Date(`${start}T12:00:00+05:30`);
      for (let i = 0; i < 7; i++) {
        const dStr = curr.toISOString().slice(0, 10);
        if (dStr <= opDay) datesList.push(dStr);
        curr.setDate(curr.getDate() + 1);
      }

    } else if (mode === 'monthly') {
      // All days in the requested month (or current operational month if unset)
      const opMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : opDay.slice(0, 7);
      const [y, m] = opMonth.split('-').map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dStr = `${String(y)}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        if (dStr <= opDay) datesList.push(dStr);
      }

    } else if (mode === 'custom') {
      // Explicit date range
      if (startDate && endDate) {
        const curr = new Date(`${startDate}T12:00:00+05:30`);
        const end  = new Date(`${endDate}T12:00:00+05:30`);
        while (curr <= end && datesList.length < 90) {
          const dStr = curr.toISOString().slice(0, 10);
          if (dStr <= opDay) datesList.push(dStr);
          curr.setDate(curr.getDate() + 1);
        }
      }
    }

    // ── Per-DP Aggregation (All 17 Real Delivery Persons) ─────────────────────
    const dpLogs = dpRows.map((dp) => {
      const periodDates = mode === 'daily' ? [requestedDate] : [...datesList].reverse();

      let dpAssignedRouteStr = 'Standby / Unassigned';

      // 1. Check RouteAllocation header for selected period dates
      let foundRouteId = null;
      for (const dStr of periodDates) {
        const alloc = allocHeaders.find(a => matchDp(a, dp) && String(a.date || '').slice(0, 10) === dStr);
        if (alloc?.routeId) { foundRouteId = alloc.routeId; break; }
      }

      // 2. Check EmptyBottleLog header for selected period dates if no alloc found
      if (!foundRouteId) {
        for (const dStr of periodDates) {
          const log = logHeaders.find(l => matchDp(l, dp) && String(l.date || '').slice(0, 10) === dStr);
          if (log?.routeId) { foundRouteId = log.routeId; break; }
        }
      }

      if (foundRouteId) {
        const routeName = routeRows.find(r => String(r.id) === String(foundRouteId))?.name;
        if (routeName) dpAssignedRouteStr = routeName;
      } else {
        // 3. Master permanent assignment
        const masterRoute = routeRows.find(r => String(r.assignedDpId) === String(dp.id));
        if (masterRoute?.name) dpAssignedRouteStr = masterRoute.name;
      }

      let totalIssued1L = 0, totalReturned1L = 0, totalMissing1L = 0;
      let totalIssuedHalfL = 0, totalReturnedHalfL = 0, totalMissingHalfL = 0;
      let flagCount = 0;

      const dateLogs = datesList.map((dStr) => {
        const isFuture    = dStr > opDay;
        const isBeforeDb2  = dStr < DB2_START_DATE;

        const allocHeader = allocHeaders.find(a => matchDp(a, dp) && String(a.date || '').slice(0, 10) === dStr);
        const logHeader   = logHeaders.find(l => matchDp(l, dp) && String(l.date || '').slice(0, 10) === dStr);

        const dayLogItems = logItems.filter(i => matchDp(i, dp) && String(i.date || '').slice(0, 10) === dStr);
        const dayAllocItems = allocItems.filter(i => matchDp(i, dp) && String(i.date || '').slice(0, 10) === dStr);

        let issued1L = 0, issuedHalfL = 0, returned1L = 0, returnedHalfL = 0;
        let missing1L = 0, missingHalfL = 0, hasFlag = false;

        const hasRecords = dayLogItems.length > 0 || dayAllocItems.length > 0 || !!allocHeader || !!logHeader;

        if (!isBeforeDb2 && !isFuture && hasRecords) {
          // 1L Bottle item matching
          const item1L = dayLogItems.find(i => i.inventoryItemId === BOTTLE_1L_ID || (i.material === 'Bottle' && i.unit === '1L'));
          const alloc1L = dayAllocItems.find(i => i.inventoryItemId === BOTTLE_1L_ID || (i.material === 'Bottle' && i.unit === '1L'));

          // 500ml Bottle item matching
          const itemHalfL = dayLogItems.find(i => i.inventoryItemId === BOTTLE_500ML_ID || (i.material === 'Bottle' && (i.unit === '500ml' || i.unit === '500 ml')));
          const allocHalfL = dayAllocItems.find(i => i.inventoryItemId === BOTTLE_500ML_ID || (i.material === 'Bottle' && (i.unit === '500ml' || i.unit === '500 ml')));

          issued1L = item1L
            ? (parseInt(item1L.actualDelivered, 10) || parseInt(item1L.expected, 10) || 0)
            : (alloc1L ? (parseInt(alloc1L.quantity, 10) || 0) : 0);

          returned1L = item1L ? (parseInt(item1L.collected, 10) || 0) : 0;
          missing1L = Math.max(0, issued1L - returned1L);

          issuedHalfL = itemHalfL
            ? (parseInt(itemHalfL.actualDelivered, 10) || parseInt(itemHalfL.expected, 10) || 0)
            : (allocHalfL ? (parseInt(allocHalfL.quantity, 10) || 0) : 0);

          returnedHalfL = itemHalfL ? (parseInt(itemHalfL.collected, 10) || 0) : 0;
          missingHalfL = Math.max(0, issuedHalfL - returnedHalfL);

          hasFlag = Boolean(logHeader?.flagIssue) || (missing1L + missingHalfL > 0);

          totalIssued1L      += issued1L;      totalReturned1L     += returned1L;
          totalMissing1L     += missing1L;     totalIssuedHalfL    += issuedHalfL;
          totalReturnedHalfL += returnedHalfL; totalMissingHalfL   += missingHalfL;
          if (hasFlag) flagCount++;
        }

        const dayIssued   = issued1L + issuedHalfL;
        const dayReturned = returned1L + returnedHalfL;

        let dayRouteName = dpAssignedRouteStr;
        const dayRouteId = allocHeader?.routeId || logHeader?.routeId;
        if (dayRouteId) {
          const r = routeRows.find(rt => String(rt.id) === String(dayRouteId));
          if (r?.name) dayRouteName = r.name;
        }

        return {
          date: dStr, isFuture, isBeforeDb2,
          issued1L, issuedHalfL, returned1L, returnedHalfL,
          missing1L, missingHalfL,
          dayIssued, dayReturned,
          returnRate: dayIssued > 0 ? Math.round((dayReturned / dayIssued) * 100) : (isBeforeDb2 || isFuture ? null : 0),
          hasFlag,
          notes: logHeader?.notes || (hasFlag ? `${missing1L + missingHalfL} bottles unreturned` : null),
          routeName: dayRouteName,
          hasRecords,
        };
      });

      const totalIssuedOverall   = totalIssued1L   + totalIssuedHalfL;
      const totalReturnedOverall = totalReturned1L + totalReturnedHalfL;

      return {
        id: dp.id,
        dpName: dp.name,
        dpCode: dp.dpCode,
        vehicleNumber: dp.vehicleNumber || 'Unassigned',
        routeName: dpAssignedRouteStr,
        zone: dp.zone || 'General Zone',
        issued1L: totalIssued1L,
        issuedHalfL: totalIssuedHalfL,
        returned1L: totalReturned1L,
        returnedHalfL: totalReturnedHalfL,
        missing1L: totalMissing1L,
        missingHalfL: totalMissingHalfL,
        totalIssued: totalIssuedOverall,
        totalReturned: totalReturnedOverall,
        returnRate: totalIssuedOverall > 0 ? Math.round((totalReturnedOverall / totalIssuedOverall) * 100) : 0,
        hasFlag: flagCount > 0,
        flagCount,
        dateLogs,
        source: 'DB2',
      };
    });

    // ── Filter by DP if requested ─────────────────────────────────────────────
    const filteredData = dpId
      ? dpLogs.filter(a => a.id === dpId || String(a.dpCode) === String(dpId) || (a?.dpName || '').toLowerCase().includes((dpId || '').toLowerCase()))
      : dpLogs;

    const totalIssuedOverall   = filteredData.reduce((acc, d) => acc + d.totalIssued, 0);
    const totalReturnedOverall = filteredData.reduce((acc, d) => acc + d.totalReturned, 0);
    const overallReturnRate    = totalIssuedOverall > 0 ? Math.round((totalReturnedOverall / totalIssuedOverall) * 100) : 0;

    // Daily mode: flag whether the view is the active operational day
    const isActiveDay = mode === 'daily' && requestedDate === opDay;

    res.json({
      success: true,
      mode,
      operationalDate: opDay,
      requestedDate,
      isActiveDay,
      datesList,
      data: filteredData,
      allDps: dpRows.map(d => ({ id: d.id, name: d.name, dpCode: d.dpCode })),
      stats: {
        totalIssued:      totalIssuedOverall,
        totalReturned:    totalReturnedOverall,
        returnRate:       overallReturnRate,
        pendingIncidents: crmIncidents.filter(i => i.status === 'Pending Review').length +
                          filteredData.filter(d => d.hasFlag).length,
      },
      incidents: crmIncidents,
    });
  } catch (err) { next(err); }
};

// GET /api/empty-bottles/incidents — List manager breakage incident flags
const getIncidents = async (req, res, next) => {
  try {
    const result = await readFromCRM('SELECT * FROM empty_bottle_incidents ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

// POST /api/empty-bottles/incidents — Raise a new incident flag
const raiseIncident = async (req, res, next) => {
  try {
    const { dpRefId, dpName, routeName, bottleType, brokenCount, missingCount, managerNotes } = req.body;
    if (!dpName) return res.status(400).json({ success: false, message: 'DP Name is required.' });

    const result = await writeToCRM(
      `INSERT INTO empty_bottle_incidents
         (dp_ref_id, dp_name, route_name, bottle_type, broken_count, missing_count, manager_notes, raised_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Manager App', 'Pending Review') RETURNING *`,
      [dpRefId || 'dp-custom', dpName, routeName || 'General Route', bottleType || '1 Litre Bottle', brokenCount || 0, missingCount || 0, managerNotes || '']
    );

    res.status(201).json({ success: true, message: 'Incident flag raised.', data: result.rows[0] });
  } catch (err) { next(err); }
};

// PUT /api/empty-bottles/incidents/:id/review — Super Admin Incident Resolution
const reviewIncident = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, resolutionNotes } = req.body;
    const resolvedBy = req.admin?.name || req.admin?.email || 'Super Admin';

    await writeToCRM(
      `UPDATE empty_bottle_incidents
       SET status = $1, resolution_notes = $2, resolved_by = $3
       WHERE id = $4`,
      [status || 'Resolved - Reimbursed', resolutionNotes || '', resolvedBy, id]
    );

    res.json({ success: true, message: `Incident updated to ${status}.` });
  } catch (err) { next(err); }
};

module.exports = { getEmptyBottleLogs, getIncidents, raiseIncident, reviewIncident };

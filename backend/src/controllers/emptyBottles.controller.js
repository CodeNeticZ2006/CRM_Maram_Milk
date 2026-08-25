const { readFromApp, readFromCRM, writeToCRM } = require('../config/database');
const { getExpectedOperationalDate } = require('../services/operationalDay.service');

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
    let dpRows = [], routeRows = [], allocRows = [], logRows = [];
    try {
      const [dpRes, rRes, aRes, lRes] = await Promise.all([
        readFromApp('SELECT id, name, "dpCode", "mobileNumber", "vehicleNumber", zone, "isActive" FROM "DeliveryPerson" WHERE "isActive" = true AND LOWER(name) NOT IN (\'adam\', \'pradeep\', \'praddep\', \'test\', \'test dp\') AND "dpCode" NOT IN (\'DP018\', \'DP019\', \'DP020\') ORDER BY name ASC'),
        readFromApp('SELECT id, name, zone, "assignedDpId" FROM "Route" ORDER BY name ASC'),
        readFromApp('SELECT id, date, "routeId", "dpId", "qty1LBottle", "qtyHalfLBottle" FROM "RouteAllocation" ORDER BY "createdAt" DESC'),
        readFromApp('SELECT id, date, "routeId", "dpId", "oneLBottlesCollected", "halfLBottlesCollected", "actualDelivered1L", "actualDeliveredHalfL", "deliveryCompleted", "flagIssue", notes, reason FROM "EmptyBottleLog" ORDER BY "createdAt" DESC'),
      ]);
      dpRows    = dpRes.rows;
      routeRows = rRes.rows;
      allocRows = aRes.rows;
      logRows   = lRes.rows;
    } catch (e) {
      console.warn('⚠️ DB2 EmptyBottleLog query warning:', e.message);
    }

    // Fallback DP list if DB2 returns empty
    if (dpRows.length === 0) {
      dpRows = [
        { id: 'dp-1', name: 'Ansar Ali',      dpCode: 'DP-101', vehicleNumber: 'TN 39 AB 1024', zone: 'Zone A' },
        { id: 'dp-2', name: 'Karthik Raja',   dpCode: 'DP-102', vehicleNumber: 'TN 39 CD 5678', zone: 'Zone A' },
        { id: 'dp-3', name: 'Saravana Kumar', dpCode: 'DP-103', vehicleNumber: 'TN 39 EF 9012', zone: 'Zone B' },
        { id: 'dp-4', name: 'Ramesh Babu',    dpCode: 'DP-104', vehicleNumber: 'TN 39 GH 3456', zone: 'Zone B' },
      ];
    }

    // ── Fetch CRM Incidents ───────────────────────────────────────────────────
    let crmIncidents = [];
    try {
      const incRes = await readFromCRM('SELECT * FROM empty_bottle_incidents ORDER BY created_at DESC LIMIT 50');
      crmIncidents = incRes.rows;
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

    // ── Per-DP Aggregation ────────────────────────────────────────────────────
    const dpLogs = dpRows.map((dp) => {
      // ── Determine "Assigned Route" for this DP for the selected period ──────
      // Priority:
      //   1. RouteAllocation record on the selected date (daily) or within datesList
      //   2. EmptyBottleLog record on the selected date / within datesList
      //   3. Route master permanent assignment (Route.assignedDpId)
      //   4. Standby / Unassigned

      // For daily mode: look only at the single requestedDate
      // For weekly/monthly/custom: look at the most recent date within datesList that has an allocation
      const periodDates = mode === 'daily' ? [requestedDate] : [...datesList].reverse(); // most recent first

      let dpAssignedRouteStr = 'Standby / Unassigned';

      // 1. Check RouteAllocation for selected period dates (most recent first)
      let foundRouteId = null;
      for (const dStr of periodDates) {
        const alloc = allocRows.find(a => matchDp(a, dp) && String(a.date || '').slice(0, 10) === dStr);
        if (alloc?.routeId) { foundRouteId = alloc.routeId; break; }
      }

      // 2. Check EmptyBottleLog for selected period dates if no alloc found
      if (!foundRouteId) {
        for (const dStr of periodDates) {
          const log = logRows.find(l => matchDp(l, dp) && String(l.date || '').slice(0, 10) === dStr);
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
        const isFuture   = dStr > opDay;
        const isBeforeDb2 = dStr < DB2_START_DATE;

        const alloc   = allocRows.find(a => matchDp(a, dp) && String(a.date || '').slice(0, 10) === dStr);
        const dayLogs = logRows.filter(l => matchDp(l, dp) && String(l.date || '').slice(0, 10) === dStr);
        const log     = dayLogs[0] || null;

        let issued1L = 0, issuedHalfL = 0, returned1L = 0, returnedHalfL = 0;
        let missing1L = 0, missingHalfL = 0, hasFlag = false;

        // Only count if actual records exist — never carry forward previous-day values
        if (!isBeforeDb2 && !isFuture && dayLogs.length > 0) {
          issued1L      = dayLogs.reduce((s, l) => s + (parseInt(l.actualDelivered1L)    || 0), 0);
          issuedHalfL   = dayLogs.reduce((s, l) => s + (parseInt(l.actualDeliveredHalfL) || 0), 0);
          returned1L    = dayLogs.reduce((s, l) => s + (parseInt(l.oneLBottlesCollected)  || 0), 0);
          returnedHalfL = dayLogs.reduce((s, l) => s + (parseInt(l.halfLBottlesCollected) || 0), 0);
          hasFlag       = dayLogs.some(l => Boolean(l.flagIssue));
          missing1L     = Math.max(0, issued1L    - returned1L);
          missingHalfL  = Math.max(0, issuedHalfL - returnedHalfL);

          totalIssued1L      += issued1L;      totalReturned1L     += returned1L;
          totalMissing1L     += missing1L;     totalIssuedHalfL    += issuedHalfL;
          totalReturnedHalfL += returnedHalfL; totalMissingHalfL   += missingHalfL;
          if (hasFlag) flagCount++;
        }

        const dayIssued   = issued1L + issuedHalfL;
        const dayReturned = returned1L + returnedHalfL;
        return {
          date: dStr, isFuture, isBeforeDb2,
          issued1L, issuedHalfL, returned1L, returnedHalfL,
          missing1L, missingHalfL,
          dayIssued, dayReturned,
          returnRate: dayIssued > 0 ? Math.round((dayReturned / dayIssued) * 100) : (isBeforeDb2 || isFuture ? null : 0),
          hasFlag,
          notes: log?.notes || (hasFlag ? `${missing1L + missingHalfL} bottles unreturned` : null),
          routeName: routeRows.find(r => String(r.id) === String(alloc?.routeId || log?.routeId))?.name || dpAssignedRouteStr,
          hasRecords: dayLogs.length > 0,
        };
      });

      const totalIssuedOverall   = totalIssued1L   + totalIssuedHalfL;
      const totalReturnedOverall = totalReturned1L + totalReturnedHalfL;

      return {
        id: dp.id, dpName: dp.name, dpCode: dp.dpCode,
        vehicleNumber: dp.vehicleNumber || 'TN 39 AB 1000',
        routeName: dpAssignedRouteStr, zone: dp.zone || 'Zone A',
        issued1L: totalIssued1L, issuedHalfL: totalIssuedHalfL,
        returned1L: totalReturned1L, returnedHalfL: totalReturnedHalfL,
        missing1L: totalMissing1L, missingHalfL: totalMissingHalfL,
        totalIssued: totalIssuedOverall, totalReturned: totalReturnedOverall,
        returnRate: totalIssuedOverall > 0 ? Math.round((totalReturnedOverall / totalIssuedOverall) * 100) : 0,
        hasFlag: flagCount > 0, flagCount,
        dateLogs, source: 'DB2',
      };
    });

    // ── Filter by DP if requested ─────────────────────────────────────────────
    const filteredData = dpId
      ? dpLogs.filter(a => a.id === dpId || (a?.dpName || '').toLowerCase().includes((dpId || '').toLowerCase()))
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

// Helper: match an allocation/log row to a DP by id or dpCode
function matchDp(row, dp) {
  return String(row.dpId) === String(dp.id) || String(row.dpId) === String(dp.dpCode);
}

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

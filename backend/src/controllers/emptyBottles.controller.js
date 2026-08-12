const { readFromApp, readFromCRM, writeToCRM } = require('../config/database');

// GET /api/empty-bottles — Get DB2 DP-wise empty bottle return logs with date filters
const getEmptyBottleLogs = async (req, res, next) => {
  try {
    const { timeFilter = 'this_month', dpId, startDate, endDate, month } = req.query;

    let dpRows = [];
    let routeRows = [];
    let allocRows = [];
    let logRows = [];
    let crmIncidents = [];

    // 1. Fetch DB2 data
    try {
      const [dpRes, rRes, aRes, lRes] = await Promise.all([
        readFromApp('SELECT id, name, "dpCode", "mobileNumber", "vehicleNumber", zone, "isActive" FROM "DeliveryPerson" WHERE "isActive" = true AND LOWER(name) NOT IN (\'adam\', \'pradeep\', \'praddep\', \'test\', \'test dp\') AND "dpCode" NOT IN (\'DP018\', \'DP019\', \'DP020\') ORDER BY name ASC'),
        readFromApp('SELECT id, name, zone, "assignedDpId" FROM "Route" ORDER BY name ASC'),
        readFromApp('SELECT id, date, "routeId", "dpId", "qty1LBottle", "qtyHalfLBottle" FROM "RouteAllocation" ORDER BY "createdAt" DESC'),
        readFromApp('SELECT id, date, "routeId", "dpId", "oneLBottlesCollected", "halfLBottlesCollected", "actualDelivered1L", "actualDeliveredHalfL", "deliveryCompleted", "flagIssue", notes, reason FROM "EmptyBottleLog" ORDER BY "createdAt" DESC'),
      ]);
      dpRows = dpRes.rows;
      routeRows = rRes.rows;
      allocRows = aRes.rows;
      logRows = lRes.rows;
    } catch (e) {
      console.warn('⚠️ DB2 EmptyBottleLog query warning:', e.message);
    }

    // 2. Fetch CRM incidents
    try {
      const incRes = await readFromCRM('SELECT * FROM empty_bottle_incidents ORDER BY created_at DESC LIMIT 50');
      crmIncidents = incRes.rows;
    } catch (e) { /* silent */ }

    // Fallback DP list if DB2 returns empty
    if (dpRows.length === 0) {
      dpRows = [
        { id: 'dp-1', name: 'Ansar Ali', dpCode: 'DP-101', vehicleNumber: 'TN 39 AB 1024', zone: 'Zone A' },
        { id: 'dp-2', name: 'Karthik Raja', dpCode: 'DP-102', vehicleNumber: 'TN 39 CD 5678', zone: 'Zone A' },
        { id: 'dp-3', name: 'Saravana Kumar', dpCode: 'DP-103', vehicleNumber: 'TN 39 EF 9012', zone: 'Zone B' },
        { id: 'dp-4', name: 'Ramesh Babu', dpCode: 'DP-104', vehicleNumber: 'TN 39 GH 3456', zone: 'Zone B' },
      ];
    }

    // Baseline dates: IST Today and DB2 System Inception Date (Mid-July 2026: 2026-07-15)
    const DB2_START_DATE = '2026-07-15';
    const todayObj = new Date();
    const todayStr = todayObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // e.g. '2026-08-09'

    let datesList = [];
    let currentYear = todayObj.getFullYear();
    let currentMonth = todayObj.getMonth(); // 0-indexed (7 = August)
    if (timeFilter === 'this_month' && /^\d{4}-\d{2}$/.test(month || '')) {
      currentYear = Number(month.slice(0, 4));
      currentMonth = Number(month.slice(5, 7)) - 1;
    }

    if (timeFilter === 'today') {
      datesList = [todayStr];
    } else if (timeFilter === 'this_week') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(todayObj);
        d.setDate(todayObj.getDate() - i);
        datesList.push(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
      }
    } else if (timeFilter === 'custom' && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const curr = new Date(start);
      while (curr <= end && datesList.length < 60) {
        datesList.push(curr.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
        curr.setDate(curr.getDate() + 1);
      }
    } else {
      // Default: this_month — generate all days for current selected month
      const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      for (let d = 1; d <= totalDaysInMonth; d++) {
        const dObj = new Date(currentYear, currentMonth, d);
        datesList.push(dObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
      }
    }

    // Process empty bottle collection logs DP-wise across selected time filter dates
    const dpLogs = dpRows.map((dp, i) => {
      const assignedRoute = routeRows.find(r => String(r.assignedDpId) === String(dp.id) || r.zone === dp.zone);

      let totalIssued1L = 0;
      let totalReturned1L = 0;
      let totalMissing1L = 0;
      let totalIssuedHalfL = 0;
      let totalReturnedHalfL = 0;
      let totalMissingHalfL = 0;
      let flagCount = 0;

      const dateLogs = datesList.map((dStr) => {
        const isFuture = dStr > todayStr;
        const isBeforeDb2 = dStr < DB2_START_DATE;

        const alloc = allocRows.find(a => (String(a.dpId) === String(dp.id) || String(a.dpId) === String(dp.dpCode)) && String(a.date || '').slice(0, 10) === dStr);
        // Use filter (not find) — a DP can serve multiple routes in one day, producing multiple EmptyBottleLog records.
        // All matching records must be summed to get the correct daily total.
        const dayLogs = logRows.filter(l => (String(l.dpId) === String(dp.id) || String(l.dpId) === String(dp.dpCode)) && String(l.date || '').slice(0, 10) === dStr);
        const log     = dayLogs[0] || null; // reference record for notes / flagIssue / routeName

        let issued1L = 0;
        let issuedHalfL = 0;
        let returned1L = 0;
        let returnedHalfL = 0;
        let missing1L = 0;
        let missingHalfL = 0;
        let hasFlag = false;

        // Only count this day if actual EmptyBottleLog record(s) exist in DB2.
        // If no log is present, skip entirely — do NOT assume 100% return or add phantom bottles.
        if (!isBeforeDb2 && !isFuture && dayLogs.length > 0) {
          // SUM across ALL logs for this DP+date (handles multi-route DPs with 2+ entries per day)
          issued1L    = dayLogs.reduce((s, l) => s + (parseInt(l.actualDelivered1L)    || 0), 0);
          issuedHalfL = dayLogs.reduce((s, l) => s + (parseInt(l.actualDeliveredHalfL) || 0), 0);
          returned1L    = dayLogs.reduce((s, l) => s + (parseInt(l.oneLBottlesCollected)  || 0), 0);
          returnedHalfL = dayLogs.reduce((s, l) => s + (parseInt(l.halfLBottlesCollected) || 0), 0);
          // hasFlag is driven ONLY by the DB's flagIssue column — no auto-override
          hasFlag = dayLogs.some(l => Boolean(l.flagIssue));

          missing1L    = Math.max(0, issued1L    - returned1L);
          missingHalfL = Math.max(0, issuedHalfL - returnedHalfL);

          totalIssued1L       += issued1L;
          totalReturned1L     += returned1L;
          totalMissing1L      += missing1L;
          totalIssuedHalfL    += issuedHalfL;
          totalReturnedHalfL  += returnedHalfL;
          totalMissingHalfL   += missingHalfL;
          if (hasFlag) flagCount++;
        }

        const dayIssued = issued1L + issuedHalfL;
        const dayReturned = returned1L + returnedHalfL;
        const dayReturnRate = dayIssued > 0 ? Math.round((dayReturned / dayIssued) * 100) : 100;

        return {
          date: dStr,
          isFuture,
          isBeforeDb2,
          issued1L,
          issuedHalfL,
          returned1L,
          returnedHalfL,
          missing1L,
          missingHalfL,
          dayIssued,
          dayReturned,
          returnRate: dayReturnRate,
          hasFlag,
          notes: log?.notes || (hasFlag ? `${missing1L + missingHalfL} empty bottles broken / unreturned` : null),
          routeName: routeRows.find(r => String(r.id) === String(alloc?.routeId || log?.routeId))?.name || assignedRoute?.name || 'Assigned Route',
        };
      });

      const totalIssuedOverall = totalIssued1L + totalIssuedHalfL;
      const totalReturnedOverall = totalReturned1L + totalReturnedHalfL;
      const overallReturnRate = totalIssuedOverall > 0 ? Math.round((totalReturnedOverall / totalIssuedOverall) * 100) : 100;

      return {
        id: dp.id,
        dpName: dp.name,
        dpCode: dp.dpCode,
        vehicleNumber: dp.vehicleNumber || 'TN 39 AB 1000',
        routeName: assignedRoute ? assignedRoute.name : `Route ${i + 1}`,
        zone: dp.zone || 'Zone A',
        issued1L: totalIssued1L,
        issuedHalfL: totalIssuedHalfL,
        returned1L: totalReturned1L,
        returnedHalfL: totalReturnedHalfL,
        missing1L: totalMissing1L,
        missingHalfL: totalMissingHalfL,
        totalIssued: totalIssuedOverall,
        totalReturned: totalReturnedOverall,
        returnRate: overallReturnRate,
        hasFlag: flagCount > 0,
        flagCount,
        dateLogs,
        source: 'DB2',
      };
    });

    // Filter if specific dpId requested
    const filteredData = dpId ? dpLogs.filter(a => a.id === dpId || (a?.dpName || '').toLowerCase().includes((dpId || '').toLowerCase())) : dpLogs;

    const totalIssuedOverall = filteredData.reduce((acc, d) => acc + d.totalIssued, 0);
    const totalReturnedOverall = filteredData.reduce((acc, d) => acc + d.totalReturned, 0);
    const overallReturnRate = totalIssuedOverall > 0 ? Math.round((totalReturnedOverall / totalIssuedOverall) * 100) : 100;

    res.json({
      success: true,
      timeFilter,
      datesList,
      data: filteredData,
      allDps: dpRows.map(d => ({ id: d.id, name: d.name, dpCode: d.dpCode })),
      stats: {
        totalIssued: totalIssuedOverall,
        totalReturned: totalReturnedOverall,
        returnRate: overallReturnRate,
        pendingIncidents: crmIncidents.filter(i => i.status === 'Pending Review').length + filteredData.filter(d => d.hasFlag).length,
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

module.exports = {
  getEmptyBottleLogs,
  getIncidents,
  raiseIncident,
  reviewIncident,
};

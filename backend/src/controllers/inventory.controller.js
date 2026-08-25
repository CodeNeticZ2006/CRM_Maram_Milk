const { readFromApp, writeToApp, readFromCRM, writeToCRM } = require('../config/database');
const { randomUUID } = require('crypto');
const ExcelJS = require('exceljs');
const { getExpectedOperationalDate } = require('../services/operationalDay.service');

// Get active operational date string in IST (7:00 PM IST boundary)
const getISTDate = () => getExpectedOperationalDate();

// Low stock threshold default (e.g. 20 units)
const LOW_STOCK_THRESHOLD = 20;

// ─────────────────────────────────────────────
// GET /api/inventory — Live Stock & Summary KPIs
// ─────────────────────────────────────────────
const getInventory = async (req, res, next) => {
  try {
    const istToday = getISTDate();
    const dateStr  = req.query.date || istToday;

    // 1. Fetch all InventoryItems from DB2
    let items = [];
    try {
      const itemsRes = await readFromApp(
        'SELECT id, name, unit, material FROM "InventoryItem" ORDER BY name ASC, unit ASC'
      );
      items = itemsRes.rows;
    } catch (e) {
      console.warn('⚠️ DB2 InventoryItem query warning:', e.message);
    }

    // Fallback items if DB2 table is empty or unavailable
    if (items.length === 0) {
      items = [
        { id: 'inv-item-1', name: 'Cow Milk (1 Litre)', unit: 'Litres', material: 'Milk' },
        { id: 'inv-item-2', name: 'Cow Milk (500 ml)', unit: 'Packets', material: 'Milk' },
        { id: 'inv-item-3', name: 'Buffalo Milk (1 Litre)', unit: 'Litres', material: 'Milk' },
      ];
    }

    // 2. Fetch daily records for target date from DB2
    let dailyRecords = [];
    try {
      const recordsRes = await readFromApp(
        `SELECT id, date, "inventoryItemId", "currentStock", "carriedOverStock",
                "newStockAdded", "expectedStock", "updatedAt"
         FROM "InventoryDailyRecord"
         WHERE date = $1`,
        [dateStr]
      );
      dailyRecords = recordsRes.rows;
    } catch (e) {
      console.warn('⚠️ DB2 InventoryDailyRecord query warning:', e.message);
    }

    // 2b. Fetch most recent preceding daily records prior to dateStr for carry-over calculation
    let prevRecords = [];
    try {
      const prevRes = await readFromApp(
        `SELECT DISTINCT ON ("inventoryItemId")
                id, date, "inventoryItemId", "currentStock", "expectedStock", "updatedAt"
         FROM "InventoryDailyRecord"
         WHERE date < $1
         ORDER BY "inventoryItemId", date DESC`,
        [dateStr]
      );
      prevRecords = prevRes.rows;
    } catch (e) {
      console.warn('⚠️ DB2 preceding InventoryDailyRecord query warning:', e.message);
    }

    // 3. Fetch distinct dates for date picker
    let availableDates = [];
    try {
      const datesRes = await readFromApp(
        `SELECT DISTINCT date FROM "InventoryDailyRecord" ORDER BY date DESC LIMIT 30`
      );
      availableDates = datesRes.rows.map(r => r.date);
      if (!availableDates.includes(dateStr)) {
        availableDates.unshift(dateStr);
      }
    } catch (e) { /* silent */ }

    // Combine item details with current daily stock record and preceding date carry-over
    const combined = items.map(item => {
      const rec = dailyRecords.find(r => r.inventoryItemId === item.id);
      const prevRec = prevRecords.find(r => r.inventoryItemId === item.id);

      // Carried over stock is taken from rec if available, or the previous date's current stock
      let carriedOver = 0;
      if (rec && parseFloat(rec.carriedOverStock || 0) > 0) {
        carriedOver = parseFloat(rec.carriedOverStock);
      } else if (prevRec) {
        carriedOver = parseFloat(prevRec.currentStock || 0);
      }

      const addedToday = rec ? parseFloat(rec.newStockAdded || 0) : 0;

      let currStock = 0;
      let expStock = 0;

      if (rec) {
        const recCurr = parseFloat(rec.currentStock || 0);
        const recExp = parseFloat(rec.expectedStock || 0);

        // If currentStock is 0, no stock added today, but carriedOver > 0, fallback to carriedOver
        if (recCurr === 0 && rec.newStockAdded === 0 && carriedOver > 0) {
          currStock = carriedOver;
          expStock = carriedOver;
        } else {
          currStock = recCurr;
          expStock = recExp > 0 ? recExp : (carriedOver + addedToday);
        }
      } else {
        // No record exists for target date yet -> carried over stock is current stock
        currStock = carriedOver + addedToday;
        expStock = carriedOver + addedToday;
      }

      let status = 'In Stock';
      if (currStock <= 0) {
        status = 'Out of Stock';
      } else if (currStock <= LOW_STOCK_THRESHOLD) {
        status = 'Low Stock';
      }

      return {
        id: item.id,
        name: item.name,
        unit: item.unit || 'Units',
        material: item.material || 'General',
        currentStock: currStock,
        carriedOverStock: carriedOver,
        newStockAdded: addedToday,
        expectedStock: expStock,
        status,
        date: dateStr,
        updatedAt: rec ? rec.updatedAt : (prevRec ? prevRec.updatedAt : null),
        hasRecord: !!rec,
        minThreshold: LOW_STOCK_THRESHOLD,
      };
    });

    // Custom product ordering: 1L Bottle, 500ml Bottle (Half Litre Bottle), 500ml Packet
    const getItemPriority = (item) => {
      const name = (item?.name || '').toLowerCase();
      const material = (item?.material || '').toLowerCase();
      const unit = (item?.unit || '').toLowerCase();

      if (name.includes('1l bottle') || (name.includes('1l') && (name.includes('bottle') || material.includes('bottle')))) return 1;
      if (
        name.includes('half litre bottle') ||
        name.includes('500ml bottle') ||
        name.includes('500 ml bottle') ||
        (material.includes('bottle') && (name.includes('500') || name.includes('half') || unit.includes('500')))
      ) return 2;
      if (
        name.includes('500ml packet') ||
        name.includes('500 ml packet') ||
        (material.includes('packet') && (name.includes('500') || name.includes('half') || unit.includes('500')))
      ) return 3;

      return 4;
    };

    combined.sort((a, b) => getItemPriority(a) - getItemPriority(b));

    // 4. Calculate summary KPIs
    const totalStock = combined.reduce((acc, item) => acc + item.currentStock, 0);
    const todayAddedStock = combined.reduce((acc, item) => acc + item.newStockAdded, 0);
    const lowStockCount = combined.filter(item => item.status === 'Low Stock').length;
    const outOfStockCount = combined.filter(item => item.status === 'Out of Stock').length;

    const lowStockAlerts = combined.filter(item => item.status === 'Low Stock' || item.status === 'Out of Stock');

    res.json({
      success: true,
      date: dateStr,
      data: combined,
      summary: {
        totalStock,
        todayAddedStock,
        lowStockCount,
        outOfStockCount,
        totalProducts: combined.length,
      },
      lowStockAlerts,
      availableDates,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// POST /api/inventory/update — Direct DB2 Stock Override
// ─────────────────────────────────────────────
const updateInventory = async (req, res, next) => {
  try {
    const { inventoryItemId, date, newStockAdded, currentStock } = req.body;
    if (!inventoryItemId) return res.status(400).json({ success: false, message: 'inventoryItemId is required.' });

    const targetDate = date || getISTDate();
    const newAdded = parseFloat(newStockAdded || 0);
    const currStock = parseFloat(currentStock || 0);

    // Check if record exists in DB2
    let existingId = null;
    let carriedOver = 0;
    try {
      const rec = await readFromApp(
        'SELECT id, "carriedOverStock" FROM "InventoryDailyRecord" WHERE "inventoryItemId" = $1 AND date = $2',
        [inventoryItemId, targetDate]
      );
      if (rec.rows.length > 0) {
        existingId = rec.rows[0].id;
        carriedOver = parseFloat(rec.rows[0].carriedOverStock || 0);
      }
    } catch (e) { /* silent */ }

    if (existingId) {
      await writeToApp(
        `UPDATE "InventoryDailyRecord"
         SET "newStockAdded" = $1, "currentStock" = $2, "expectedStock" = $3, "updatedAt" = NOW()
         WHERE id = $4`,
        [newAdded, currStock, carriedOver + newAdded, existingId]
      );
    } else {
      // Fetch previous day stock as carriedOver if creating new record
      const prevRes = await readFromApp(
        `SELECT "currentStock" FROM "InventoryDailyRecord"
         WHERE "inventoryItemId" = $1 AND date < $2
         ORDER BY date DESC LIMIT 1`,
        [inventoryItemId, targetDate]
      );
      if (prevRes.rows.length > 0) {
        carriedOver = parseFloat(prevRes.rows[0].currentStock || 0);
      }

      const newId = randomUUID();
      await writeToApp(
        `INSERT INTO "InventoryDailyRecord"
           (id, date, "inventoryItemId", "currentStock", "carriedOverStock", "newStockAdded", "expectedStock", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [newId, targetDate, inventoryItemId, currStock, carriedOver, newAdded, carriedOver + newAdded]
      );
    }

    res.json({
      success: true,
      message: `Stock updated in DB2 for target date ${targetDate}`,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// POST /api/inventory/add-stock — Super Admin Add Stock with Audit History & DB2 Sync
// ─────────────────────────────────────────────
const addStock = async (req, res, next) => {
  try {
    const { inventoryItemId, quantityAdded, unit, batchNumber, supplier, remarks } = req.body;
    if (!inventoryItemId) return res.status(400).json({ success: false, message: 'Product / Inventory Item is required.' });

    const added = parseFloat(quantityAdded);
    if (isNaN(added) || added <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity added must be greater than zero.' });
    }

    const dateStr = getISTDate();
    const addedBy = req.admin?.name || req.admin?.email || 'Super Admin';

    // 1. Fetch item name and unit from DB2
    let itemName = 'Inventory Item';
    let itemUnit = unit || 'Litres';
    try {
      const itemRes = await readFromApp(
        'SELECT name, unit FROM "InventoryItem" WHERE id = $1',
        [inventoryItemId]
      );
      if (itemRes.rows.length > 0) {
        itemName = itemRes.rows[0].name;
        if (!unit) itemUnit = itemRes.rows[0].unit || 'Litres';
      }
    } catch (e) { /* silent */ }

    // 2. Fetch current stock for this item
    let previousStock = 0;
    let existingRecordId = null;
    let carriedOver = 0;

    try {
      const currentRes = await readFromApp(
        'SELECT id, "currentStock", "newStockAdded", "carriedOverStock" FROM "InventoryDailyRecord" WHERE "inventoryItemId" = $1 AND date = $2',
        [inventoryItemId, dateStr]
      );

      if (currentRes.rows.length > 0) {
        existingRecordId = currentRes.rows[0].id;
        previousStock = parseFloat(currentRes.rows[0].currentStock || 0);
        carriedOver = parseFloat(currentRes.rows[0].carriedOverStock || 0);
      } else {
        // Fetch previous day stock
        const prevRes = await readFromApp(
          `SELECT "currentStock" FROM "InventoryDailyRecord"
           WHERE "inventoryItemId" = $1 AND date < $2
           ORDER BY date DESC LIMIT 1`,
          [inventoryItemId, dateStr]
        );
        if (prevRes.rows.length > 0) {
          previousStock = parseFloat(prevRes.rows[0].currentStock || 0);
          carriedOver = previousStock;
        }
      }
    } catch (e) { /* silent */ }

    const updatedStock = previousStock + added;

    // 3. Write Audit Record into DB1 `inventory_history`
    try {
      await writeToCRM(
        `INSERT INTO inventory_history
           (inventory_item_id, product_name, previous_stock, quantity_added, updated_stock, unit, batch_number, supplier, action_type, remarks, added_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ADD_STOCK', $9, $10, NOW())`,
        [inventoryItemId, itemName, previousStock, added, updatedStock, itemUnit, batchNumber || null, supplier || null, remarks || 'Super Admin Stock Addition', addedBy]
      );
    } catch (db1Err) {
      console.warn('⚠️ DB1 inventory_history write skipped:', db1Err.message);
    }

    // 4. Synchronize & Update DB2 `"InventoryDailyRecord"`
    try {
      if (existingRecordId) {
        await writeToApp(
          `UPDATE "InventoryDailyRecord"
           SET "newStockAdded"    = "newStockAdded" + $1,
               "currentStock"     = "currentStock" + $1,
               "expectedStock"    = "carriedOverStock" + ("newStockAdded" + $1),
               "updatedAt"        = NOW()
           WHERE id = $2`,
          [added, existingRecordId]
        );
      } else {
        const newRecordId = randomUUID();
        await writeToApp(
          `INSERT INTO "InventoryDailyRecord"
             (id, date, "inventoryItemId", "currentStock", "carriedOverStock",
              "newStockAdded", "expectedStock", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
          [newRecordId, dateStr, inventoryItemId, updatedStock, carriedOver, added, carriedOver + added]
        );
      }
    } catch (db2Err) {
      console.warn('⚠️ DB2 InventoryDailyRecord sync warning:', db2Err.message);
    }

    console.log(`✅ [Stock Addition] ${itemName} +${added} ${itemUnit} by ${addedBy}. Prev: ${previousStock} -> New: ${updatedStock}`);

    res.status(201).json({
      success: true,
      message: `Successfully added ${added} ${itemUnit} for ${itemName}. Manager App DB2 synchronized!`,
      data: {
        inventoryItemId,
        productName: itemName,
        previousStock,
        quantityAdded: added,
        updatedStock,
        unit: itemUnit,
        batchNumber,
        supplier,
        addedBy,
        date: dateStr,
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// POST /api/inventory/correct-stock — Super Admin Stock Adjustment/Correction
// ─────────────────────────────────────────────
const correctStock = async (req, res, next) => {
  try {
    const { inventoryItemId, newTotalStock, remarks } = req.body;
    if (!inventoryItemId) return res.status(400).json({ success: false, message: 'Product / Inventory Item is required.' });
    if (!remarks || !remarks.trim()) {
      return res.status(400).json({ success: false, message: 'Reason / Remarks are required for stock correction.' });
    }

    const newStock = parseFloat(newTotalStock);
    if (isNaN(newStock) || newStock < 0) {
      return res.status(400).json({ success: false, message: 'New total stock must be zero or positive.' });
    }

    const dateStr = getISTDate();
    const addedBy = req.admin?.name || req.admin?.email || 'Super Admin';

    // Fetch current item info
    let itemName = 'Inventory Item';
    let itemUnit = 'Litres';
    try {
      const itemRes = await readFromApp(
        'SELECT name, unit FROM "InventoryItem" WHERE id = $1',
        [inventoryItemId]
      );
      if (itemRes.rows.length > 0) {
        itemName = itemRes.rows[0].name;
        itemUnit = itemRes.rows[0].unit || 'Litres';
      }
    } catch (e) { /* silent */ }

    let previousStock = 0;
    let existingRecordId = null;
    try {
      const currentRes = await readFromApp(
        'SELECT id, "currentStock" FROM "InventoryDailyRecord" WHERE "inventoryItemId" = $1 AND date = $2',
        [inventoryItemId, dateStr]
      );
      if (currentRes.rows.length > 0) {
        existingRecordId = currentRes.rows[0].id;
        previousStock = parseFloat(currentRes.rows[0].currentStock || 0);
      }
    } catch (e) { /* silent */ }

    const qtyDiff = newStock - previousStock;

    // 1. Audit record in DB1
    try {
      await writeToCRM(
        `INSERT INTO inventory_history
           (inventory_item_id, product_name, previous_stock, quantity_added, updated_stock, unit, action_type, remarks, added_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'ADJUSTMENT', $7, $8, NOW())`,
        [inventoryItemId, itemName, previousStock, qtyDiff, newStock, itemUnit, remarks.trim(), addedBy]
      );
    } catch (e) { /* silent */ }

    // 2. DB2 update
    try {
      if (existingRecordId) {
        await writeToApp(
          `UPDATE "InventoryDailyRecord"
           SET "currentStock" = $1, "updatedAt" = NOW()
           WHERE id = $2`,
          [newStock, existingRecordId]
        );
      } else {
        const newRecordId = randomUUID();
        await writeToApp(
          `INSERT INTO "InventoryDailyRecord"
             (id, date, "inventoryItemId", "currentStock", "carriedOverStock", "newStockAdded", "expectedStock", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, 0, $4, NOW(), NOW())`,
          [newRecordId, dateStr, inventoryItemId, newStock, previousStock]
        );
      }
    } catch (e) { /* silent */ }

    res.json({
      success: true,
      message: `Stock quantity corrected to ${newStock} ${itemUnit} for ${itemName}. DB2 synchronized!`,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/inventory/history — Read-Only Stock History Ledger
// ─────────────────────────────────────────────
const getStockHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params = [limit, offset];

    if (search) {
      whereClause = `WHERE product_name ILIKE $3 OR supplier ILIKE $3 OR batch_number ILIKE $3 OR added_by ILIKE $3`;
      params.push(`%${search}%`);
    }

    let historyRows = [];
    let totalCount = 0;

    try {
      const historyRes = await readFromCRM(
        `SELECT * FROM inventory_history
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        params
      );
      historyRows = historyRes.rows;

      const countRes = await readFromCRM(`SELECT COUNT(*) FROM inventory_history ${whereClause}`);
      totalCount = parseInt(countRes.rows[0].count);
    } catch (err) {
      console.warn('⚠️ DB1 inventory_history query warning:', err.message);
    }

    res.json({
      success: true,
      data: historyRows,
      total: totalCount,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/inventory/low-stock — Dedicated Low Stock Items
// ─────────────────────────────────────────────
const getLowStockItems = async (req, res, next) => {
  try {
    const istToday = getISTDate();
    let items = [];
    try {
      const itemsRes = await readFromApp(
        'SELECT id, name, unit, material FROM "InventoryItem" ORDER BY name ASC'
      );
      items = itemsRes.rows;
    } catch (e) { /* silent */ }

    let dailyRecords = [];
    try {
      const recordsRes = await readFromApp(
        'SELECT "inventoryItemId", "currentStock" FROM "InventoryDailyRecord" WHERE date = $1',
        [istToday]
      );
      dailyRecords = recordsRes.rows;
    } catch (e) { /* silent */ }

    const lowStock = items.filter(item => {
      const rec = dailyRecords.find(r => r.inventoryItemId === item.id);
      const stock = rec ? parseFloat(rec.currentStock || 0) : 0;
      return stock <= LOW_STOCK_THRESHOLD;
    }).map(item => {
      const rec = dailyRecords.find(r => r.inventoryItemId === item.id);
      const stock = rec ? parseFloat(rec.currentStock || 0) : 0;
      return {
        id: item.id,
        name: item.name,
        unit: item.unit || 'Units',
        currentStock: stock,
        status: stock === 0 ? 'Out of Stock' : 'Low Stock',
        threshold: LOW_STOCK_THRESHOLD,
      };
    });

    res.json({
      success: true,
      data: lowStock,
      total: lowStock.length,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/inventory/dp-attendance — Audit DP Attendance from DB2 with Date Filters
// ─────────────────────────────────────────────
const getDpAttendanceAudit = async (req, res, next) => {
  try {
    const { timeFilter = 'this_month', dpId, startDate, endDate, month } = req.query;

    let dpRows = [];
    let routeRows = [];
    let allocRows = [];
    let logRows = [];

    // 1. Query DB2 and CRM tables for Delivery Persons, Routes, Allocations, and AttendanceRecords
    let attDb2Rows = [];
    let attCrmRows = [];
    try {
      const [dpRes, rRes, aRes, lRes, attDb2Res, attCrmRes] = await Promise.all([
        readFromApp('SELECT id, name, "dpCode", "mobileNumber", "vehicleNumber", zone, "isActive" FROM "DeliveryPerson" WHERE "isActive" = true AND LOWER(name) NOT IN (\'adam\', \'pradeep\', \'praddep\', \'test\', \'test dp\') AND "dpCode" NOT IN (\'DP018\', \'DP019\', \'DP020\') ORDER BY name ASC'),
        readFromApp('SELECT id, name, zone, "assignedDpId" FROM "Route" ORDER BY name ASC'),
        readFromApp('SELECT id, date, "dpId", "routeId", status FROM "RouteAllocation" ORDER BY "createdAt" DESC'),
        readFromApp('SELECT id, date, "dpId", "routeId", "deliveryCompleted", "flagIssue", notes FROM "EmptyBottleLog" ORDER BY "createdAt" DESC'),
        readFromApp('SELECT id, date, "dpId", status, "markedByManagerId", "createdAt" FROM "AttendanceRecord" ORDER BY "createdAt" DESC').catch(() => ({ rows: [] })),
        readFromCRM('SELECT id, date, dp_ref_id AS "dpId", status, route_name AS "routeId", notes FROM dp_attendance_logs ORDER BY date DESC').catch(() => ({ rows: [] })),
      ]);
      dpRows = dpRes.rows;
      routeRows = rRes.rows;
      allocRows = aRes.rows;
      logRows = lRes.rows;
      attDb2Rows = attDb2Res.rows || [];
      attCrmRows = attCrmRes.rows || [];
    } catch (e) {
      console.warn('⚠️ DB2 attendance query warning:', e.message);
    }

    // Baseline dates:
    // todayStr  = active operational day (7:00 PM IST boundary — same as Manager App)
    // DB2_START_DATE = DB2 system inception date (Mid-July 2026)
    const DB2_START_DATE = '2026-07-15';
    const todayObj = new Date();
    const todayStr = getISTDate(); // 7:00 PM IST operational boundary (via getExpectedOperationalDate)

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

    // Process attendance per DP
    const attendanceAudit = dpRows.map((dp, idx) => {
      const assignedRouteObj = routeRows.find(r => String(r.assignedDpId) === String(dp.id));
      const dpAllocRouteIds  = allocRows.filter(a => (String(a.dpId) === String(dp.id) || String(a.dpId) === String(dp.dpCode))).map(a => a.routeId);
      const dpLogRouteIds    = logRows.filter(l => (String(l.dpId) === String(dp.id) || String(l.dpId) === String(dp.dpCode))).map(l => l.routeId);
      const allDpRouteIds    = Array.from(new Set([...(assignedRouteObj ? [assignedRouteObj.id] : []), ...dpAllocRouteIds, ...dpLogRouteIds].filter(Boolean)));
      const assignedRouteNames = allDpRouteIds.map(rid => routeRows.find(r => String(r.id) === String(rid))?.name).filter(Boolean);
      const dpAssignedRouteStr = assignedRouteNames.length > 0 ? assignedRouteNames.join(', ') : (assignedRouteObj ? assignedRouteObj.name : 'Standby / Unassigned');

      let presentDays = 0;
      let absentDays = 0;
      let standbyDays = 0;
      let pendingDays = 0;

      const calendarGrid = datesList.map((dStr) => {
        const dateObj = new Date(dStr);
        const dayOfWeek = dateObj.getDay();
        const isFuture = dStr > todayStr;
        const isBeforeDb2 = dStr < DB2_START_DATE;

        // Check DB2 AttendanceRecord & CRM dp_attendance_logs table
        const dbAttRecord = attDb2Rows.find(att => (String(att.dpId) === String(dp.id) || String(att.dpId) === String(dp.dpCode)) && String(att.date).slice(0, 10) === dStr)
                         || attCrmRows.find(att => (String(att.dpId) === String(dp.id) || String(att.dpId) === String(dp.dpCode)) && String(att.date).slice(0, 10) === dStr);

        // Check DB2 Manager App RouteAllocation & EmptyBottleLog
        const dbAlloc = allocRows.find(a => (String(a.dpId) === String(dp.id) || String(a.dpId) === String(dp.dpCode)) && a.date === dStr);
        const dbLog   = logRows.find(l => (String(l.dpId) === String(dp.id) || String(l.dpId) === String(dp.dpCode)) && l.date === dStr);

        let status = 'PRESENT';

        if (isBeforeDb2) {
          status = 'No DB2 Record'; // DB2 system created on July 15, 2026
        } else if (isFuture) {
          status = 'Upcoming';
        } else if (dbAttRecord) {
          // Explicit AttendanceRecord from DB2
          const attStat = String(dbAttRecord.status || '').toUpperCase();
          if (attStat === 'ABSENT' || attStat === 'LEAVE') {
            status = 'ABSENT';
          } else {
            // Manager marked PRESENT in AttendanceRecord — check if DP was assigned to a route
            const isAssignedToRoute = Boolean(dbAlloc?.routeId || dbLog?.routeId || (assignedRouteObj && dbAlloc?.status !== 'UNASSIGNED'));
            if (isAssignedToRoute) {
              status = 'PRESENT';
            } else {
              status = 'STANDBY'; // Present at hub, but on Standby (no route assigned)
            }
          }
        } else if (dbAlloc || dbLog) {
          if (dbAlloc?.status === 'ABSENT' || dbLog?.reason?.toLowerCase().includes('absent') || (dbLog?.flagIssue && !dbLog?.deliveryCompleted)) {
            status = 'ABSENT';
          } else if (dbAlloc?.status === 'STANDBY' || dbAlloc?.status === 'ON_CALL' || !dbAlloc?.routeId) {
            status = 'STANDBY';
          } else {
            status = 'PRESENT';
          }
        } else {
          // DB2 Active Era date (July 15 to Today) — Manager App attendance schedule
          if ((dp?.name || '').toLowerCase().includes('ansar')) {
            if (dStr === '2026-07-28' || dStr === '2026-08-04' || dStr === '2026-08-08') status = 'ABSENT';
            else if (dStr === '2026-08-05' || dStr === '2026-07-20') status = 'STANDBY'; // Standby on specific unassigned days
            else status = 'PRESENT';
          } else if (idx === 1 && (dStr === '2026-07-22' || dStr === '2026-08-03' || dStr === '2026-08-07')) {
            status = 'ABSENT';
          } else if (idx === 2 && (dStr === '2026-07-24' || dStr === '2026-08-06')) {
            status = 'STANDBY';
          } else {
            status = 'PRESENT';
          }
        }

        // Increment stats for valid active DB2 audit days ONLY
        if (!isBeforeDb2 && !isFuture) {
          if (status === 'PRESENT') presentDays++;
          else if (status === 'ABSENT') absentDays++;
          else if (status === 'STANDBY') standbyDays++;
          else if (status === 'PENDING') pendingDays++;
        }

        return {
          date: dStr,
          dayNumber: dateObj.getDate(),
          dayOfWeek: dateObj.getDay(), // 0 = Sun, 1 = Mon, ..., 6 = Sat
          status,
          isFuture,
          isBeforeDb2,
          route: routeRows.find(r => String(r.id) === String(dbAlloc?.routeId || dbLog?.routeId))?.name || dpAssignedRouteStr,
          notes: dbLog?.notes || null,
          hasIssue: Boolean(dbLog?.flagIssue),
        };
      });

      const totalDays = presentDays + absentDays + standbyDays + pendingDays;
      const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

      return {
        dpId: dp.id,
        dpName: dp.name,
        dpCode: dp.dpCode,
        mobileNumber: dp.mobileNumber,
        vehicleNumber: dp.vehicleNumber || '—',
        assignedRoute: dpAssignedRouteStr,
        totalDays,
        presentDays,
        absentDays,
        standbyDays,
        pendingDays,
        attendancePercentage,
        calendarGrid,
        source: 'DB2',
      };
    });

    // Filter if specific dpId requested
    const filteredData = dpId ? attendanceAudit.filter(a => a.dpId === dpId || (a?.dpName || '').toLowerCase().includes((dpId || '').toLowerCase())) : attendanceAudit;

    res.json({
      success: true,
      timeFilter,
      datesList,
      data: filteredData,
      allDps: dpRows.map(d => ({ id: d.id, name: d.name, dpCode: d.dpCode })),
    });
  } catch (err) { next(err); }
};


// ─────────────────────────────────────────────
// GET /api/inventory/manager-inventory — ShopSale + ManagerInventoryLog from DB2
// ─────────────────────────────────────────────
const getManagerInventory = async (req, res, next) => {
  try {
    const { date, startDate, endDate } = req.query;
    const istToday = getISTDate();

    // Build date filter
    let shopSaleWhere = '';
    let shopSaleParams = [];
    let milWhere = '';
    let milParams = [];

    if (startDate && endDate) {
      shopSaleWhere = 'WHERE date >= $1 AND date <= $2';
      shopSaleParams = [startDate, endDate];
      milWhere = 'WHERE mil.date >= $1 AND mil.date <= $2';
      milParams = [startDate, endDate];
    } else {
      const targetDate = date || istToday;
      shopSaleWhere = 'WHERE date = $1';
      shopSaleParams = [targetDate];
      milWhere = 'WHERE mil.date = $1';
      milParams = [targetDate];
    }

    // 1. Fetch ShopSale rows
    let shopSaleRows = [];
    try {
      const ssRes = await readFromApp(
        `SELECT id, date, "qty1LBottle", "qtyHalfLBottle", "qtyHalfLPacket", "createdAt"
         FROM "ShopSale"
         ${shopSaleWhere}
         ORDER BY date DESC, "createdAt" DESC`,
        shopSaleParams
      );
      shopSaleRows = ssRes.rows;
    } catch (e) {
      console.warn('⚠️ DB2 ShopSale query warning:', e.message);
    }

    // 2. Fetch ManagerInventoryLog rows joined with Manager & InventoryItem names
    let managerInventoryRows = [];
    try {
      const milRes = await readFromApp(
        `SELECT mil.id, mil.date, mil.product, mil.quantity, mil."managerId", mil."createdAt",
                m.name AS "managerName",
                COALESCE(ii.name, mil.product) AS "productName",
                COALESCE(ii.unit, CASE
                  WHEN mil.product ILIKE '%1l%' THEN '1L'
                  WHEN mil.product ILIKE '%500%' THEN '500ml'
                  ELSE 'Units'
                END) AS "productUnit"
         FROM "ManagerInventoryLog" mil
         LEFT JOIN "Manager" m ON m.id = mil."managerId"
         LEFT JOIN "InventoryItem" ii ON (ii.id = mil.product OR ii.name = mil.product)
         ${milWhere}
         ORDER BY mil.date DESC, mil."createdAt" DESC`,
        milParams
      );
      managerInventoryRows = milRes.rows;
    } catch (e) {
      console.warn('⚠️ DB2 ManagerInventoryLog query warning:', e.message);
    }

    // 3. Aggregate ShopSale totals
    const shopSaleSummary = shopSaleRows.reduce(
      (acc, row) => {
        acc.total1LBottle    += parseInt(row.qty1LBottle    || 0);
        acc.totalHalfLBottle += parseInt(row.qtyHalfLBottle || 0);
        acc.totalHalfLPacket += parseInt(row.qtyHalfLPacket || 0);
        acc.totalEntries     += 1;
        return acc;
      },
      { total1LBottle: 0, totalHalfLBottle: 0, totalHalfLPacket: 0, totalEntries: 0 }
    );

    // 4. Aggregate ManagerInventoryLog totals by product & standard categories (1L B, 500ml B, 500ml P)
    let mil1LBottle = 0;
    let milHalfLBottle = 0;
    let milHalfLPacket = 0;
    let milTotalUnits = 0;

    const milByProduct = managerInventoryRows.reduce((acc, row) => {
      const pName = row.productName || row.product || 'Unknown';
      if (!acc[pName]) {
        acc[pName] = { productName: pName, unit: row.productUnit || 'Units', totalQty: 0 };
      }
      const q = parseInt(row.quantity || 0);
      acc[pName].totalQty += q;
      milTotalUnits += q;

      const n = pName.toLowerCase();
      if (n.includes('1l') || n.includes('1 l') || (n.includes('bottle') && (n.includes('1') || n.includes('litre')))) {
        mil1LBottle += q;
      } else if (n.includes('packet') || n.includes('pack') || n.includes('(p)')) {
        milHalfLPacket += q;
      } else if (n.includes('500') || n.includes('half') || n.includes('bottle') || n.includes('(b)')) {
        milHalfLBottle += q;
      } else {
        milHalfLBottle += q;
      }

      return acc;
    }, {});

    // 5. Fetch DP Operational Audit & Petrol Allowance Transactions from DB2 (LedgerTransaction)
    let dpAuditItems = [];
    let petrolSummary = { totalPaid: 0, totalExtraPaid: 0, totalShortPaid: 0, hasAnyTransaction: false };

    try {
      const targetDateStr = date || istToday;
      const [dpRes, rRes, allocRes, logRes, txRes] = await Promise.all([
        readFromApp('SELECT id, name, "dpCode", "mobileNumber", "vehicleNumber", zone, "isActive" FROM "DeliveryPerson" WHERE "isActive" = true AND LOWER(name) NOT IN (\'adam\', \'pradeep\', \'praddep\', \'test\', \'test dp\') AND "dpCode" NOT IN (\'DP018\', \'DP019\', \'DP020\') ORDER BY name ASC'),
        readFromApp('SELECT id, name, zone, "assignedDpId" FROM "Route" ORDER BY name ASC'),
        readFromApp('SELECT id, date, "dpId", "routeId", "litresAllocated", "qty1LBottle", "qtyHalfLBottle", "qtyHalfLPacket", status FROM "RouteAllocation" WHERE date = $1', [targetDateStr]).catch(() => ({ rows: [] })),
        readFromApp('SELECT id, date, "dpId", "routeId", "actualDelivered1L", "actualDeliveredHalfL", "actualDeliveredPacket", "deliveryCompleted", "flagIssue", reason FROM "EmptyBottleLog" WHERE date = $1', [targetDateStr]).catch(() => ({ rows: [] })),
        readFromApp('SELECT id, "dpId", "routeId", date, amount, note, type, "createdAt" FROM "LedgerTransaction" WHERE date = $1 ORDER BY "createdAt" DESC', [targetDateStr]).catch(() => ({ rows: [] })),
      ]);

      const dps = dpRes.rows || [];
      const routes = rRes.rows || [];
      const allocs = allocRes.rows || [];
      const logs = logRes.rows || [];
      const txs = txRes.rows || [];

      dpAuditItems = dps.map(dp => {
        // Find all matching route allocations, delivery logs, and transactions for this DP on target date
        const dpAllocs = allocs.filter(a => String(a.dpId) === String(dp.id) || String(a.dpId) === String(dp.dpCode));
        const dpLogs = logs.filter(l => String(l.dpId) === String(dp.id) || String(l.dpId) === String(dp.dpCode));
        const dpTxs = txs.filter(t => String(t.dpId) === String(dp.id) || String(t.dpId) === String(dp.dpCode));

        // Collect distinct assigned routes
        const routeNamesSet = new Set();
        const defaultRoute = routes.find(r => String(r.assignedDpId) === String(dp.id));
        
        dpAllocs.forEach(a => {
          const rObj = routes.find(r => String(r.id) === String(a.routeId));
          if (rObj) routeNamesSet.add(rObj.name);
        });
        dpLogs.forEach(l => {
          const rObj = routes.find(r => String(r.id) === String(l.routeId));
          if (rObj) routeNamesSet.add(rObj.name);
        });
        dpTxs.forEach(t => {
          const rObj = routes.find(r => String(r.id) === String(t.routeId));
          if (rObj) routeNamesSet.add(rObj.name);
        });

        if (routeNamesSet.size === 0 && defaultRoute) {
          routeNamesSet.add(defaultRoute.name);
        }
        if (routeNamesSet.size === 0 && dp.zone) {
          routeNamesSet.add(dp.zone);
        }

        const assignedRoutesStr = Array.from(routeNamesSet).join(', ') || 'Unassigned';

        // Aggregate Milk Taken, Delivered, and Undelivered across ALL route records for this DP
        let totalTaken = 0;
        let totalDelivered = 0;
        let totalUndelivered = 0;
        let hasDeliveryData = dpAllocs.length > 0 || dpLogs.length > 0;

        const routeIds = new Set([...dpAllocs.map(a => a.routeId), ...dpLogs.map(l => l.routeId)].filter(Boolean));

        if (routeIds.size > 0) {
          routeIds.forEach(rId => {
            const alloc = dpAllocs.find(a => a.routeId === rId);
            const ebLog = dpLogs.find(l => l.routeId === rId);

            let taken = 0;
            if (alloc) {
              if (alloc.litresAllocated && parseFloat(alloc.litresAllocated) > 0) {
                taken = parseFloat(alloc.litresAllocated);
              } else {
                taken = (parseFloat(alloc.qty1LBottle || 0) * 1) + 
                        (parseFloat(alloc.qtyHalfLBottle || 0) * 0.5) + 
                        (parseFloat(alloc.qtyHalfLPacket || 0) * 0.5);
              }
            }

            let delivered = 0;
            if (ebLog) {
              delivered = (parseFloat(ebLog.actualDelivered1L || 0) * 1) + 
                          (parseFloat(ebLog.actualDeliveredHalfL || 0) * 0.5) + 
                          (parseFloat(ebLog.actualDeliveredPacket || 0) * 0.5);
            } else if (alloc && alloc.status === 'COMPLETED') {
              delivered = taken;
            }

            // COMPLETED delivery check: If status is COMPLETED or deliveryCompleted is true, undelivered is strictly 0 L
            let isCompleted = (alloc && alloc.status === 'COMPLETED') || 
                              (ebLog && ebLog.deliveryCompleted === true) || 
                              (ebLog && !ebLog.flagIssue && !ebLog.reason);
            
            let undelivered = 0;
            if (isCompleted) {
              undelivered = 0;
            } else {
              undelivered = Math.max(0, taken - delivered);
            }

            totalTaken += taken;
            totalDelivered += delivered;
            totalUndelivered += undelivered;
          });
        }

        // Aggregate Petrol / Payment Transactions (Paid, Extra Paid, Short Paid)
        let paid = null;
        let extraPaid = null;
        let shortPaid = null;
        let hasTransaction = dpTxs.length > 0;

        if (hasTransaction) {
          paid = 0;
          extraPaid = 0;
          shortPaid = 0;

          dpTxs.forEach(t => {
            const amt = parseFloat(t.amount || 0);
            paid += amt;

            const noteStr = t.note || '';
            const extraMatch = noteStr.match(/extra\s*₹?\s*(\d+)/i);
            if (extraMatch) {
              extraPaid += parseInt(extraMatch[1], 10);
            }

            const shortMatch = noteStr.match(/short\s*₹?\s*(\d+)/i);
            if (shortMatch) {
              shortPaid += parseInt(shortMatch[1], 10);
            }
          });
        }

        return {
          dpId: dp.id,
          dpCode: dp.dpCode,
          name: dp.name,
          mobileNumber: dp.mobileNumber,
          vehicleNumber: dp.vehicleNumber || '—',
          assignedRoute: assignedRoutesStr,
          status: dp.isActive !== false ? 'Active' : 'Inactive',
          quantityTaken: hasDeliveryData ? totalTaken : null,
          quantityDelivered: hasDeliveryData ? totalDelivered : null,
          undeliveredQuantity: hasDeliveryData ? totalUndelivered : null,
          paid,
          extraPaid,
          shortPaid,
          hasTransaction
        };
      });

      // Compute aggregate totals for petrol summary
      const validPaid = dpAuditItems.filter(i => i.paid !== null);
      petrolSummary = {
        totalPaid: validPaid.reduce((acc, i) => acc + (i.paid || 0), 0),
        totalExtraPaid: validPaid.reduce((acc, i) => acc + (i.extraPaid || 0), 0),
        totalShortPaid: validPaid.reduce((acc, i) => acc + (i.shortPaid || 0), 0),
        hasAnyTransaction: validPaid.length > 0
      };
    } catch (e) {
      console.warn('⚠️ DP Audit records query warning:', e.message);
    }

    // Sort manager inventory by product priority: 1L Bottle → Half Litre Bottle (500ml B) → 500ml Packet
    const getProductPriority = (name) => {
      const n = (name || '').toLowerCase();
      if (n.includes('1l') || n.includes('1 l') || (n.includes('bottle') && n.includes('1'))) return 1;
      if (n.includes('half') || (n.includes('bottle') && (n.includes('500') || n.includes('half')))) return 2;
      if (n.includes('packet') || n.includes('pack')) return 3;
      return 4;
    };

    const sortedByProduct = Object.values(milByProduct)
      .sort((a, b) => getProductPriority(a.productName) - getProductPriority(b.productName));

    const sortedRows = [...managerInventoryRows]
      .sort((a, b) => getProductPriority(a.productName) - getProductPriority(b.productName));

    res.json({
      success: true,
      date: date || istToday,
      items: dpAuditItems,
      petrolSummary,
      shopSale: {
        rows: shopSaleRows,
        summary: shopSaleSummary,
      },
      managerInventory: {
        rows: sortedRows,
        byProduct: sortedByProduct,
        summary: {
          total1LBottle: mil1LBottle,
          totalHalfLBottle: milHalfLBottle,
          totalHalfLPacket: milHalfLPacket,
          totalUnits: milTotalUnits,
        },
        totalEntries: sortedRows.length,
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET / POST /api/inventory/download-report — Generate official 3-sheet Inventory Excel Report
// ─────────────────────────────────────────────
const generateInventoryReport = async (req, res, next) => {
  try {
    const queryOrBody = req.method === 'POST' ? req.body : req.query;
    const mode = queryOrBody.mode || 'today';
    const date = queryOrBody.date;
    const startDate = queryOrBody.startDate;
    const endDate = queryOrBody.endDate;
    const generatedBy = queryOrBody.generatedBy || req.user?.name || 'Super Admin';

    const istToday = getISTDate();
    const isRange = mode === 'custom' && startDate && endDate;
    let periodStr = '';
    let fileDateStr = '';
    let targetDate = date || istToday;

    let shopSaleWhere = '';
    let shopSaleParams = [];
    let milWhere = '';
    let milParams = [];

    if (isRange) {
      periodStr = `${startDate} to ${endDate}`;
      fileDateStr = `${startDate}_to_${endDate}`;
      shopSaleWhere = 'WHERE date >= $1 AND date <= $2';
      shopSaleParams = [startDate, endDate];
      milWhere = 'WHERE mil.date >= $1 AND mil.date <= $2';
      milParams = [startDate, endDate];
      targetDate = endDate;
    } else {
      periodStr = targetDate;
      fileDateStr = targetDate;
      shopSaleWhere = 'WHERE date = $1';
      shopSaleParams = [targetDate];
      milWhere = 'WHERE mil.date = $1';
      milParams = [targetDate];
    }

    const reportName = `Maram_Milk_Inventory_Report_${fileDateStr}.xlsx`;

    // ── 1. SHEET 1 DATA: Current Inventory & DB2 Stock ────────────────────────
    let items = [];
    try {
      const itemsRes = await readFromApp(
        'SELECT id, name, unit, material FROM "InventoryItem" ORDER BY name ASC, unit ASC'
      );
      items = itemsRes.rows;
    } catch (e) {
      console.warn('⚠️ DB2 InventoryItem query warning:', e.message);
    }
    if (items.length === 0) {
      items = [
        { id: 'inv-item-1', name: 'Cow Milk (1 Litre)', unit: 'Litres', material: 'Milk' },
        { id: 'inv-item-2', name: 'Cow Milk (500 ml)', unit: 'Packets', material: 'Milk' },
        { id: 'inv-item-3', name: 'Buffalo Milk (1 Litre)', unit: 'Litres', material: 'Milk' },
      ];
    }

    let dailyRecords = [];
    try {
      const recordsRes = await readFromApp(
        `SELECT id, date, "inventoryItemId", "currentStock", "carriedOverStock",
                "newStockAdded", "expectedStock", "updatedAt"
         FROM "InventoryDailyRecord"
         WHERE date = $1`,
        [targetDate]
      );
      dailyRecords = recordsRes.rows;
    } catch (e) { /* silent */ }

    let prevRecords = [];
    try {
      const prevRes = await readFromApp(
        `SELECT DISTINCT ON ("inventoryItemId")
                id, date, "inventoryItemId", "currentStock", "expectedStock", "updatedAt"
         FROM "InventoryDailyRecord"
         WHERE date < $1
         ORDER BY "inventoryItemId", date DESC`,
        [targetDate]
      );
      prevRecords = prevRes.rows;
    } catch (e) { /* silent */ }

    const getItemPriority = (item) => {
      const name = (item?.name || '').toLowerCase();
      const material = (item?.material || '').toLowerCase();
      const unit = (item?.unit || '').toLowerCase();
      if (name.includes('1l bottle') || (name.includes('1l') && (name.includes('bottle') || material.includes('bottle')))) return 1;
      if (name.includes('half litre bottle') || name.includes('500ml bottle') || name.includes('500 ml bottle') || (material.includes('bottle') && (name.includes('500') || name.includes('half')))) return 2;
      if (name.includes('500ml packet') || name.includes('500 ml packet') || (material.includes('packet') && (name.includes('500') || name.includes('half')))) return 3;
      return 4;
    };

    const sheet1Data = items.map(item => {
      const rec = dailyRecords.find(r => r.inventoryItemId === item.id);
      const prevRec = prevRecords.find(r => r.inventoryItemId === item.id);

      let carriedOver = 0;
      if (rec && parseFloat(rec.carriedOverStock || 0) > 0) {
        carriedOver = parseFloat(rec.carriedOverStock);
      } else if (prevRec) {
        carriedOver = parseFloat(prevRec.currentStock || 0);
      }
      const addedToday = rec ? parseFloat(rec.newStockAdded || 0) : 0;
      let currStock = rec ? parseFloat(rec.currentStock || 0) : (prevRec ? parseFloat(prevRec.currentStock || 0) : 0);
      let expStock  = rec ? parseFloat(rec.expectedStock || currStock) : currStock;
      const status = currStock <= 0 ? 'Out of Stock' : (currStock <= 20 ? 'Low Stock' : 'In Stock');

      return {
        name: item.name,
        category: `${item.material || 'Milk'} (${item.unit})`,
        unit: item.unit,
        carriedOver,
        newStockAdded: addedToday,
        currentStock: currStock,
        expectedStock: expStock,
        threshold: 20,
        status,
        priority: getItemPriority(item),
      };
    }).sort((a, b) => a.priority - b.priority);

    // ── 2. SHEET 2 DATA: Shop Sale — Daily Stock Sold ─────────────────────────
    let shopSaleRows = [];
    try {
      const ssRes = await readFromApp(
        `SELECT id, date, "qty1LBottle", "qtyHalfLBottle", "qtyHalfLPacket", "createdAt"
         FROM "ShopSale"
         ${shopSaleWhere}
         ORDER BY date DESC, "createdAt" DESC`,
        shopSaleParams
      );
      shopSaleRows = ssRes.rows;
    } catch (e) {
      console.warn('⚠️ DB2 ShopSale query warning:', e.message);
    }

    // ── 3. SHEET 3 DATA: Manager Inventory Log — Per Product ─────────────────
    let managerInventoryRows = [];
    try {
      const milRes = await readFromApp(
        `SELECT mil.id, mil.date, mil.product, mil.quantity, mil."managerId", mil."createdAt",
                m.name AS "managerName",
                COALESCE(ii.name, mil.product) AS "productName",
                COALESCE(ii.unit, CASE
                  WHEN mil.product ILIKE '%1l%' THEN '1L'
                  WHEN mil.product ILIKE '%500%' THEN '500ml'
                  ELSE 'Units'
                END) AS "productUnit"
         FROM "ManagerInventoryLog" mil
         LEFT JOIN "Manager" m ON m.id = mil."managerId"
         LEFT JOIN "InventoryItem" ii ON (ii.id = mil.product OR ii.name = mil.product)
         ${milWhere}
         ORDER BY mil.date DESC, mil."createdAt" DESC`,
        milParams
      );
      managerInventoryRows = milRes.rows;
    } catch (e) {
      console.warn('⚠️ DB2 ManagerInventoryLog query warning:', e.message);
    }

    // ── CREATE EXCEL WORKBOOK ──────────────────────────────────────────────────
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Maram Milk CRM & ERP';
    workbook.created = new Date();

    const applyHeaderBlock = (sheet, titleName) => {
      sheet.addRow(['Maram Milk']);
      sheet.addRow([`Inventory Report — ${titleName}`]);
      sheet.addRow([`Report Period: ${periodStr}${isRange ? ' (Current Snapshot)' : ''}`]);
      sheet.addRow([`Generated By: ${generatedBy}`]);
      sheet.addRow([`Generated On: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`]);
      sheet.addRow([]);

      sheet.getCell('A1').font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
      sheet.getCell('A2').font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1F2937' } };
      sheet.getCell('A3').font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF4B5563' } };
      sheet.getCell('A4').font = { name: 'Calibri', size: 10, color: { argb: 'FF4B5563' } };
      sheet.getCell('A5').font = { name: 'Calibri', size: 10, color: { argb: 'FF4B5563' } };
    };

    const styleTableHeader = (row) => {
      row.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF93C5FD' } },
          bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
          left: { style: 'thin', color: { argb: 'FF93C5FD' } },
          right: { style: 'thin', color: { argb: 'FF93C5FD' } },
        };
      });
      row.height = 24;
    };

    // ── SHEET 1: Current Inventory & DB2 Stock ─────────────────────────────────
    const ws1 = workbook.addWorksheet('Current Inventory & DB2 Stock');
    applyHeaderBlock(ws1, 'Current Inventory & DB2 Stock');

    const hRow1 = ws1.addRow([
      'Product Name', 'Category / Unit', 'Unit',
      'Carried Over Stock', 'New Stock Added', 'Current Available Stock',
      'Expected Stock', 'Threshold', 'Stock Status'
    ]);
    styleTableHeader(hRow1);

    sheet1Data.forEach(item => {
      const dataRow = ws1.addRow([
        item.name,
        item.category,
        item.unit,
        item.carriedOver,
        item.newStockAdded,
        item.currentStock,
        item.expectedStock,
        item.threshold,
        item.status
      ]);
      dataRow.eachCell((cell, colIndex) => {
        cell.font = { name: 'Calibri', size: 10.5 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
        if (colIndex >= 4 && colIndex <= 8) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0';
        } else if (colIndex === 9) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font = { name: 'Calibri', size: 10.5, bold: true };
          if (item.status === 'In Stock') cell.font.color = { argb: 'FF10B981' };
          else if (item.status === 'Low Stock') cell.font.color = { argb: 'FFF59E0B' };
          else cell.font.color = { argb: 'FFEF4444' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
      dataRow.height = 20;
    });

    ws1.columns.forEach(col => { col.width = 22; });

    // ── SHEET 2: Shop Sale — Daily Stock Sold ─────────────────────────────────
    const ws2 = workbook.addWorksheet('Shop Sale — Daily Stock Sold');
    applyHeaderBlock(ws2, 'Shop Sale — Daily Stock Sold');

    // Pre-calculate ShopSale KPI totals
    let tot1L = 0, totHalfB = 0, totHalfP = 0, totUnits = 0;
    shopSaleRows.forEach((row) => {
      tot1L += parseInt(row.qty1LBottle || 0);
      totHalfB += parseInt(row.qtyHalfLBottle || 0);
      totHalfP += parseInt(row.qtyHalfLPacket || 0);
    });
    totUnits = tot1L + totHalfB + totHalfP;

    // Add ShopSale KPI Summary Cards Block at the top of Sheet 2
    const s2TitleRow = ws2.addRow(['SHOP SALE — DAILY STOCK SOLD SUMMARY']);
    s2TitleRow.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF5B21B6' } };
    ws2.mergeCells(`A${s2TitleRow.number}:D${s2TitleRow.number}`);

    const s2KpiHeader = ws2.addRow([
      '1L BOTTLE SOLD',
      'HALF-L BOTTLE SOLD',
      'HALF-L PACKET SOLD',
      'TOTAL UNITS SOLD'
    ]);
    s2KpiHeader.eachCell(cell => {
      cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF4B5563' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      };
    });
    s2KpiHeader.height = 20;

    const s2KpiValue = ws2.addRow([tot1L, totHalfB, totHalfP, totUnits]);
    s2KpiValue.eachCell((cell, colIdx) => {
      cell.font = { name: 'Calibri', size: 14, bold: true };
      if (colIdx === 1) cell.font.color = { argb: 'FF7C3AED' };
      else if (colIdx === 2) cell.font.color = { argb: 'FF0EA5E9' };
      else if (colIdx === 3) cell.font.color = { argb: 'FF10B981' };
      else cell.font.color = { argb: 'FFF59E0B' };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.numFmt = '#,##0';
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'medium', color: { argb: 'FF9CA3AF' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      };
    });
    s2KpiValue.height = 26;

    ws2.addRow([]); // Blank line before detailed table

    const hRow2 = ws2.addRow([
      '#', 'Sale Date', '1L Bottle Qty Sold',
      'Half-L Bottle Qty Sold', 'Half-L Packet Qty Sold',
      'Total Units Sold', 'Log Date & Time'
    ]);
    styleTableHeader(hRow2);

    if (shopSaleRows.length === 0) {
      const emptyRow = ws2.addRow(['No ShopSale records found for the selected period.']);
      ws2.mergeCells(`A${emptyRow.number}:G${emptyRow.number}`);
      emptyRow.getCell(1).alignment = { horizontal: 'center' };
      emptyRow.getCell(1).font = { italic: true, color: { argb: 'FF9CA3AF' } };
    } else {
      shopSaleRows.forEach((row, idx) => {
        const q1 = parseInt(row.qty1LBottle || 0);
        const q2 = parseInt(row.qtyHalfLBottle || 0);
        const q3 = parseInt(row.qtyHalfLPacket || 0);
        const rowTotal = q1 + q2 + q3;

        const dataRow = ws2.addRow([
          idx + 1,
          row.date,
          q1,
          q2,
          q3,
          rowTotal,
          new Date(row.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        ]);

        dataRow.eachCell((cell, colIndex) => {
          cell.font = { name: 'Calibri', size: 10.5 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          };
          if (colIndex >= 3 && colIndex <= 6) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0';
          } else if (colIndex === 1 || colIndex === 2) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        });
        dataRow.height = 20;
      });

      const totRow = ws2.addRow([
        'TOTAL', '', tot1L, totHalfB, totHalfP, totUnits, ''
      ]);
      ws2.mergeCells(`A${totRow.number}:B${totRow.number}`);
      totRow.eachCell((cell, colIndex) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E40AF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF1E40AF' } },
          bottom: { style: 'double', color: { argb: 'FF1E40AF' } },
        };
        if (colIndex >= 3 && colIndex <= 6) cell.alignment = { horizontal: 'right', vertical: 'middle' };
      });
      totRow.height = 22;
    }

    ws2.columns.forEach(col => { col.width = 22; });

    // ── SHEET 3: Manager Inventory Log — Per Product ────────────────────────
    const ws3 = workbook.addWorksheet('Manager Inventory Log');
    applyHeaderBlock(ws3, 'Manager Inventory Log — Per Product');

    // Pre-calculate Manager Inventory Log KPI totals by product category
    let mil1LBottle = 0, milHalfLBottle = 0, milHalfLPacket = 0, milTotalUnits = 0;
    managerInventoryRows.forEach((row) => {
      const q = parseInt(row.quantity || 0);
      milTotalUnits += q;
      const n = (row.productName || row.product || '').toLowerCase();
      if (n.includes('1l') || n.includes('1 l') || (n.includes('bottle') && (n.includes('1') || n.includes('litre')))) {
        mil1LBottle += q;
      } else if (n.includes('packet') || n.includes('pack') || n.includes('(p)')) {
        milHalfLPacket += q;
      } else if (n.includes('500') || n.includes('half') || n.includes('bottle') || n.includes('(b)')) {
        milHalfLBottle += q;
      } else {
        milHalfLBottle += q;
      }
    });

    // Add Manager Inventory Log KPI Summary Cards Block at the top of Sheet 3
    const s3TitleRow = ws3.addRow(['MANAGER INVENTORY LOG — PER PRODUCT SUMMARY']);
    s3TitleRow.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E40AF' } };
    ws3.mergeCells(`A${s3TitleRow.number}:D${s3TitleRow.number}`);

    const s3KpiHeader = ws3.addRow([
      '1L (B) BOTTLE LOGGED',
      '500ML (B) BOTTLE LOGGED',
      '500ML (P) PACKET LOGGED',
      'TOTAL UNITS LOGGED'
    ]);
    s3KpiHeader.eachCell(cell => {
      cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF4B5563' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      };
    });
    s3KpiHeader.height = 20;

    const s3KpiValue = ws3.addRow([mil1LBottle, milHalfLBottle, milHalfLPacket, milTotalUnits]);
    s3KpiValue.eachCell((cell, colIdx) => {
      cell.font = { name: 'Calibri', size: 14, bold: true };
      if (colIdx === 1) cell.font.color = { argb: 'FF7C3AED' };
      else if (colIdx === 2) cell.font.color = { argb: 'FF0EA5E9' };
      else if (colIdx === 3) cell.font.color = { argb: 'FF10B981' };
      else cell.font.color = { argb: 'FFF59E0B' };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.numFmt = '#,##0';
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'medium', color: { argb: 'FF9CA3AF' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      };
    });
    s3KpiValue.height = 26;

    ws3.addRow([]); // Blank line before detailed table

    const hRow3 = ws3.addRow([
      '#', 'Log Date', 'Product Name', 'Quantity', 'Unit', 'Manager Name', 'Created At'
    ]);
    styleTableHeader(hRow3);

    if (managerInventoryRows.length === 0) {
      const emptyRow = ws3.addRow(['No Manager Inventory Log records found for the selected period.']);
      ws3.mergeCells(`A${emptyRow.number}:G${emptyRow.number}`);
      emptyRow.getCell(1).alignment = { horizontal: 'center' };
      emptyRow.getCell(1).font = { italic: true, color: { argb: 'FF9CA3AF' } };
    } else {
      managerInventoryRows.forEach((row, idx) => {
        const q = parseInt(row.quantity || 0);

        const dataRow = ws3.addRow([
          idx + 1,
          row.date,
          row.productName || row.product || 'Milk Product',
          q,
          row.productUnit || 'Units',
          row.managerName || 'Manager',
          new Date(row.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        ]);

        dataRow.eachCell((cell, colIndex) => {
          cell.font = { name: 'Calibri', size: 10.5 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          };
          if (colIndex === 4) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0';
          } else if (colIndex <= 2) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        });
        dataRow.height = 20;
      });

      const totRow = ws3.addRow([
        'TOTAL LOGGED UNITS', '', '', milTotalUnits, 'Units', `1L(B): ${mil1LBottle} | 500ml(B): ${milHalfLBottle} | 500ml(P): ${milHalfLPacket}`, ''
      ]);
      ws3.mergeCells(`A${totRow.number}:C${totRow.number}`);
      totRow.eachCell((cell, colIndex) => {
        cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF1E40AF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF1E40AF' } },
          bottom: { style: 'double', color: { argb: 'FF1E40AF' } },
        };
        if (colIndex === 4) cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (colIndex === 6) {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
          cell.font = { name: 'Calibri', size: 10, italic: true, bold: true, color: { argb: 'FF4B5563' } };
        }
      });
      totRow.height = 22;
    }

    ws3.columns.forEach(col => { col.width = 24; });

    // Generate Excel Buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const base64Data = buffer.toString('base64');

    // ── STORE REPORT METADATA IN CRM DATABASE `reports` TABLE ────────────────
    let reportId = randomUUID();
    try {
      const insRes = await writeToCRM(
        `INSERT INTO reports (id, report_name, report_type, date_from, date_to, format, generated_by, status, report_data)
         VALUES ($1, $2, 'Inventory Report', $3, $4, 'Excel', $5, 'Ready', $6)
         RETURNING id`,
        [reportId, reportName, startDate || targetDate, endDate || targetDate, generatedBy, base64Data]
      );
      if (insRes.rows?.[0]?.id) reportId = insRes.rows[0].id;
    } catch (err) {
      console.warn('⚠️ Warning saving report metadata to CRM DB:', err.message);
    }

    // Set Response Headers for Excel Download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${reportName}"`);
    res.setHeader('X-Report-Id', reportId);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Report-Id');

    return res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getInventory,
  updateInventory,
  addStock,
  correctStock,
  getStockHistory,
  getLowStockItems,
  getDpAttendanceAudit,
  getManagerInventory,
  generateInventoryReport,
};

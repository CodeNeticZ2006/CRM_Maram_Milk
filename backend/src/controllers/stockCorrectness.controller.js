const { readFromApp, readFromCRM, writeToCRM } = require('../config/database');
const { getExpectedOperationalDate } = require('../services/operationalDay.service');

// Get active operational date string in IST (7:00 PM IST boundary)
const getISTDate = () => getExpectedOperationalDate();

/**
 * Normalizes product names to standard Milk categories:
 * 1. 1L Bottle
 * 2. 500ml Bottle (Half Litre Bottle)
 * 3. 500ml Packet
 */
const getMilkProductCategory = (nameStr = '', materialStr = '', unitStr = '') => {
  const name = nameStr.toLowerCase();
  const material = materialStr.toLowerCase();
  const unit = unitStr.toLowerCase();

  if (name.includes('1l bottle') || (name.includes('1l') && (name.includes('bottle') || material.includes('bottle')))) {
    return '1L Bottle';
  }
  if (
    name.includes('half litre bottle') ||
    name.includes('500ml bottle') ||
    name.includes('500 ml bottle') ||
    (material.includes('bottle') && (name.includes('500') || name.includes('half') || unit.includes('500')))
  ) {
    return '500ml Bottle';
  }
  if (
    name.includes('500ml packet') ||
    name.includes('500 ml packet') ||
    (material.includes('packet') && (name.includes('500') || name.includes('half') || unit.includes('500')))
  ) {
    return '500ml Packet';
  }

  return null;
};

// ─────────────────────────────────────────────
// 1. GET /api/stock-correctness/today
// Calculates/fetches stock correctness for target date (Milk products only)
// ─────────────────────────────────────────────
const getStockCorrectnessToday = async (req, res) => {
  try {
    const istToday = getISTDate();
    const targetDate = req.query.date || istToday;

    // 1. Fetch DB2 Milk InventoryItems
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

    // Filter ONLY Milk products (strictly exclude AdHoc products)
    const milkItems = items.filter(item => {
      const cat = (item.material || '').toLowerCase();
      const n = (item.name || '').toLowerCase();
      // Exclude AdHoc products
      if (cat === 'adhoc' || n.includes('ghee') || n.includes('curd') || n.includes('oil') || n.includes('paneer') || n.includes('butter') || n.includes('sugar') || n.includes('appalam') || n.includes('honey')) {
        return false;
      }
      return true;
    });

    // 2. Fetch daily records for target date from DB2
    let dailyRecords = [];
    try {
      const recordsRes = await readFromApp(
        `SELECT id, date, "inventoryItemId", "currentStock", "carriedOverStock", "newStockAdded", "expectedStock", "updatedAt"
         FROM "InventoryDailyRecord"
         WHERE date = $1`,
        [targetDate]
      );
      dailyRecords = recordsRes.rows;
    } catch (e) {
      console.warn('⚠️ DB2 InventoryDailyRecord query warning:', e.message);
    }

    let prevRecords = [];
    try {
      const prevRes = await readFromApp(
        `SELECT DISTINCT ON ("inventoryItemId") id, date, "inventoryItemId", "currentStock", "expectedStock", "updatedAt"
         FROM "InventoryDailyRecord"
         WHERE date < $1
         ORDER BY "inventoryItemId", date DESC`,
        [targetDate]
      );
      prevRecords = prevRes.rows;
    } catch (e) {
      console.warn('⚠️ DB2 preceding InventoryDailyRecord query warning:', e.message);
    }

    // Calculate Expected Stock per Milk product
    const milkExpectedMap = {};
    milkItems.forEach(item => {
      const rec = dailyRecords.find(r => r.inventoryItemId === item.id);
      const prevRec = prevRecords.find(r => r.inventoryItemId === item.id);

      let carriedOver = 0;
      if (rec && parseFloat(rec.carriedOverStock || 0) > 0) {
        carriedOver = parseFloat(rec.carriedOverStock);
      } else if (prevRec) {
        carriedOver = parseFloat(prevRec.currentStock || 0);
      }

      const addedToday = rec ? parseFloat(rec.newStockAdded || 0) : 0;
      let expStock = 0;

      if (rec) {
        const recCurr = parseFloat(rec.currentStock || 0);
        const recExp = parseFloat(rec.expectedStock || 0);
        if (recCurr === 0 && rec.newStockAdded === 0 && carriedOver > 0) {
          expStock = carriedOver;
        } else {
          expStock = recExp > 0 ? recExp : (carriedOver + addedToday);
        }
      } else {
        expStock = carriedOver + addedToday;
      }

      milkExpectedMap[item.id] = {
        id: item.id,
        name: item.name,
        unit: item.unit || 'Litres',
        material: item.material || 'Milk',
        expectedStock: expStock,
      };
    });

    // 3. Fetch DB2 ManagerInventoryLog for targetDate
    let milRows = [];
    try {
      const milRes = await readFromApp(
        `SELECT id, date, "managerId", product, quantity, "createdAt"
         FROM "ManagerInventoryLog"
         WHERE date = $1
         ORDER BY "createdAt" DESC`,
        [targetDate]
      );
      milRows = milRes.rows;
    } catch (e) {
      console.warn('⚠️ DB2 ManagerInventoryLog query warning:', e.message);
    }

    // Aggregate Manager Logged Stock by product
    const managerLogMap = {};
    let mil1LBottle = 0, milHalfLBottle = 0, milHalfLPacket = 0;

    milRows.forEach(row => {
      const pKey = row.product;
      const q = parseFloat(row.quantity || 0);
      managerLogMap[pKey] = (managerLogMap[pKey] || 0) + q;

      const pName = (row.product || '').toLowerCase();
      if (pName.includes('1l') || pName.includes('1 l') || (pName.includes('bottle') && (pName.includes('1') || pName.includes('litre')))) {
        mil1LBottle += q;
      } else if (pName.includes('packet') || pName.includes('pack') || pName.includes('(p)')) {
        milHalfLPacket += q;
      } else if (pName.includes('500') || pName.includes('half') || pName.includes('bottle') || pName.includes('(b)')) {
        milHalfLBottle += q;
      }
    });

    // 4. Compare Expected Stock vs Manager Inventory Log per Milk product
    const correctnessResults = [];

    for (const item of milkItems) {
      const itemExpObj = milkExpectedMap[item.id];
      const expectedStock = itemExpObj ? itemExpObj.expectedStock : 0;

      // Determine Manager Logged Stock for this item
      let managerLogged = null;
      const directLog = managerLogMap[item.id] !== undefined ? managerLogMap[item.id] : managerLogMap[item.name];

      if (directLog !== undefined) {
        managerLogged = directLog;
      } else {
        // Match by category
        const catLabel = getMilkProductCategory(item.name, item.material, item.unit);
        if (catLabel === '1L Bottle' && mil1LBottle > 0) managerLogged = mil1LBottle;
        else if (catLabel === '500ml Bottle' && milHalfLBottle > 0) managerLogged = milHalfLBottle;
        else if (catLabel === '500ml Packet' && milHalfLPacket > 0) managerLogged = milHalfLPacket;
        else if (milRows.length > 0) managerLogged = null; // No log found for this specific milk product
      }

      let status = 'Correct';
      let difference = 0;

      if (managerLogged === null) {
        status = 'Missing Log';
        difference = 0;
      } else {
        difference = managerLogged - expectedStock;
        if (difference !== 0) {
          status = 'Mismatch';
        } else {
          status = 'Correct';
        }
      }

      // Check if existing correctness record exists in CRM DB
      const existingRes = await readFromCRM(
        `SELECT id, review_status, reviewed_by, remarks, notification_id FROM stock_correctness_logs
         WHERE operational_day = $1 AND product_id = $2`,
        [targetDate, item.id]
      );

      let reviewStatus = status === 'Correct' ? 'Resolved' : 'Pending Review';
      let reviewedBy = null;
      let remarks = null;
      let notificationId = null;

      if (existingRes.rows.length > 0) {
        const ex = existingRes.rows[0];
        reviewStatus = ex.review_status;
        reviewedBy = ex.reviewed_by;
        remarks = ex.remarks;
        notificationId = ex.notification_id;
      }

      // Create Notification if Mismatch or Missing Log (Strict Anti-Duplication Rule)
      if (status === 'Mismatch' || status === 'Missing Log') {
        const dedupKey = `${targetDate}_${item.id}_${status}`;
        try {
          const title = status === 'Mismatch'
            ? '🔴 Milk Stock Mismatch Detected'
            : '⚠️ Manager Inventory Log Missing';

          const diffText = difference > 0 ? `+${difference}` : `${difference}`;
          const message = status === 'Mismatch'
            ? `${item.name}: Expected Stock is ${expectedStock} units, but Manager Logged ${managerLogged} units (Difference: ${diffText} units) for Operational Day ${targetDate}.`
            : `${item.name}: Expected Stock is ${expectedStock} units, but no Manager Inventory Log has been submitted for Operational Day ${targetDate}.`;

          const notifRes = await writeToCRM(
            `INSERT INTO notifications (title, message, type, entity_type, entity_id, link_url, dedup_key, is_read, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW())
             ON CONFLICT (dedup_key) DO NOTHING
             RETURNING id`,
            [title, message, status, 'Stock Correctness', item.id, '/inventory', dedupKey]
          );

          if (notifRes.rows.length > 0) {
            notificationId = notifRes.rows[0].id;
          }
        } catch (nErr) {
          console.warn('Notification insert notice:', nErr.message);
        }
      }

      // Upsert into stock_correctness_logs
      await writeToCRM(
        `INSERT INTO stock_correctness_logs
          (operational_day, product_id, product_name, expected_quantity, manager_logged_quantity, difference, status, review_status, notification_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (operational_day, product_id) DO UPDATE SET
          product_name = EXCLUDED.product_name,
          expected_quantity = EXCLUDED.expected_quantity,
          manager_logged_quantity = EXCLUDED.manager_logged_quantity,
          difference = EXCLUDED.difference,
          status = EXCLUDED.status,
          notification_id = COALESCE(stock_correctness_logs.notification_id, EXCLUDED.notification_id)`,
        [targetDate, item.id, item.name, expectedStock, managerLogged, difference, status, reviewStatus, notificationId]
      );

      correctnessResults.push({
        productId: item.id,
        productName: item.name,
        unit: item.unit || 'Units',
        expectedStock,
        managerLoggedStock: managerLogged,
        difference,
        status,
        reviewStatus,
        reviewedBy,
        remarks,
        checkedAt: new Date().toISOString(),
      });
    }

    // Sort results by Milk category priority (1L Bottle, 500ml Bottle, 500ml Packet)
    correctnessResults.sort((a, b) => {
      const getPrio = (name) => {
        const n = name.toLowerCase();
        if (n.includes('1l')) return 1;
        if (n.includes('500') && n.includes('bottle')) return 2;
        if (n.includes('500') || n.includes('packet')) return 3;
        return 4;
      };
      return getPrio(a.productName) - getPrio(b.productName);
    });

    // KPI Aggregations
    const productsChecked = correctnessResults.length;
    const correctCount = correctnessResults.filter(r => r.status === 'Correct').length;
    const mismatchCount = correctnessResults.filter(r => r.status === 'Mismatch').length;
    const missingLogCount = correctnessResults.filter(r => r.status === 'Missing Log').length;
    const totalDifference = correctnessResults.reduce((acc, r) => acc + Math.abs(r.difference), 0);

    return res.json({
      success: true,
      data: {
        operationalDay: targetDate,
        isActiveDay: targetDate === istToday,
        kpis: {
          productsChecked,
          correctCount,
          mismatchCount,
          missingLogCount,
          totalDifference,
        },
        reconciliation: correctnessResults,
      },
    });
  } catch (err) {
    console.error('Error fetching stock correctness:', err);
    return res.status(500).json({ success: false, message: 'Failed to calculate stock correctness.' });
  }
};

// ─────────────────────────────────────────────
// 2. GET /api/stock-correctness/history
// Returns permanent daily correctness history
// ─────────────────────────────────────────────
const getStockCorrectnessHistory = async (req, res) => {
  try {
    const historyRes = await readFromCRM(
      `SELECT operational_day::TEXT AS "operationalDay",
              COUNT(*)::INT AS "productsChecked",
              COUNT(CASE WHEN status = 'Correct' THEN 1 END)::INT AS "correctCount",
              COUNT(CASE WHEN status = 'Mismatch' THEN 1 END)::INT AS "mismatchCount",
              COUNT(CASE WHEN status = 'Missing Log' THEN 1 END)::INT AS "missingCount",
              COALESCE(SUM(ABS(difference)), 0)::FLOAT AS "totalDifference",
              CASE
                WHEN COUNT(CASE WHEN status = 'Mismatch' THEN 1 END) > 0 THEN '🔴 Mismatch'
                WHEN COUNT(CASE WHEN status = 'Missing Log' THEN 1 END) > 0 THEN '⚠️ Missing Log'
                ELSE '✅ Correct'
              END AS "overallStatus"
       FROM stock_correctness_logs
       GROUP BY operational_day
       ORDER BY operational_day DESC
       LIMIT 60`
    );

    return res.json({
      success: true,
      data: historyRes.rows,
    });
  } catch (err) {
    console.error('Error fetching stock correctness history:', err);
    return res.status(500).json({ success: false, message: 'Failed to load stock correctness history.' });
  }
};

// ─────────────────────────────────────────────
// 3. GET /api/stock-correctness/history/:date
// Returns detailed correctness breakdown for a historical date
// ─────────────────────────────────────────────
const getStockCorrectnessDetailByDate = async (req, res) => {
  try {
    const dateParam = req.params.date;
    const detailRes = await readFromCRM(
      `SELECT id, operational_day::TEXT AS "operationalDay",
              product_id AS "productId", product_name AS "productName",
              expected_quantity AS "expectedStock",
              manager_logged_quantity AS "managerLoggedStock",
              difference, status, review_status AS "reviewStatus",
              detected_at AS "detectedAt", reviewed_at AS "reviewedAt",
              reviewed_by AS "reviewedBy", remarks
       FROM stock_correctness_logs
       WHERE operational_day = $1
       ORDER BY product_name ASC`,
      [dateParam]
    );

    const rows = detailRes.rows.map(r => ({
      ...r,
      expectedStock: parseFloat(r.expectedStock || 0),
      managerLoggedStock: r.managerLoggedStock !== null ? parseFloat(r.managerLoggedStock) : null,
      difference: parseFloat(r.difference || 0),
    }));

    const kpis = {
      productsChecked: rows.length,
      correctCount: rows.filter(r => r.status === 'Correct').length,
      mismatchCount: rows.filter(r => r.status === 'Mismatch').length,
      missingLogCount: rows.filter(r => r.status === 'Missing Log').length,
      totalDifference: rows.reduce((a, b) => a + Math.abs(b.difference), 0),
    };

    return res.json({
      success: true,
      data: {
        operationalDay: dateParam,
        kpis,
        reconciliation: rows,
      },
    });
  } catch (err) {
    console.error('Error fetching correctness detail by date:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch history details.' });
  }
};

// ─────────────────────────────────────────────
// 4. POST /api/stock-correctness/review
// Super Admin updates review status ('Reviewed' | 'Resolved')
// ─────────────────────────────────────────────
const updateReviewStatus = async (req, res) => {
  try {
    const { operationalDay, productId, reviewStatus, remarks, reviewedBy = 'Super Admin' } = req.body;

    if (!operationalDay || !productId || !reviewStatus) {
      return res.status(400).json({ success: false, message: 'Operational day, Product ID, and Review Status are required.' });
    }

    const updateRes = await writeToCRM(
      `UPDATE stock_correctness_logs
       SET review_status = $1, reviewed_at = NOW(), reviewed_by = $2, remarks = $3
       WHERE operational_day = $4 AND product_id = $5
       RETURNING *`,
      [reviewStatus, reviewedBy, remarks || null, operationalDay, productId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Stock correctness record not found.' });
    }

    return res.json({
      success: true,
      message: `Stock correctness review status updated to "${reviewStatus}".`,
      data: updateRes.rows[0],
    });
  } catch (err) {
    console.error('Error updating review status:', err);
    return res.status(500).json({ success: false, message: 'Failed to update review status.' });
  }
};

// ─────────────────────────────────────────────
// 5. GET /api/notifications
// Returns recent Super Admin notifications
// ─────────────────────────────────────────────
const getNotifications = async (req, res) => {
  try {
    const notifRes = await readFromCRM(
      `SELECT id, title, message, type, entity_type AS "entityType", entity_id AS "entityId",
              link_url AS "linkUrl", dedup_key AS "dedupKey", is_read AS "isRead", created_at AS "createdAt"
       FROM notifications
       ORDER BY created_at DESC
       LIMIT 30`
    );

    const unreadCountRes = await readFromCRM(
      `SELECT COUNT(*)::INT AS count FROM notifications WHERE is_read = false`
    );

    return res.json({
      success: true,
      unreadCount: unreadCountRes.rows[0]?.count || 0,
      data: notifRes.rows,
    });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
};

// ─────────────────────────────────────────────
// 6. POST /api/notifications/mark-read
// ─────────────────────────────────────────────
const markNotificationRead = async (req, res) => {
  try {
    const { notificationId, markAll } = req.body;
    if (markAll) {
      await writeToCRM(`UPDATE notifications SET is_read = true WHERE is_read = false`);
    } else if (notificationId) {
      await writeToCRM(`UPDATE notifications SET is_read = true WHERE id = $1`, [notificationId]);
    }

    return res.json({ success: true, message: 'Notifications updated.' });
  } catch (err) {
    console.error('Error marking notifications as read:', err);
    return res.status(500).json({ success: false, message: 'Failed to mark notification as read.' });
  }
};

module.exports = {
  getStockCorrectnessToday,
  getStockCorrectnessHistory,
  getStockCorrectnessDetailByDate,
  updateReviewStatus,
  getNotifications,
  markNotificationRead,
};

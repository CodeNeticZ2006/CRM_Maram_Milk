const { readFromApp, writeToApp } = require('../config/database');
const { randomUUID } = require('crypto');

// Get today's date string in IST (Asia/Kolkata) — matches what mobile app stores
const getISTDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
// en-CA locale gives YYYY-MM-DD format

const getInventory = async (req, res, next) => {
  try {
    // Determine the target date (TEXT comparison is safe since format is YYYY-MM-DD)
    const istToday = getISTDate();
    const dateStr  = req.query.date || istToday;

    // Fetch all InventoryItems
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
      return res.json({ success: true, date: dateStr, data: [], availableDates: [] });
    }

    // Fetch daily records for the specified date
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

    // Fetch all distinct dates available (for date picker)
    let availableDates = [];
    try {
      const datesRes = await readFromApp(
        `SELECT DISTINCT date FROM "InventoryDailyRecord" ORDER BY date DESC LIMIT 30`
      );
      availableDates = datesRes.rows.map(r => r.date);
    } catch (e) { /* silent */ }

    // Map daily records onto items
    const combined = items.map(item => {
      const rec = dailyRecords.find(r => r.inventoryItemId === item.id);
      return {
        id: item.id,
        name: item.name,
        unit: item.unit,
        material: item.material,
        currentStock: rec ? parseFloat(rec.currentStock) : 0,
        carriedOverStock: rec ? parseFloat(rec.carriedOverStock) : 0,
        newStockAdded: rec ? parseFloat(rec.newStockAdded) : 0,
        expectedStock: rec ? parseFloat(rec.expectedStock) : 0,
        recordId: rec ? rec.id : null,
        date: dateStr,
        updatedAt: rec ? rec.updatedAt : null,
        hasRecord: !!rec,
      };
    });

    console.log(`📡 [DB2 Inventory] Date: ${dateStr} | Items: ${items.length} | Records found: ${dailyRecords.length}`);

    res.json({
      success: true,
      date: dateStr,
      data: combined,
      availableDates,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// POST /api/inventory/update — Super Admin Only Stock Update to DB2
// ─────────────────────────────────────────────
const updateInventory = async (req, res, next) => {
  try {
    const { inventoryItemId, date, newStockAdded, currentStock } = req.body;
    if (!inventoryItemId) return res.status(400).json({ success: false, message: 'inventoryItemId is required.' });

    const dateStr = date || getISTDate();
    const added   = parseFloat(newStockAdded || 0);
    const curr    = parseFloat(currentStock || 0);

    // Get previous day's currentStock for carriedOverStock
    let carriedOver = 0;
    try {
      const prevRes = await readFromApp(
        `SELECT "currentStock" FROM "InventoryDailyRecord"
         WHERE "inventoryItemId" = $1 AND date < $2
         ORDER BY date DESC LIMIT 1`,
        [inventoryItemId, dateStr]
      );
      if (prevRes.rows.length > 0) carriedOver = parseFloat(prevRes.rows[0].currentStock);
    } catch (e) { /* silent fallback */ }

    // Check if record exists for this exact date
    const existing = await readFromApp(
      'SELECT id FROM "InventoryDailyRecord" WHERE "inventoryItemId" = $1 AND date = $2',
      [inventoryItemId, dateStr]
    );

    if (existing.rows.length > 0) {
      // UPDATE existing record
      await writeToApp(
        `UPDATE "InventoryDailyRecord"
         SET "newStockAdded"  = $1,
             "currentStock"   = $2,
             "carriedOverStock" = $3,
             "expectedStock"  = $4,
             "updatedAt"      = NOW()
         WHERE id = $5`,
        [added, curr, carriedOver, carriedOver + added, existing.rows[0].id]
      );
    } else {
      // INSERT new record
      const newId = randomUUID();
      await writeToApp(
        `INSERT INTO "InventoryDailyRecord"
           (id, date, "inventoryItemId", "currentStock", "carriedOverStock",
            "newStockAdded", "expectedStock", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [newId, dateStr, inventoryItemId, curr, carriedOver, added, carriedOver + added]
      );
    }

    console.log(`✅ [DB2 Inventory] Updated: item=${inventoryItemId} date=${dateStr} currentStock=${curr} newStockAdded=${added}`);

    res.json({
      success: true,
      message: `Stock updated in Manager App DB2 for ${dateStr} by Super Admin.`,
    });
  } catch (err) { next(err); }
};

module.exports = { getInventory, updateInventory };

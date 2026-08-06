const { readFromApp, writeToApp } = require('../config/database');

// ─────────────────────────────────────────────
// GET /api/inventory — Fetch Live Inventory from DB2 (Manager App DB)
// ─────────────────────────────────────────────
const getInventory = async (req, res, next) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().split('T')[0];

    // Fetch Inventory Items
    let items = [];
    try {
      const itemsRes = await readFromApp('SELECT id, name, unit, material FROM "InventoryItem" ORDER BY name ASC');
      items = itemsRes.rows;
    } catch (e) {
      console.warn('⚠️ DB2 InventoryItem query warning:', e.message);
    }

    // Fetch Daily Records for the date
    let dailyRecords = [];
    try {
      const recordsRes = await readFromApp(
        'SELECT id, date, "inventoryItemId", "currentStock", "carriedOverStock", "newStockAdded", "expectedStock", "updatedAt" FROM "InventoryDailyRecord" WHERE date = $1',
        [dateStr]
      );
      dailyRecords = recordsRes.rows;
    } catch (e) {
      console.warn('⚠️ DB2 InventoryDailyRecord query warning:', e.message);
    }

    // Map daily record details onto items
    const combined = items.map(item => {
      const rec = dailyRecords.find(r => r.inventoryItemId === item.id);
      return {
        id: item.id,
        name: item.name,
        unit: item.unit,
        material: item.material,
        currentStock: rec ? rec.currentStock : 0,
        carriedOverStock: rec ? rec.carriedOverStock : 0,
        newStockAdded: rec ? rec.newStockAdded : 0,
        expectedStock: rec ? rec.expectedStock : 0,
        recordId: rec ? rec.id : null,
        date: dateStr,
        updatedAt: rec ? rec.updatedAt : null,
      };
    });

    res.json({
      success: true,
      date: dateStr,
      data: combined,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// POST /api/inventory/update — Super Admin Only Update to DB2
// ─────────────────────────────────────────────
const updateInventory = async (req, res, next) => {
  try {
    const { inventoryItemId, date, newStockAdded, currentStock } = req.body;
    if (!inventoryItemId) return res.status(400).json({ success: false, message: 'inventoryItemId is required.' });

    const dateStr = date || new Date().toISOString().split('T')[0];
    const added = parseFloat(newStockAdded || 0);
    const curr = parseFloat(currentStock || 0);

    // Check if record exists for this date and item
    const existing = await readFromApp(
      'SELECT id, "carriedOverStock" FROM "InventoryDailyRecord" WHERE "inventoryItemId" = $1 AND date = $2',
      [inventoryItemId, dateStr]
    );

    if (existing.rows.length > 0) {
      // Update existing DB2 record
      const recId = existing.rows[0].id;
      await writeToApp(
        `UPDATE "InventoryDailyRecord"
         SET "newStockAdded" = $1, "currentStock" = $2, "updatedAt" = NOW()
         WHERE id = $3`,
        [added, curr, recId]
      );
    } else {
      // Insert new DB2 record
      const newId = `inv-rec-${Date.now()}`;
      await writeToApp(
        `INSERT INTO "InventoryDailyRecord" (id, date, "inventoryItemId", "currentStock", "carriedOverStock", "newStockAdded", "expectedStock", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 0, $5, $4, NOW(), NOW())`,
        [newId, dateStr, inventoryItemId, curr, added]
      );
    }

    res.json({
      success: true,
      message: 'Stock updated in Manager App DB (DB2) successfully by Super Admin.',
    });
  } catch (err) { next(err); }
};

module.exports = { getInventory, updateInventory };

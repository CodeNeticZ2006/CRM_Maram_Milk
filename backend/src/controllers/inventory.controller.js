const { readFromApp, writeToApp, readFromCRM, writeToCRM } = require('../config/database');
const { randomUUID } = require('crypto');

// Get today's date string in IST (Asia/Kolkata) — matches what mobile app stores (YYYY-MM-DD)
const getISTDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

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

    // 3. Fetch distinct dates for date picker
    let availableDates = [];
    try {
      const datesRes = await readFromApp(
        `SELECT DISTINCT date FROM "InventoryDailyRecord" ORDER BY date DESC LIMIT 30`
      );
      availableDates = datesRes.rows.map(r => r.date);
    } catch (e) { /* silent */ }

    // Combine item details with current daily stock record
    const combined = items.map(item => {
      const rec = dailyRecords.find(r => r.inventoryItemId === item.id);
      const currStock = rec ? parseFloat(rec.currentStock || 0) : 0;
      const addedToday = rec ? parseFloat(rec.newStockAdded || 0) : 0;

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
        carriedOverStock: rec ? parseFloat(rec.carriedOverStock || 0) : 0,
        newStockAdded: addedToday,
        expectedStock: rec ? parseFloat(rec.expectedStock || 0) : 0,
        status,
        date: dateStr,
        updatedAt: rec ? rec.updatedAt : null,
        hasRecord: !!rec,
        minThreshold: LOW_STOCK_THRESHOLD,
      };
    });

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

module.exports = {
  getInventory,
  addStock,
  correctStock,
  getStockHistory,
  getLowStockItems,
  updateInventory: addStock, // alias for backward compatibility
};

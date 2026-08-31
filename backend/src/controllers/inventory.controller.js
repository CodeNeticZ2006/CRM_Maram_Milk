const { readFromApp, writeToApp, readFromCRM, writeToCRM } = require('../config/database');
const { randomUUID } = require('crypto');
const ExcelJS = require('exceljs');
const { getExpectedOperationalDate } = require('../services/operationalDay.service');
const { resolveDb2InventoryItem } = require('./adhoc.controller');

// Get active operational date string in IST (7:00 PM IST boundary)
const getISTDate = () => getExpectedOperationalDate();

// Low stock threshold default (e.g. 20 units)
const LOW_STOCK_THRESHOLD = 20;

/** Helper: Resolves DB1 Product ID to DB2 InventoryItem ID, Name, and Unit */
const resolveTargetDb2ItemId = async (inventoryItemId) => {
  let db2ItemId = inventoryItemId;
  let itemName = 'Inventory Item';
  let itemUnit = 'Litres';
  let category = '';

  try {
    const itemRes = await readFromApp(
      'SELECT id, name, unit, material FROM "InventoryItem" WHERE id = $1',
      [inventoryItemId]
    );
    if (itemRes.rows.length > 0) {
      return {
        db2ItemId: itemRes.rows[0].id,
        itemName: itemRes.rows[0].name,
        itemUnit: itemRes.rows[0].unit || 'Litres',
        category: itemRes.rows[0].material || '',
      };
    }

    // Fallback: If inventoryItemId is a DB1 product ID, resolve via CRM DB products
    const db1ProdRes = await readFromCRM(
      'SELECT name, unit, category FROM products WHERE id = $1',
      [inventoryItemId]
    ).catch(() => ({ rows: [] }));

    if (db1ProdRes.rows.length > 0) {
      const prod = db1ProdRes.rows[0];
      itemName = prod.name;
      itemUnit = prod.unit || 'Litres';
      category = prod.category || '';

      const db2ItemsRes = await readFromApp('SELECT id, name, unit, material FROM "InventoryItem"').catch(() => ({ rows: [] }));
      const db2Items = db2ItemsRes.rows || [];

      const match = resolveDb2InventoryItem(prod.name, prod.unit || '', category, db2Items);
      if (match) {
        db2ItemId = match.id;
        itemName = match.name;
        itemUnit = match.unit || itemUnit;
      }
    }
  } catch (e) { /* silent */ }

  return { db2ItemId, itemName, itemUnit, category };
};


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

      const isMilk = name.includes('milk') || material === 'milk';
      if (!isMilk) return 4;

      if (name.includes('1l bottle') || (name.includes('1l') && (name.includes('bottle') || material.includes('bottle')))) return 1;
      if (
        name.includes('half litre bottle') ||
        name.includes('500ml bottle') ||
        name.includes('500 ml bottle') ||
        name.includes('500ml (b)') ||
        (material.includes('bottle') && (name.includes('500') || name.includes('half') || unit.includes('500')))
      ) return 2;
      if (
        name.includes('500ml packet') ||
        name.includes('500 ml packet') ||
        name.includes('500ml (p)') ||
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

    const { db2ItemId } = await resolveTargetDb2ItemId(inventoryItemId);

    // Check if record exists in DB2
    let existingId = null;
    let carriedOver = 0;
    try {
      const rec = await readFromApp(
        'SELECT id, "carriedOverStock" FROM "InventoryDailyRecord" WHERE "inventoryItemId" = $1 AND date = $2',
        [db2ItemId, targetDate]
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
        [db2ItemId, targetDate]
      );
      if (prevRes.rows.length > 0) {
        carriedOver = parseFloat(prevRes.rows[0].currentStock || 0);
      }

      const newId = randomUUID();
      await writeToApp(
        `INSERT INTO "InventoryDailyRecord"
           (id, date, "inventoryItemId", "currentStock", "carriedOverStock", "newStockAdded", "expectedStock", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [newId, targetDate, db2ItemId, currStock, carriedOver, newAdded, carriedOver + newAdded]
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

    const dateStr = req.body.date || getISTDate();
    const addedBy = req.admin?.name || req.admin?.email || 'Super Admin';

    // 1. Fetch item name and unit from DB2 (with fallback for DB1 products)
    let itemName = 'Inventory Item';
    let itemUnit = unit || 'Litres';
    let db2InventoryItemId = inventoryItemId;

    try {
      const itemRes = await readFromApp(
        'SELECT id, name, unit, material FROM "InventoryItem" WHERE id = $1',
        [inventoryItemId]
      );
      if (itemRes.rows.length > 0) {
        itemName = itemRes.rows[0].name;
        if (!unit) itemUnit = itemRes.rows[0].unit || 'Litres';
      } else {
        // Fallback: If inventoryItemId is a DB1 product ID, fetch product info from CRM DB products
        const db1ProdRes = await readFromCRM('SELECT name, unit, category FROM products WHERE id = $1', [inventoryItemId]).catch(() => ({ rows: [] }));
        if (db1ProdRes.rows.length > 0) {
          const db1Name = db1ProdRes.rows[0].name;
          if (!unit) itemUnit = db1ProdRes.rows[0].unit || 'Litres';
          
          const db2ItemsRes = await readFromApp('SELECT id, name, unit, material FROM "InventoryItem"');
          const db2Items = db2ItemsRes.rows;

          const sName = db1Name.toLowerCase();
          const db1Category = (db1ProdRes.rows[0].category || '').toLowerCase();

          // ── Deterministic DB2 item resolver (category-guarded) ──────────────
          // Prevents cross-category matches (e.g. "500ml" in milk bottle ≠ "500ml" in oil)
          const isMilkProduct = sName.includes('milk') || db1Category === 'milk';
          const isBottle = sName.includes('bottle');
          const isPacket = sName.includes('packet');

          let match = null;

          // 1. Exact name match (case-insensitive) — most reliable
          match = db2Items.find(i => i.name.toLowerCase() === sName);

          // 2. Milk-specific material-based matching (only if product is clearly milk)
          if (!match && isMilkProduct) {
            if (sName.includes('1l') || sName.includes('1 litre')) {
              match = db2Items.find(i =>
                (i.name.toLowerCase().includes('1l') || i.name.toLowerCase().includes('1 litre')) &&
                i.material.toLowerCase() === 'bottle'
              );
            }
            if (!match && (sName.includes('500') || sName.includes('half') || sName.includes('½'))) {
              if (isPacket) {
                match = db2Items.find(i =>
                  (i.name.toLowerCase().includes('500') || i.name.toLowerCase().includes('half')) &&
                  i.material.toLowerCase() === 'packet'
                );
              } else if (isBottle) {
                match = db2Items.find(i =>
                  (i.name.toLowerCase().includes('500') || i.name.toLowerCase().includes('half')) &&
                  i.material.toLowerCase() === 'bottle'
                );
              }
            }
          }

          // 3. Non-milk keyword map for adhoc products (explicit, no partial-string risk)
          if (!match && !isMilkProduct) {
            const nonMilkKeywordMap = [
              { key: 'coconut',    db2Name: 'Coconut Oil' },
              { key: 'groundnut',  db2Name: 'Groundnut Oil' },
              { key: 'sesame',     db2Name: 'Sesame Oil' },
              { key: 'curd',       db2Name: 'Curd' },
              { key: 'paneer',     db2Name: 'Paneer' },
              { key: 'butter',     db2Name: 'Butter' },
              { key: 'honey',      db2Name: 'Honey' },
              { key: 'sugar',      db2Name: 'Cane Sugar' },
              { key: 'karupatti',  db2Name: 'Karupatti' },
              { key: 'appalam',    db2Name: 'Appalam' },
            ];
            for (const entry of nonMilkKeywordMap) {
              if (sName.includes(entry.key)) {
                // For ghee: disambiguate by weight (250gm vs 500gm)
                if (entry.key === 'ghee') {
                  if (sName.includes('250')) {
                    match = db2Items.find(i => i.name.toLowerCase().includes('ghee') && i.name.toLowerCase().includes('250'));
                  } else {
                    match = db2Items.find(i => i.name.toLowerCase().includes('ghee') && i.name.toLowerCase().includes('500'));
                  }
                } else {
                  match = db2Items.find(i => i.name.toLowerCase() === entry.db2Name.toLowerCase());
                }
                if (match) break;
              }
            }
          }

          // 4. Safe partial match as last resort — only within same broad category
          if (!match) {
            match = db2Items.find(i => {
              const iName = i.name.toLowerCase();
              const iMat  = (i.material || '').toLowerCase();
              // Milk guard: skip milk-material DB2 items when product is non-milk and vice versa
              const db2IsMilk = iMat === 'bottle' || iMat === 'packet' || iName.includes('milk');
              if (isMilkProduct !== db2IsMilk) return false;
              // Only allow partial match if one name contains the full other name (no single-token overlap)
              return (sName.length > 4 && iName.includes(sName)) || (iName.length > 4 && sName.includes(iName));
            });
          }

          if (match) {
            db2InventoryItemId = match.id;
            itemName = match.name;
          } else {
            itemName = db1Name;
          }

          // If product is AdHoc / Non-Milk, sync directly to adhoc_central_inventory in CRM DB
          if (db1Category === 'adhoc' || !sName.includes('milk')) {
            try {
              const recRes = await readFromCRM(
                `SELECT * FROM adhoc_central_inventory WHERE product_id = $1 AND date = $2`,
                [inventoryItemId, dateStr]
              );

              let openingStock = 0;
              let addedStock = 0;
              let dpIssuedStock = 0;

              if (recRes.rows.length > 0) {
                const rec = recRes.rows[0];
                openingStock = parseFloat(rec.opening_stock || 0);
                addedStock = parseFloat(rec.added_stock || 0) + added;
                dpIssuedStock = parseFloat(rec.dp_issued_stock || 0);
              } else {
                const prevRes = await readFromCRM(
                  `SELECT remaining_stock FROM adhoc_central_inventory WHERE product_id = $1 AND date < $2 ORDER BY date DESC LIMIT 1`,
                  [inventoryItemId, dateStr]
                );
                if (prevRes.rows.length > 0) openingStock = parseFloat(prevRes.rows[0].remaining_stock || 0);
                addedStock = added;
              }

              const remainingStock = openingStock + addedStock - dpIssuedStock;

              await writeToCRM(
                `INSERT INTO adhoc_central_inventory (id, product_id, date, opening_stock, added_stock, dp_issued_stock, remaining_stock, updated_by, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                 ON CONFLICT (product_id, date) DO UPDATE SET
                   added_stock = EXCLUDED.added_stock,
                   remaining_stock = EXCLUDED.remaining_stock,
                   updated_by = EXCLUDED.updated_by,
                   updated_at = NOW()`,
                [randomUUID(), inventoryItemId, dateStr, openingStock, addedStock, dpIssuedStock, remainingStock, addedBy]
              );

              await writeToCRM(
                `INSERT INTO adhoc_stock_transactions (id, date, product_id, product_name, transaction_type, quantity, performed_by, remarks)
                 VALUES ($1, $2, $3, $4, 'ADD_STOCK', $5, $6, $7)`,
                [randomUUID(), dateStr, inventoryItemId, db1Name, added, addedBy, remarks || `Added ${added} ${itemUnit} to central stock`]
              );
            } catch (adhocErr) {
              console.warn('⚠️ adhoc_central_inventory sync warning in addStock:', adhocErr.message);
            }
          }
        }
      }
    } catch (e) { /* silent */ }

    // 2. Fetch current stock for this item
    let previousStock = 0;
    let existingRecordId = null;
    let carriedOver = 0;

    try {
      const currentRes = await readFromApp(
        'SELECT id, "currentStock", "newStockAdded", "carriedOverStock" FROM "InventoryDailyRecord" WHERE "inventoryItemId" = $1 AND date = $2',
        [db2InventoryItemId, dateStr]
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
          [db2InventoryItemId, dateStr]
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
          [newRecordId, dateStr, db2InventoryItemId, updatedStock, carriedOver, added, carriedOver + added]
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

    // Resolve target DB2 InventoryItem ID and details
    const { db2ItemId, itemName, itemUnit, category } = await resolveTargetDb2ItemId(inventoryItemId);

    let previousStock = 0;
    let existingRecordId = null;
    try {
      const currentRes = await readFromApp(
        'SELECT id, "currentStock" FROM "InventoryDailyRecord" WHERE "inventoryItemId" = $1 AND date = $2',
        [db2ItemId, dateStr]
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

    // If adhoc product / non-milk, also update adhoc_central_inventory in DB1 CRM DB
    if (category === 'adhoc' || category === 'AdHoc' || (!itemName.toLowerCase().includes('milk'))) {
      try {
        await writeToCRM(
          `INSERT INTO adhoc_central_inventory (id, product_id, date, opening_stock, added_stock, dp_issued_stock, remaining_stock, updated_by, updated_at)
           VALUES ($1, $2, $3, 0, $4, 0, $4, $5, NOW())
           ON CONFLICT (product_id, date) DO UPDATE SET
             remaining_stock = EXCLUDED.remaining_stock,
             updated_by = EXCLUDED.updated_by,
             updated_at = NOW()`,
          [randomUUID(), inventoryItemId, dateStr, newStock, addedBy]
        );
      } catch (adhocErr) { /* silent */ }
    }

    // 2. DB2 update targeting resolved db2ItemId
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
          [newRecordId, dateStr, db2ItemId, newStock, previousStock]
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
      let notMarkedDays = 0;
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
          // No attendance record, allocation, or log for this date -> NOT MARKED
          status = 'NOT_MARKED';
        }

        // Increment stats for valid active DB2 audit days ONLY
        if (!isBeforeDb2 && !isFuture) {
          if (status === 'PRESENT') {
            presentDays++;
          } else if (status === 'ABSENT') {
            absentDays++;
          } else if (status === 'STANDBY') {
            presentDays++; // Standby means present at hub (unassigned to route)
            standbyDays++;
          } else if (status === 'NOT_MARKED') {
            notMarkedDays++;
          } else if (status === 'PENDING') {
            pendingDays++;
          }
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

      const totalDays = (presentDays - standbyDays) + standbyDays + absentDays + notMarkedDays + pendingDays;
      const markedDays = presentDays + absentDays;
      const attendancePercentage = markedDays > 0 ? Math.round((presentDays / markedDays) * 100) : (presentDays > 0 ? 100 : 0);

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
        notMarkedDays,
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

    // 1. Fetch ShopSale rows joined with ShopSaleItem & InventoryItem
    let shopSaleRows = [];
    try {
      const ssWhere = shopSaleWhere.replace(/\bdate\b/g, 'ss.date');
      const ssRes = await readFromApp(
        `SELECT 
           ss.id AS "shopSaleId",
           ss.date,
           ss."createdAt",
           ssi.id AS "itemId",
           ssi."inventoryItemId",
           ssi.quantity,
           inv.name AS "itemName",
           inv.unit AS "itemUnit",
           inv.material AS "itemMaterial"
         FROM "ShopSale" ss
         LEFT JOIN "ShopSaleItem" ssi ON ssi."shopSaleId" = ss.id
         LEFT JOIN "InventoryItem" inv ON inv.id = ssi."inventoryItemId"
         ${ssWhere}
         ORDER BY ss.date DESC, ss."createdAt" DESC`,
        shopSaleParams
      );

      const rawRows = ssRes.rows || [];
      const salesMap = {};

      rawRows.forEach(row => {
        const sid = row.shopSaleId;
        if (!salesMap[sid]) {
          salesMap[sid] = {
            id: sid,
            date: row.date,
            createdAt: row.createdAt,
            qty1LBottle: 0,
            qtyHalfLBottle: 0,
            qtyHalfLPacket: 0,
            totalUnits: 0,
            items: [],
          };
        }

        if (row.itemId) {
          const qty = parseInt(row.quantity, 10) || 0;
          const name = (row.itemName || '').toLowerCase();
          const unit = (row.itemUnit || '').toLowerCase();
          const mat  = (row.itemMaterial || '').toLowerCase();
          const item = row.inventoryItemId;

          if (item === '04cca8e6-0c08-4245-bb9d-d1c562df30e9' || unit === '1l' || name.includes('1l')) {
            salesMap[sid].qty1LBottle += qty;
          } else if (item === 'ec1714a6-6653-4c62-8b27-5c4c4c71223a' || ((unit === '500ml' || unit === '0.5l' || name.includes('500ml')) && mat === 'bottle')) {
            salesMap[sid].qtyHalfLBottle += qty;
          } else if (mat === 'packet' || name.includes('packet')) {
            salesMap[sid].qtyHalfLPacket += qty;
          } else {
            if (name.includes('1l')) salesMap[sid].qty1LBottle += qty;
            else salesMap[sid].qtyHalfLBottle += qty;
          }

          salesMap[sid].totalUnits += qty;
          salesMap[sid].items.push({
            id: row.itemId,
            inventoryItemId: row.inventoryItemId,
            name: row.itemName || 'Item',
            unit: row.itemUnit || '',
            material: row.itemMaterial || '',
            quantity: qty,
          });
        }
      });

      shopSaleRows = Object.values(salesMap);
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
        acc.total1LBottle    += row.qty1LBottle || 0;
        acc.totalHalfLBottle += row.qtyHalfLBottle || 0;
        acc.totalHalfLPacket += row.qtyHalfLPacket || 0;
        acc.totalUnits       += row.totalUnits || 0;
        acc.totalEntries     += 1;
        return acc;
      },
      { total1LBottle: 0, totalHalfLBottle: 0, totalHalfLPacket: 0, totalUnits: 0, totalEntries: 0 }
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
      if (n.includes('milk')) {
        if (n.includes('1l') || n.includes('1 l') || (n.includes('bottle') && (n.includes('1') || n.includes('litre')))) {
          mil1LBottle += q;
        } else if (n.includes('packet') || n.includes('pack') || n.includes('(p)')) {
          milHalfLPacket += q;
        } else if (n.includes('500') || n.includes('half') || n.includes('bottle') || n.includes('(b)')) {
          milHalfLBottle += q;
        }
      }

      return acc;
    }, {});

    // 5. Fetch DP Operational Audit & Petrol Allowance Transactions from DB2 (LedgerTransaction)
    let dpAuditItems = [];
    let petrolSummary = { totalPaid: 0, totalExtraPaid: 0, totalShortPaid: 0, hasAnyTransaction: false };

    try {
      const targetDateStr = date || istToday;
      const [dpRes, rRes, allocRes, logRes, txRes, allocItemsRes, logItemsRes] = await Promise.all([
        readFromApp('SELECT id, name, "dpCode", "mobileNumber", "vehicleNumber", zone, "isActive" FROM "DeliveryPerson" WHERE "isActive" = true AND LOWER(name) NOT IN (\'adam\', \'pradeep\', \'praddep\', \'test\', \'test dp\') AND "dpCode" NOT IN (\'DP018\', \'DP019\', \'DP020\') ORDER BY name ASC'),
        readFromApp('SELECT id, name, zone, "assignedDpId" FROM "Route" ORDER BY name ASC'),
        readFromApp('SELECT id, date, "dpId", "routeId", "litresAllocated", status FROM "RouteAllocation" WHERE date = $1', [targetDateStr]).catch(() => ({ rows: [] })),
        readFromApp('SELECT id, date, "dpId", "routeId", "deliveryCompleted", "flagIssue", reason FROM "EmptyBottleLog" WHERE date = $1', [targetDateStr]).catch(() => ({ rows: [] })),
        readFromApp('SELECT id, "dpId", "routeId", date, amount, note, type, "createdAt" FROM "LedgerTransaction" WHERE date = $1 ORDER BY "createdAt" DESC', [targetDateStr]).catch(() => ({ rows: [] })),
        readFromApp(
          `SELECT rai."routeAllocationId", rai.quantity, ii.id as "itemId", ii.name as "itemName", ii.unit, ii.material 
           FROM "RouteAllocationItem" rai 
           JOIN "RouteAllocation" ra ON ra.id = rai."routeAllocationId"
           JOIN "InventoryItem" ii ON ii.id = rai."inventoryItemId"
           WHERE ra.date = $1 AND ii.section = 'Milk'`,
          [targetDateStr]
        ).catch(() => ({ rows: [] })),
        readFromApp(
          `SELECT ebli."emptyBottleLogId", ebli."actualDelivered", ebli.expected, ii.id as "itemId", ii.name as "itemName", ii.unit, ii.material 
           FROM "EmptyBottleLogItem" ebli 
           JOIN "EmptyBottleLog" eb ON eb.id = ebli."emptyBottleLogId"
           JOIN "InventoryItem" ii ON ii.id = ebli."inventoryItemId"
           WHERE eb.date = $1 AND ii.section = 'Milk'`,
          [targetDateStr]
        ).catch(() => ({ rows: [] })),
      ]);

      const dps = dpRes.rows || [];
      const routes = rRes.rows || [];
      const allocs = allocRes.rows || [];
      const logs = logRes.rows || [];
      const txs = txRes.rows || [];
      const allocItems = allocItemsRes.rows || [];
      const logItems = logItemsRes.rows || [];

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
        let qty1LBottleTaken = 0;
        let qtyHalfLBottleTaken = 0;
        let qtyHalfLPacketTaken = 0;
        let totalTakenLitresAcc = 0;

        let qty1LBottleDelivered = 0;
        let qtyHalfLBottleDelivered = 0;
        let qtyHalfLPacketDelivered = 0;
        let totalDeliveredLitresAcc = 0;

        let hasDeliveryData = dpAllocs.length > 0 || dpLogs.length > 0;

        const routeIds = new Set([...dpAllocs.map(a => a.routeId), ...dpLogs.map(l => l.routeId)].filter(Boolean));

        if (routeIds.size > 0) {
          routeIds.forEach(rId => {
            const alloc = dpAllocs.find(a => a.routeId === rId);
            const ebLog = dpLogs.find(l => l.routeId === rId);

            let r1LTaken = 0;
            let rHalfLBottleTaken = 0;
            let rHalfLPacketTaken = 0;
            let rTakenLitres = 0;

            if (alloc) {
              const rAllocItems = allocItems.filter(i => String(i.routeAllocationId) === String(alloc.id));
              if (rAllocItems.length > 0) {
                rAllocItems.forEach(i => {
                  const qty = parseFloat(i.quantity || 0);
                  const is1L = i.unit === '1L' || (i.itemName && i.itemName.includes('1L'));
                  const isBottle = i.material === 'Bottle';
                  const isPacket = i.material === 'Packet';

                  if (is1L) r1LTaken += qty;
                  else if (isBottle) rHalfLBottleTaken += qty;
                  else if (isPacket) rHalfLPacketTaken += qty;
                });
                rTakenLitres = (r1LTaken * 1) + (rHalfLBottleTaken * 0.5) + (rHalfLPacketTaken * 0.5);
              } else if (alloc.litresAllocated && parseFloat(alloc.litresAllocated) > 0) {
                rTakenLitres = parseFloat(alloc.litresAllocated);
              }
            }

            let r1LDelivered = 0;
            let rHalfLBottleDelivered = 0;
            let rHalfLPacketDelivered = 0;
            let rDeliveredLitres = 0;

            let isCompleted = (alloc && alloc.status === 'COMPLETED') || 
                              (ebLog && ebLog.deliveryCompleted === true);

            if (ebLog) {
              const rLogItems = logItems.filter(i => String(i.emptyBottleLogId) === String(ebLog.id));
              if (rLogItems.length > 0) {
                rLogItems.forEach(i => {
                  let del = parseFloat(i.actualDelivered || 0);
                  if (del === 0 && isCompleted && parseFloat(i.expected || 0) > 0) {
                    del = parseFloat(i.expected);
                  }
                  const is1L = i.unit === '1L' || (i.itemName && i.itemName.includes('1L'));
                  const isBottle = i.material === 'Bottle';
                  const isPacket = i.material === 'Packet';

                  if (is1L) r1LDelivered += del;
                  else if (isBottle) rHalfLBottleDelivered += del;
                  else if (isPacket) rHalfLPacketDelivered += del;
                });
                rDeliveredLitres = (r1LDelivered * 1) + (rHalfLBottleDelivered * 0.5) + (rHalfLPacketDelivered * 0.5);
              } else if (isCompleted) {
                rDeliveredLitres = rTakenLitres;
              }
            } else if (isCompleted) {
              rDeliveredLitres = rTakenLitres;
            }

            qty1LBottleTaken += r1LTaken;
            qtyHalfLBottleTaken += rHalfLBottleTaken;
            qtyHalfLPacketTaken += rHalfLPacketTaken;
            totalTakenLitresAcc += rTakenLitres;

            qty1LBottleDelivered += r1LDelivered;
            qtyHalfLBottleDelivered += rHalfLBottleDelivered;
            qtyHalfLPacketDelivered += rHalfLPacketDelivered;
            totalDeliveredLitresAcc += rDeliveredLitres;
          });
        }

        const qty1LBottleUndelivered = Math.max(0, qty1LBottleTaken - qty1LBottleDelivered);
        const qtyHalfLBottleUndelivered = Math.max(0, qtyHalfLBottleTaken - qtyHalfLBottleDelivered);
        const qtyHalfLPacketUndelivered = Math.max(0, qtyHalfLPacketTaken - qtyHalfLPacketDelivered);

        const calculatedItemTakenLitres = (qty1LBottleTaken * 1) + (qtyHalfLBottleTaken * 0.5) + (qtyHalfLPacketTaken * 0.5);
        const calculatedItemDeliveredLitres = (qty1LBottleDelivered * 1) + (qtyHalfLBottleDelivered * 0.5) + (qtyHalfLPacketDelivered * 0.5);

        const totalTaken = Math.max(totalTakenLitresAcc, calculatedItemTakenLitres);
        const totalDelivered = Math.max(totalDeliveredLitresAcc, calculatedItemDeliveredLitres);
        const totalUndelivered = Math.max(0, totalTaken - totalDelivered);

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
          milkTakenBreakdown: {
            qty1LBottle: qty1LBottleTaken,
            qtyHalfLBottle: qtyHalfLBottleTaken,
            qtyHalfLPacket: qtyHalfLPacketTaken,
            totalLitres: totalTaken,
          },
          milkDeliveredBreakdown: {
            qty1LBottle: qty1LBottleDelivered,
            qtyHalfLBottle: qtyHalfLBottleDelivered,
            qtyHalfLPacket: qtyHalfLPacketDelivered,
            totalLitres: totalDelivered,
          },
          milkUndeliveredBreakdown: {
            qty1LBottle: qty1LBottleUndelivered,
            qtyHalfLBottle: qtyHalfLBottleUndelivered,
            qtyHalfLPacket: qtyHalfLPacketUndelivered,
            totalLitres: totalUndelivered,
          },
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

      const isMilk = name.includes('milk') || material === 'milk';
      if (!isMilk) return 4;

      if (name.includes('1l bottle') || (name.includes('1l') && (name.includes('bottle') || material.includes('bottle')))) return 1;
      if (name.includes('half litre bottle') || name.includes('500ml bottle') || name.includes('500 ml bottle') || name.includes('500ml (b)') || (material.includes('bottle') && (name.includes('500') || name.includes('half')))) return 2;
      if (name.includes('500ml packet') || name.includes('500 ml packet') || name.includes('500ml (p)') || (material.includes('packet') && (name.includes('500') || name.includes('half')))) return 3;
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
      const ssWhere = shopSaleWhere.replace(/\bdate\b/g, 'ss.date');
      const ssRes = await readFromApp(
        `SELECT 
           ss.id AS "shopSaleId",
           ss.date,
           ss."createdAt",
           ssi.id AS "itemId",
           ssi."inventoryItemId",
           ssi.quantity,
           inv.name AS "itemName",
           inv.unit AS "itemUnit",
           inv.material AS "itemMaterial"
         FROM "ShopSale" ss
         LEFT JOIN "ShopSaleItem" ssi ON ssi."shopSaleId" = ss.id
         LEFT JOIN "InventoryItem" inv ON inv.id = ssi."inventoryItemId"
         ${ssWhere}
         ORDER BY ss.date DESC, ss."createdAt" DESC`,
        shopSaleParams
      );

      const rawRows = ssRes.rows || [];
      const salesMap = {};

      rawRows.forEach(row => {
        const sid = row.shopSaleId;
        if (!salesMap[sid]) {
          salesMap[sid] = {
            id: sid,
            date: row.date,
            createdAt: row.createdAt,
            qty1LBottle: 0,
            qtyHalfLBottle: 0,
            qtyHalfLPacket: 0,
            totalUnits: 0,
            items: [],
          };
        }

        if (row.itemId) {
          const qty = parseInt(row.quantity, 10) || 0;
          const name = (row.itemName || '').toLowerCase();
          const unit = (row.itemUnit || '').toLowerCase();
          const mat  = (row.itemMaterial || '').toLowerCase();
          const item = row.inventoryItemId;

          if (item === '04cca8e6-0c08-4245-bb9d-d1c562df30e9' || unit === '1l' || name.includes('1l')) {
            salesMap[sid].qty1LBottle += qty;
          } else if (item === 'ec1714a6-6653-4c62-8b27-5c4c4c71223a' || ((unit === '500ml' || unit === '0.5l' || name.includes('500ml')) && mat === 'bottle')) {
            salesMap[sid].qtyHalfLBottle += qty;
          } else if (mat === 'packet' || name.includes('packet')) {
            salesMap[sid].qtyHalfLPacket += qty;
          } else {
            if (name.includes('1l')) salesMap[sid].qty1LBottle += qty;
            else salesMap[sid].qtyHalfLBottle += qty;
          }

          salesMap[sid].totalUnits += qty;
          salesMap[sid].items.push({
            id: row.itemId,
            inventoryItemId: row.inventoryItemId,
            name: row.itemName || 'Item',
            unit: row.itemUnit || '',
            material: row.itemMaterial || '',
            quantity: qty,
          });
        }
      });

      shopSaleRows = Object.values(salesMap);
    } catch (e) {
      console.warn('⚠️ DB2 ShopSale report query warning:', e.message);
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
      if (n.includes('milk')) {
        if (n.includes('1l') || n.includes('1 l') || (n.includes('bottle') && (n.includes('1') || n.includes('litre')))) {
          mil1LBottle += q;
        } else if (n.includes('packet') || n.includes('pack') || n.includes('(p)')) {
          milHalfLPacket += q;
        } else if (n.includes('500') || n.includes('half') || n.includes('bottle') || n.includes('(b)')) {
          milHalfLBottle += q;
        }
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

    // ── SHEET 4: ADHOC INVENTORY & DP SALES ─────────────────────────────────────
    const ws4 = workbook.addWorksheet('AdHoc Inventory & DP Sales');
    applyHeaderBlock(ws4, 'AdHoc Inventory & DP Sales');

    try {
      let adhocWhere = `c.date = $1`;
      let adhocParams = [targetDate];

      if (isRange) {
        adhocWhere = `c.date >= $1 AND c.date <= $2`;
        adhocParams = [startDate, endDate];
      }

      // Fetch Central AdHoc Inventory data
      const adhocCentralRes = await readFromCRM(
        `SELECT
           p.name as "productName", p.sku, p.unit, p.price_per_unit,
           COALESCE(SUM(c.opening_stock), 0) as opening,
           COALESCE(SUM(c.added_stock), 0) as added,
           COALESCE(SUM(c.dp_issued_stock), 0) as dp_issued,
           COALESCE(SUM(c.remaining_stock), 0) as remaining
         FROM products p
         LEFT JOIN adhoc_central_inventory c ON c.product_id = p.id AND ${adhocWhere}
         WHERE p.category = 'AdHoc' AND p.status = 'Active'
         GROUP BY p.id, p.name, p.sku, p.unit, p.price_per_unit
         ORDER BY p.name ASC`,
        adhocParams
      );
      const adhocCentralRows = adhocCentralRes.rows || [];

      // Fetch DP AdHoc Sales data
      let dpWhereStr = `date = $1`;
      let dpParams = [targetDate];

      if (isRange) {
        dpWhereStr = `date >= $1 AND date <= $2`;
        dpParams = [startDate, endDate];
      }

      const adhocDpRes = await readFromCRM(
        `SELECT
           dp_name, route_name, product_name,
           SUM(quantity_taken) as taken,
           SUM(quantity_sold) as sold,
           SUM(quantity_returned) as returned,
           SUM(quantity_remaining) as remaining,
           SUM(total_sales_amount) as revenue
         FROM adhoc_dp_stock
         WHERE ${dpWhereStr}
         GROUP BY dp_name, route_name, product_name
         ORDER BY dp_name ASC, product_name ASC`,
        dpParams
      );
      const adhocDpRows = adhocDpRes.rows || [];

      // Header Block 1: Central AdHoc Inventory
      const s4TitleRow = ws4.addRow(['ADHOC CENTRAL INVENTORY SUMMARY']);
      s4TitleRow.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF047857' } };
      ws4.mergeCells(`A${s4TitleRow.number}:G${s4TitleRow.number}`);

      const s4Header1 = ws4.addRow([
        'Product Name', 'SKU', 'Unit', 'Opening Stock', 'Added Stock', 'DP Issued Stock', 'Closing Central Stock'
      ]);
      styleTableHeader(s4Header1);

      let totOpening = 0, totAdded = 0, totIssued = 0, totRemaining = 0;

      adhocCentralRows.forEach(row => {
        const op = parseFloat(row.opening || 0);
        const ad = parseFloat(row.added || 0);
        const is = parseFloat(row.dp_issued || 0);
        const rm = parseFloat(row.remaining || 0);

        totOpening += op;
        totAdded += ad;
        totIssued += is;
        totRemaining += rm;

        const dataRow = ws4.addRow([
          row.productName, row.sku || '-', row.unit || 'Units', op, ad, is, rm
        ]);

        dataRow.eachCell((cell, colIndex) => {
          cell.font = { name: 'Calibri', size: 10.5 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          };
          if (colIndex >= 4 && colIndex <= 7) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0';
          } else if (colIndex <= 3) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        });
        dataRow.height = 20;
      });

      const totRow1 = ws4.addRow(['TOTAL ADHOC CENTRAL STOCK', '', '', totOpening, totAdded, totIssued, totRemaining]);
      ws4.mergeCells(`A${totRow1.number}:C${totRow1.number}`);
      totRow1.eachCell((cell, colIndex) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF047857' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF047857' } },
          bottom: { style: 'double', color: { argb: 'FF047857' } },
        };
        if (colIndex >= 4) cell.alignment = { horizontal: 'right', vertical: 'middle' };
      });

      ws4.addRow([]); // Blank Row

      // Header Block 2: DP AdHoc Sales Audit
      const s4TitleRow2 = ws4.addRow(['DP ADHOC SALES & AUDIT BREAKDOWN']);
      s4TitleRow2.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFB45309' } };
      ws4.mergeCells(`A${s4TitleRow2.number}:H${s4TitleRow2.number}`);

      const s4Header2 = ws4.addRow([
        'DP Name', 'Route Name', 'Product Name', 'Taken', 'Sold', 'Returned', 'Remaining', 'Total Revenue (₹)'
      ]);
      styleTableHeader(s4Header2);

      let dpTotTaken = 0, dpTotSold = 0, dpTotRet = 0, dpTotRem = 0, dpTotRev = 0;

      if (adhocDpRows.length === 0) {
        const emptyDpRow = ws4.addRow(['No DP AdHoc sales recorded for the selected period.']);
        ws4.mergeCells(`A${emptyDpRow.number}:H${emptyDpRow.number}`);
        emptyDpRow.getCell(1).alignment = { horizontal: 'center' };
        emptyDpRow.getCell(1).font = { italic: true, color: { argb: 'FF9CA3AF' } };
      } else {
        adhocDpRows.forEach(row => {
          const tk = parseFloat(row.taken || 0);
          const sd = parseFloat(row.sold || 0);
          const rt = parseFloat(row.returned || 0);
          const rm = parseFloat(row.remaining || 0);
          const rv = parseFloat(row.revenue || 0);

          dpTotTaken += tk;
          dpTotSold += sd;
          dpTotRet += rt;
          dpTotRem += rm;
          dpTotRev += rv;

          const dataRow = ws4.addRow([
            row.dp_name, row.route_name || 'General Route', row.product_name, tk, sd, rt, rm, rv
          ]);

          dataRow.eachCell((cell, colIndex) => {
            cell.font = { name: 'Calibri', size: 10.5 };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            };
            if (colIndex >= 4 && colIndex <= 7) {
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
              cell.numFmt = '#,##0';
            } else if (colIndex === 8) {
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
              cell.numFmt = '₹#,##0.00';
            }
          });
          dataRow.height = 20;
        });

        const totRow2 = ws4.addRow(['TOTAL DP ADHOC SALES', '', '', dpTotTaken, dpTotSold, dpTotRet, dpTotRem, dpTotRev]);
        ws4.mergeCells(`A${totRow2.number}:C${totRow2.number}`);
        totRow2.eachCell((cell, colIndex) => {
          cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFB45309' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
          cell.border = {
            top: { style: 'medium', color: { argb: 'FFB45309' } },
            bottom: { style: 'double', color: { argb: 'FFB45309' } },
          };
          if (colIndex >= 4 && colIndex <= 7) cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (colIndex === 8) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '₹#,##0.00';
          }
        });
      }
    } catch (e) {
      console.warn('⚠️ AdHoc Sheet generation warning:', e.message);
    }

    ws4.columns.forEach(col => { col.width = 24; });

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

const { readFromCRM, writeToCRM, readFromApp, writeToApp } = require('../config/database');
const { randomUUID } = require('crypto');
const { getExpectedOperationalDate } = require('../services/operationalDay.service');

const getISTDate = () => getExpectedOperationalDate();

// ── DB2 Sync Helper for AdHoc Products ──────────────────────────────────────
const syncAdhocProductToDB2 = async (productName, targetDate, addedStock, remainingStock, openingStock = 0, productMaterial = '', productUnit = '') => {
  try {
    const itemsRes = await readFromApp('SELECT id, name, unit, material FROM "InventoryItem"');
    if (!itemsRes.rows || itemsRes.rows.length === 0) return;

    const db2Items = itemsRes.rows;
    const sName = (productName || '').toLowerCase();
    const sMat  = (productMaterial || '').toLowerCase();
    const sUnit = (productUnit || '').toLowerCase();

    const isBottle = sMat.includes('bottle') || sName.includes('bottle');
    const isPacket = sMat.includes('packet') || sName.includes('packet');

    let match = null;

    // 1. MILK 1L (Bottle)
    if ((sName.includes('1l') || sName.includes('1 litre')) && !sName.includes('oil')) {
      match = db2Items.find(i => i.name.toLowerCase().includes('1l') && i.material.toLowerCase() === 'bottle');
    }

    // 2. MILK 500mL / HALF LITRE BOTTLE vs PACKET
    if (!match && (sName.includes('500') || sName.includes('half') || sName.includes('½'))) {
      if (sName.includes('milk') || (!sName.includes('ghee') && !sName.includes('curd') && !sName.includes('oil') && !sName.includes('sugar'))) {
        if (isPacket) {
          match = db2Items.find(i => i.name.toLowerCase().includes('500') && i.material.toLowerCase() === 'packet');
        } else if (isBottle) {
          match = db2Items.find(i => i.name.toLowerCase().includes('500') && i.material.toLowerCase() === 'bottle');
        }
      }
    }

    // 3. Ghee weight matching (500gm vs 250gm)
    if (!match && sName.includes('ghee')) {
      if (sName.includes('250') || sUnit.includes('250')) {
        match = db2Items.find(i => i.name.toLowerCase().includes('ghee') && i.name.toLowerCase().includes('250'));
      } else if (sName.includes('500') || sUnit.includes('500')) {
        match = db2Items.find(i => i.name.toLowerCase().includes('ghee') && i.name.toLowerCase().includes('500'));
      }
    }

    // 4. Specific Keyword Matching for Non-Milk Products
    if (!match) {
      const keywordsMap = [
        { key: 'curd', db2Name: 'Curd' },
        { key: 'paneer', db2Name: 'Paneer' },
        { key: 'butter', db2Name: 'Butter' },
        { key: 'appalam', db2Name: 'Appalam' },
        { key: 'honey', db2Name: 'Honey' },
        { key: 'sugar', db2Name: 'Cane Sugar' },
        { key: 'karupatti', db2Name: 'Karupatti' },
        { key: 'coconut', db2Name: 'Coconut Oil' },
        { key: 'groundnut', db2Name: 'Groundnut Oil' },
        { key: 'sesame', db2Name: 'Sesame Oil' },
      ];

      for (const item of keywordsMap) {
        if (sName.includes(item.key)) {
          match = db2Items.find(i => i.name.toLowerCase() === item.db2Name.toLowerCase());
          if (match) break;
        }
      }
    }

    // 5. Fallback: exact/partial match
    if (!match) {
      match = db2Items.find(i => {
        const iName = i.name.toLowerCase();
        return sName.includes(iName) || iName.includes(sName);
      });
    }

    if (!match) {
      console.warn(`⚠️ DB2 sync: No matching DB2 InventoryItem for '${productName}'`);
      return;
    }

    const inventoryItemId = match.id;

    const recRes = await readFromApp(
      'SELECT id, "newStockAdded", "currentStock", "carriedOverStock" FROM "InventoryDailyRecord" WHERE "inventoryItemId" = $1 AND date = $2',
      [inventoryItemId, targetDate]
    );

    if (recRes.rows.length > 0) {
      const existingId = recRes.rows[0].id;
      const expectedStock = openingStock + addedStock;
      await writeToApp(
        `UPDATE "InventoryDailyRecord"
         SET "newStockAdded"    = $1,
             "currentStock"     = $2,
             "carriedOverStock" = $3,
             "expectedStock"    = $4,
             "updatedAt"        = NOW()
         WHERE id = $5`,
        [addedStock, remainingStock, openingStock, expectedStock, existingId]
      );
      console.log(`✅ [DB2 Sync] Updated DB2 InventoryDailyRecord for ${productName} (DB2 item: ${match.name}) on ${targetDate}. Added: ${addedStock}, Current: ${remainingStock}`);
    } else {
      const newId = randomUUID();
      await writeToApp(
        `INSERT INTO "InventoryDailyRecord"
           (id, date, "inventoryItemId", "currentStock", "carriedOverStock", "newStockAdded", "expectedStock", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [newId, targetDate, inventoryItemId, remainingStock, openingStock, addedStock, openingStock + addedStock]
      );
      console.log(`✅ [DB2 Sync] Created DB2 InventoryDailyRecord for ${productName} (DB2 item: ${match.name}) on ${targetDate}. Added: ${addedStock}, Current: ${remainingStock}`);
    }
  } catch (err) {
    console.warn(`⚠️ DB2 sync error for '${productName}':`, err.message);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/inventory/adhoc — Central AdHoc Inventory Summary
// ─────────────────────────────────────────────────────────────────────────────
const getAdhocInventory = async (req, res, next) => {
  try {
    const targetDate = req.query.date || getISTDate();

    // 1. Fetch all AdHoc products from `products` table
    const productsRes = await readFromCRM(
      `SELECT id, name, category, unit, price_per_unit, sku, status, image_url
       FROM products
       WHERE category = 'AdHoc' AND status = 'Active'
       ORDER BY name ASC`
    );
    const adhocProducts = productsRes.rows || [];

    // 2. Fetch central inventory records for targetDate
    const centralRecsRes = await readFromCRM(
      `SELECT * FROM adhoc_central_inventory WHERE date = $1`,
      [targetDate]
    );
    const centralRecs = centralRecsRes.rows || [];

    // 3. Fetch preceding inventory records for carry-over calculation if today's record missing
    const prevRecsRes = await readFromCRM(
      `SELECT DISTINCT ON (product_id) *
       FROM adhoc_central_inventory
       WHERE date < $1
       ORDER BY product_id, date DESC`,
      [targetDate]
    );
    const prevRecs = prevRecsRes.rows || [];

    // 4. Fetch DB2 daily records as additional source of truth
    let db2DailyRecs = [];
    try {
      const db2RecsRes = await readFromApp(
        `SELECT r.id, r."inventoryItemId", r."currentStock", r."carriedOverStock", r."newStockAdded"
         FROM "InventoryDailyRecord" r
         WHERE r.date = $1`,
        [targetDate]
      );
      db2DailyRecs = db2RecsRes.rows || [];
    } catch (e) { /* silent */ }

    const db2ItemsRes = await readFromApp('SELECT id, name, unit, material FROM "InventoryItem"').catch(() => ({ rows: [] }));
    const db2Items = db2ItemsRes.rows || [];

    // Combine products with central inventory data
    const items = adhocProducts.map(p => {
      const rec = centralRecs.find(r => r.product_id === p.id);
      const prev = prevRecs.find(r => r.product_id === p.id);

      const pName = p.name.toLowerCase();
      const matchDb2Item = db2Items.find(i => pName.includes(i.name.toLowerCase()) || i.name.toLowerCase().includes(pName));
      const db2Rec = matchDb2Item ? db2DailyRecs.find(r => r.inventoryItemId === matchDb2Item.id) : null;

      let openingStock = 0;
      let addedStock = 0;
      let dpIssuedStock = 0;
      let remainingStock = 0;

      if (rec) {
        openingStock = parseFloat(rec.opening_stock || 0);
        addedStock = parseFloat(rec.added_stock || 0);
        dpIssuedStock = parseFloat(rec.dp_issued_stock || 0);
        remainingStock = parseFloat(rec.remaining_stock || (openingStock + addedStock - dpIssuedStock));
      } else if (db2Rec) {
        openingStock = parseFloat(db2Rec.carriedOverStock || 0);
        addedStock = parseFloat(db2Rec.newStockAdded || 0);
        remainingStock = parseFloat(db2Rec.currentStock || 0);
      } else if (prev) {
        openingStock = parseFloat(prev.remaining_stock || 0);
        remainingStock = openingStock;
      }

      let status = 'In Stock';
      if (remainingStock <= 0) {
        status = 'Out of Stock';
      } else if (remainingStock <= 10) {
        status = 'Low Stock';
      }

      return {
        id: p.id,
        productId: p.id,
        name: p.name,
        category: p.category || 'AdHoc',
        unit: p.unit,
        pricePerUnit: parseFloat(p.price_per_unit || 0),
        sku: p.sku || '',
        openingStock,
        addedStock,
        dpIssuedStock,
        remainingStock,
        currentStock: remainingStock,
        status,
        date: targetDate,
        updatedAt: rec ? rec.updated_at : (prev ? prev.updated_at : null),
      };
    });

    const totalOpening = items.reduce((a, b) => a + b.openingStock, 0);
    const totalAdded = items.reduce((a, b) => a + b.addedStock, 0);
    const totalIssued = items.reduce((a, b) => a + b.dpIssuedStock, 0);
    const totalRemaining = items.reduce((a, b) => a + b.remainingStock, 0);

    res.json({
      success: true,
      date: targetDate,
      data: items,
      summary: {
        totalProducts: items.length,
        totalOpening,
        totalAdded,
        totalIssued,
        totalRemaining,
        lowStockCount: items.filter(i => i.status === 'Low Stock').length,
        outOfStockCount: items.filter(i => i.status === 'Out of Stock').length,
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/inventory/adhoc/add-stock — Super Admin Add Central AdHoc Stock
// ─────────────────────────────────────────────────────────────────────────────
const addAdhocStock = async (req, res, next) => {
  try {
    const { productId, quantity, date, addedBy = 'Super Admin', remarks = '' } = req.body;

    if (!productId || !quantity || parseFloat(quantity) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid productId and positive quantity are required.' });
    }

    const targetDate = date || getISTDate();
    const qty = parseFloat(quantity);

    // Verify product exists and is AdHoc
    const prodRes = await readFromCRM(`SELECT id, name, category, unit FROM products WHERE id = $1`, [productId]);
    if (prodRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    const prod = prodRes.rows[0];

    // Fetch existing central record for targetDate
    const recRes = await readFromCRM(`SELECT * FROM adhoc_central_inventory WHERE product_id = $1 AND date = $2`, [productId, targetDate]);

    let openingStock = 0;
    let addedStock = 0;
    let dpIssuedStock = 0;

    if (recRes.rows.length > 0) {
      const rec = recRes.rows[0];
      openingStock = parseFloat(rec.opening_stock || 0);
      addedStock = parseFloat(rec.added_stock || 0) + qty;
      dpIssuedStock = parseFloat(rec.dp_issued_stock || 0);
    } else {
      // Find previous day remaining stock for opening_stock
      const prevRes = await readFromCRM(
        `SELECT remaining_stock FROM adhoc_central_inventory WHERE product_id = $1 AND date < $2 ORDER BY date DESC LIMIT 1`,
        [productId, targetDate]
      );
      if (prevRes.rows.length > 0) openingStock = parseFloat(prevRes.rows[0].remaining_stock || 0);
      addedStock = qty;
    }

    const remainingStock = openingStock + addedStock - dpIssuedStock;

    // Upsert into `adhoc_central_inventory`
    await writeToCRM(
      `INSERT INTO adhoc_central_inventory (id, product_id, date, opening_stock, added_stock, dp_issued_stock, remaining_stock, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (product_id, date) DO UPDATE SET
         added_stock = EXCLUDED.added_stock,
         remaining_stock = EXCLUDED.remaining_stock,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [randomUUID(), productId, targetDate, openingStock, addedStock, dpIssuedStock, remainingStock, addedBy]
    );

    // Record Transaction in `adhoc_stock_transactions`
    await writeToCRM(
      `INSERT INTO adhoc_stock_transactions (id, date, product_id, product_name, transaction_type, quantity, performed_by, remarks)
       VALUES ($1, $2, $3, $4, 'ADD_STOCK', $5, $6, $7)`,
      [randomUUID(), targetDate, productId, prod.name, qty, addedBy, remarks || `Added ${qty} ${prod.unit} to central stock`]
    );

    // Sync directly to DB2 (Manager App DB)
    await syncAdhocProductToDB2(prod.name, targetDate, addedStock, remainingStock, openingStock);

    res.status(201).json({
      success: true,
      message: `Successfully added ${qty} ${prod.unit} of ${prod.name} to central inventory and Manager App DB2!`,
      data: {
        productId,
        productName: prod.name,
        date: targetDate,
        openingStock,
        addedStock,
        dpIssuedStock,
        remainingStock,
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/inventory/adhoc/issue-dp-stock — Issue Central Stock to DP
// ─────────────────────────────────────────────────────────────────────────────
const issueDpAdhocStock = async (req, res, next) => {
  try {
    const {
      dpRefId, dpName, routeId = 'unassigned', routeName = 'General Route',
      productId, quantity, date, performedBy = 'Super Admin', remarks = ''
    } = req.body;

    if (!dpRefId || !dpName || !productId || !quantity || parseFloat(quantity) <= 0) {
      return res.status(400).json({ success: false, message: 'dpRefId, dpName, productId, and positive quantity required.' });
    }

    const targetDate = date || getISTDate();
    const qty = parseFloat(quantity);

    // 1. Check Product details
    const prodRes = await readFromCRM(`SELECT id, name, unit, price_per_unit FROM products WHERE id = $1`, [productId]);
    if (prodRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Product not found.' });
    const prod = prodRes.rows[0];
    const price = parseFloat(prod.price_per_unit || 0);

    // 2. Check Central Stock Availability
    const centralRes = await readFromCRM(`SELECT * FROM adhoc_central_inventory WHERE product_id = $1 AND date = $2`, [productId, targetDate]);

    let openingStock = 0;
    let addedStock = 0;
    let dpIssuedStock = 0;
    let remainingStock = 0;

    if (centralRes.rows.length > 0) {
      const c = centralRes.rows[0];
      openingStock = parseFloat(c.opening_stock || 0);
      addedStock = parseFloat(c.added_stock || 0);
      dpIssuedStock = parseFloat(c.dp_issued_stock || 0);
      remainingStock = parseFloat(c.remaining_stock || (openingStock + addedStock - dpIssuedStock));
    } else {
      // Check previous date stock
      const prevRes = await readFromCRM(
        `SELECT remaining_stock FROM adhoc_central_inventory WHERE product_id = $1 AND date < $2 ORDER BY date DESC LIMIT 1`,
        [productId, targetDate]
      );
      if (prevRes.rows.length > 0) openingStock = parseFloat(prevRes.rows[0].remaining_stock || 0);
      remainingStock = openingStock;
    }

    if (remainingStock < qty) {
      return res.status(400).json({
        success: false,
        message: `Insufficient central stock! Available: ${remainingStock} ${prod.unit}, Requested: ${qty} ${prod.unit}.`
      });
    }

    // 3. Deduct Central Stock & Increase `dp_issued_stock`
    dpIssuedStock += qty;
    remainingStock = openingStock + addedStock - dpIssuedStock;

    await writeToCRM(
      `INSERT INTO adhoc_central_inventory (id, product_id, date, opening_stock, added_stock, dp_issued_stock, remaining_stock, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (product_id, date) DO UPDATE SET
         dp_issued_stock = EXCLUDED.dp_issued_stock,
         remaining_stock = EXCLUDED.remaining_stock,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [randomUUID(), productId, targetDate, openingStock, addedStock, dpIssuedStock, remainingStock, performedBy]
    );

    // 4. Update DP Stock table (`adhoc_dp_stock`)
    const dpStockRes = await readFromCRM(
      `SELECT * FROM adhoc_dp_stock WHERE date = $1 AND dp_ref_id = $2 AND route_id = $3 AND product_id = $4`,
      [targetDate, dpRefId, routeId, productId]
    );

    let taken = 0;
    let sold = 0;
    let returned = 0;

    if (dpStockRes.rows.length > 0) {
      const d = dpStockRes.rows[0];
      taken = parseFloat(d.quantity_taken || 0) + qty;
      sold = parseFloat(d.quantity_sold || 0);
      returned = parseFloat(d.quantity_returned || 0);
    } else {
      // Check if carried over DP stock exists from preceding operational date
      const prevDpRes = await readFromCRM(
        `SELECT quantity_remaining FROM adhoc_dp_stock WHERE dp_ref_id = $1 AND route_id = $2 AND product_id = $3 AND date < $4 ORDER BY date DESC LIMIT 1`,
        [dpRefId, routeId, productId, targetDate]
      );
      const prevRemaining = prevDpRes.rows.length > 0 ? parseFloat(prevDpRes.rows[0].quantity_remaining || 0) : 0;
      taken = prevRemaining + qty;
    }

    const dpRemaining = taken - sold - returned;
    const salesAmount = sold * price;

    await writeToCRM(
      `INSERT INTO adhoc_dp_stock (id, date, dp_ref_id, dp_name, route_id, route_name, product_id, product_name, quantity_taken, quantity_sold, quantity_returned, quantity_remaining, selling_price, total_sales_amount, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
       ON CONFLICT (date, dp_ref_id, route_id, product_id) DO UPDATE SET
         quantity_taken = EXCLUDED.quantity_taken,
         quantity_remaining = EXCLUDED.quantity_remaining,
         total_sales_amount = EXCLUDED.total_sales_amount,
         updated_at = NOW()`,
      [randomUUID(), targetDate, dpRefId, dpName, routeId, routeName, productId, prod.name, taken, sold, returned, dpRemaining, price, salesAmount]
    );

    // 5. Record Stock Transaction Ledger Entry
    await writeToCRM(
      `INSERT INTO adhoc_stock_transactions (id, date, product_id, product_name, transaction_type, quantity, dp_ref_id, dp_name, route_id, route_name, performed_by, remarks)
       VALUES ($1, $2, $3, $4, 'DP_ISSUE', $5, $6, $7, $8, $9, $10, $11)`,
      [randomUUID(), targetDate, productId, prod.name, qty, dpRefId, dpName, routeId, routeName, performedBy, remarks || `Issued ${qty} to DP ${dpName}`]
    );

    res.json({
      success: true,
      message: `Issued ${qty} ${prod.unit} of ${prod.name} to DP ${dpName}.`,
      data: {
        dpRefId,
        dpName,
        routeName,
        productId,
        productName: prod.name,
        quantityTaken: taken,
        quantityRemaining: dpRemaining,
        centralRemaining: remainingStock,
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/inventory/adhoc/dp-stock — Fetch DP AdHoc Stock & Sales
// ─────────────────────────────────────────────────────────────────────────────
const getDpAdhocStock = async (req, res, next) => {
  try {
    const { date, dpRefId, routeId } = req.query;
    const targetDate = date || getISTDate();

    let where = [`date = $1`];
    let params = [targetDate];

    if (dpRefId) {
      params.push(dpRefId);
      where.push(`dp_ref_id = $${params.length}`);
    }

    if (routeId) {
      params.push(routeId);
      where.push(`route_id = $${params.length}`);
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;

    const result = await readFromCRM(
      `SELECT * FROM adhoc_dp_stock ${whereClause} ORDER BY dp_name ASC, product_name ASC`,
      params
    );

    res.json({ success: true, date: targetDate, data: result.rows });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/inventory/adhoc/record-dp-sale — Record or Update DP Sales/Returns
// ─────────────────────────────────────────────────────────────────────────────
const recordDpAdhocSale = async (req, res, next) => {
  try {
    const {
      dpRefId, dpName, routeId = 'unassigned', routeName = 'General Route',
      productId, quantitySold, quantityReturned = 0, date, performedBy = 'DP / Manager', remarks = ''
    } = req.body;

    if (!dpRefId || !productId || quantitySold === undefined) {
      return res.status(400).json({ success: false, message: 'dpRefId, productId, and quantitySold are required.' });
    }

    const targetDate = date || getISTDate();
    const sold = Math.max(0, parseFloat(quantitySold || 0));
    const returned = Math.max(0, parseFloat(quantityReturned || 0));

    // Fetch product info
    const prodRes = await readFromCRM(`SELECT id, name, unit, price_per_unit FROM products WHERE id = $1`, [productId]);
    if (prodRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Product not found.' });
    const prod = prodRes.rows[0];
    const price = parseFloat(prod.price_per_unit || 0);

    // Fetch existing DP stock entry for date
    const dpStockRes = await readFromCRM(
      `SELECT * FROM adhoc_dp_stock WHERE date = $1 AND dp_ref_id = $2 AND route_id = $3 AND product_id = $4`,
      [targetDate, dpRefId, routeId, productId]
    );

    let taken = 0;
    if (dpStockRes.rows.length > 0) {
      taken = parseFloat(dpStockRes.rows[0].quantity_taken || 0);
    } else {
      // Check if DP had carried-over stock
      const prevDpRes = await readFromCRM(
        `SELECT quantity_remaining FROM adhoc_dp_stock WHERE dp_ref_id = $1 AND route_id = $2 AND product_id = $3 AND date < $4 ORDER BY date DESC LIMIT 1`,
        [dpRefId, routeId, productId, targetDate]
      );
      if (prevDpRes.rows.length > 0) taken = parseFloat(prevDpRes.rows[0].quantity_remaining || 0);
    }

    // Business Validation: Taken >= Sold + Returned
    if (taken < (sold + returned)) {
      return res.status(400).json({
        success: false,
        message: `Validation Error: Sold (${sold}) + Returned (${returned}) exceeds DP Taken stock (${taken}) for ${prod.name}.`
      });
    }

    const remaining = taken - sold - returned;
    const totalSalesAmount = sold * price;

    await writeToCRM(
      `INSERT INTO adhoc_dp_stock (id, date, dp_ref_id, dp_name, route_id, route_name, product_id, product_name, quantity_taken, quantity_sold, quantity_returned, quantity_remaining, selling_price, total_sales_amount, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
       ON CONFLICT (date, dp_ref_id, route_id, product_id) DO UPDATE SET
         quantity_sold = EXCLUDED.quantity_sold,
         quantity_returned = EXCLUDED.quantity_returned,
         quantity_remaining = EXCLUDED.quantity_remaining,
         total_sales_amount = EXCLUDED.total_sales_amount,
         updated_at = NOW()`,
      [randomUUID(), targetDate, dpRefId, dpName || 'DP', routeId, routeName, productId, prod.name, taken, sold, returned, remaining, price, totalSalesAmount]
    );

    // Log in Stock Transactions
    await writeToCRM(
      `INSERT INTO adhoc_stock_transactions (id, date, product_id, product_name, transaction_type, quantity, dp_ref_id, dp_name, route_id, route_name, performed_by, remarks)
       VALUES ($1, $2, $3, $4, 'DP_SALE', $5, $6, $7, $8, $9, $10, $11)`,
      [randomUUID(), targetDate, productId, prod.name, sold, dpRefId, dpName || 'DP', routeId, routeName, performedBy, remarks || `Logged DP sale: ${sold} sold, ${returned} returned`]
    );

    res.json({
      success: true,
      message: `Updated DP AdHoc sales for ${prod.name}: ${sold} Sold, ${returned} Returned, ${remaining} Remaining.`,
      data: {
        dpRefId,
        productId,
        productName: prod.name,
        taken,
        sold,
        returned,
        remaining,
        sellingPrice: price,
        totalSalesAmount,
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/inventory/adhoc/record-customer-sale — Customer Sale via DP Route
// ─────────────────────────────────────────────────────────────────────────────
const recordCustomerAdhocSale = async (req, res, next) => {
  try {
    const {
      customerId, customerName, dpRefId, dpName, routeId, routeName,
      productId, quantity, date
    } = req.body;

    if (!dpRefId || !productId || !quantity || parseFloat(quantity) <= 0) {
      return res.status(400).json({ success: false, message: 'dpRefId, productId, and positive quantity required.' });
    }

    const targetDate = date || getISTDate();
    const qty = parseFloat(quantity);

    // Fetch product unit price
    const prodRes = await readFromCRM(`SELECT id, name, price_per_unit FROM products WHERE id = $1`, [productId]);
    if (prodRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Product not found.' });
    const prod = prodRes.rows[0];
    const unitPrice = parseFloat(prod.price_per_unit || 0);
    const totalAmount = qty * unitPrice;

    // Save customer sale entry
    const saleId = randomUUID();
    await writeToCRM(
      `INSERT INTO adhoc_customer_sales (id, date, customer_id, customer_name, dp_ref_id, dp_name, route_id, route_name, product_id, product_name, quantity, unit_price, total_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [saleId, targetDate, customerId || null, customerName || 'Walk-in Customer', dpRefId, dpName || 'DP', routeId || 'unassigned', routeName || 'General Route', productId, prod.name, qty, unitPrice, totalAmount]
    );

    res.status(201).json({
      success: true,
      message: `Recorded sale of ${qty} ${prod.name} (₹${totalAmount}) to ${customerName || 'Customer'}.`,
      data: {
        id: saleId,
        date: targetDate,
        productName: prod.name,
        quantity: qty,
        unitPrice,
        totalAmount,
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/inventory/adhoc/audit — Complete DP-Level Audit & Multi-Route Aggregation
// ─────────────────────────────────────────────────────────────────────────────
const getDpAdhocAudit = async (req, res, next) => {
  try {
    const { date, dpRefId } = req.query;
    const targetDate = date || getISTDate();

    let dpWhere = [`date = $1`];
    let params = [targetDate];

    if (dpRefId) {
      params.push(dpRefId);
      dpWhere.push(`dp_ref_id = $${params.length}`);
    }

    const rowsRes = await readFromCRM(
      `SELECT * FROM adhoc_dp_stock WHERE ${dpWhere.join(' AND ')} ORDER BY dp_name ASC, product_name ASC`,
      params
    );

    const rows = rowsRes.rows || [];

    // Group & Aggregate by DP (DP + Name + Date) across multiple routes
    const dpMap = new Map();

    for (const r of rows) {
      const dpKey = `${r.dp_ref_id}_${r.date}`;
      if (!dpMap.has(dpKey)) {
        dpMap.set(dpKey, {
          dpRefId: r.dp_ref_id,
          dpName: r.dp_name,
          date: r.date,
          routes: new Set(),
          totalTaken: 0,
          totalSold: 0,
          totalReturned: 0,
          totalRemaining: 0,
          totalRevenue: 0,
          productBreakdown: [],
          routeDetails: [],
        });
      }

      const dpItem = dpMap.get(dpKey);
      if (r.route_name) dpItem.routes.add(r.route_name);

      const taken = parseFloat(r.quantity_taken || 0);
      const sold = parseFloat(r.quantity_sold || 0);
      const returned = parseFloat(r.quantity_returned || 0);
      const remaining = parseFloat(r.quantity_remaining || (taken - sold - returned));
      const amount = parseFloat(r.total_sales_amount || (sold * parseFloat(r.selling_price || 0)));

      dpItem.totalTaken += taken;
      dpItem.totalSold += sold;
      dpItem.totalReturned += returned;
      dpItem.totalRemaining += remaining;
      dpItem.totalRevenue += amount;

      dpItem.routeDetails.push({
        id: r.id,
        routeId: r.route_id,
        routeName: r.route_name || 'General Route',
        productId: r.product_id,
        productName: r.product_name,
        taken,
        sold,
        returned,
        remaining,
        sellingPrice: parseFloat(r.selling_price || 0),
        amount,
      });
    }

    // Produce cumulative product summary per DP
    const dpAuditList = Array.from(dpMap.values()).map(dp => {
      // Group products within DP cumulatively
      const prodMap = new Map();
      for (const rd of dp.routeDetails) {
        if (!prodMap.has(rd.productId)) {
          prodMap.set(rd.productId, {
            productId: rd.productId,
            productName: rd.productName,
            taken: 0,
            sold: 0,
            returned: 0,
            remaining: 0,
            sellingPrice: rd.sellingPrice,
            amount: 0,
          });
        }
        const p = prodMap.get(rd.productId);
        p.taken += rd.taken;
        p.sold += rd.sold;
        p.returned += rd.returned;
        p.remaining += rd.remaining;
        p.amount += rd.amount;
      }

      return {
        dpRefId: dp.dpRefId,
        dpName: dp.dpName,
        date: dp.date,
        routesList: Array.from(dp.routes).join(', ') || 'General Route',
        totalTaken: dp.totalTaken,
        totalSold: dp.totalSold,
        totalReturned: dp.totalReturned,
        totalRemaining: dp.totalRemaining,
        totalRevenue: dp.totalRevenue,
        cumulativeProducts: Array.from(prodMap.values()),
        routeDetails: dp.routeDetails,
      };
    });

    res.json({
      success: true,
      date: targetDate,
      data: dpAuditList,
      rawRows: rows,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reports/adhoc — AdHoc Product Report Data
// ─────────────────────────────────────────────────────────────────────────────
const getAdhocReportData = async (req, res, next) => {
  try {
    const { mode = 'daily', date, startDate, endDate } = req.query;
    const targetDate = date || getISTDate();

    let dateWhere = `date = $1`;
    let params = [targetDate];

    if (mode === 'custom' && startDate && endDate) {
      dateWhere = `date >= $1 AND date <= $2`;
      params = [startDate, endDate];
    } else if (mode === 'monthly' && date) {
      const [y, m] = date.split('-');
      dateWhere = `EXTRACT(YEAR FROM date) = $1 AND EXTRACT(MONTH FROM date) = $2`;
      params = [parseInt(y), parseInt(m)];
    }

    // Fetch central inventory totals for range
    const centralRes = await readFromCRM(
      `SELECT
         p.id as product_id, p.name as product_name, p.unit, p.price_per_unit, p.sku,
         COALESCE(SUM(c.opening_stock), 0) as total_opening,
         COALESCE(SUM(c.added_stock), 0) as total_added,
         COALESCE(SUM(c.dp_issued_stock), 0) as total_dp_issued,
         COALESCE(SUM(c.remaining_stock), 0) as total_remaining
       FROM products p
       LEFT JOIN adhoc_central_inventory c ON c.product_id = p.id AND ${dateWhere}
       WHERE p.category = 'AdHoc' AND p.status = 'Active'
       GROUP BY p.id, p.name, p.unit, p.price_per_unit, p.sku
       ORDER BY p.name ASC`,
      params
    );

    // Fetch DP sales totals for range
    const dpRes = await readFromCRM(
      `SELECT
         product_id,
         COALESCE(SUM(quantity_taken), 0) as total_taken,
         COALESCE(SUM(quantity_sold), 0) as total_sold,
         COALESCE(SUM(quantity_returned), 0) as total_returned,
         COALESCE(SUM(quantity_remaining), 0) as total_dp_remaining,
         COALESCE(SUM(total_sales_amount), 0) as total_revenue
       FROM adhoc_dp_stock
       WHERE ${dateWhere}
       GROUP BY product_id`,
      params
    );

    const dpDataMap = new Map();
    (dpRes.rows || []).forEach(r => dpDataMap.set(r.product_id, r));

    // Combine Central & DP reports per product
    const productReports = (centralRes.rows || []).map(p => {
      const dp = dpDataMap.get(p.product_id) || {};
      const sold = parseFloat(dp.total_sold || 0);
      const price = parseFloat(p.price_per_unit || 0);
      const revenue = parseFloat(dp.total_revenue || (sold * price));

      return {
        productId: p.product_id,
        productName: p.product_name,
        unit: p.unit,
        pricePerUnit: price,
        sku: p.sku || '',
        openingStock: parseFloat(p.total_opening || 0),
        addedStock: parseFloat(p.total_added || 0),
        dpIssuedStock: parseFloat(p.total_dp_issued || 0),
        dpSoldStock: sold,
        dpReturnedStock: parseFloat(dp.total_returned || 0),
        remainingStock: parseFloat(p.total_remaining || 0),
        salesAmount: revenue,
      };
    });

    // Fetch DP Breakdown report for range
    const dpBreakdownRes = await readFromCRM(
      `SELECT
         dp_ref_id, dp_name, route_name, product_name,
         SUM(quantity_taken) as taken,
         SUM(quantity_sold) as sold,
         SUM(quantity_returned) as returned,
         SUM(quantity_remaining) as remaining,
         SUM(total_sales_amount) as revenue
       FROM adhoc_dp_stock
       WHERE ${dateWhere}
       GROUP BY dp_ref_id, dp_name, route_name, product_name
       ORDER BY dp_name ASC, product_name ASC`,
      params
    );

    const totalRevenue = productReports.reduce((a, b) => a + b.salesAmount, 0);
    const totalSoldUnits = productReports.reduce((a, b) => a + b.dpSoldStock, 0);

    res.json({
      success: true,
      mode,
      date: targetDate,
      summary: {
        totalRevenue,
        totalSoldUnits,
        totalProducts: productReports.length,
      },
      productReports,
      dpBreakdown: dpBreakdownRes.rows || [],
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/inventory/adhoc/override — Direct Override of AdHoc Central Stock
// (Equivalent to DB2 Override for milk items — for testing / manual correction)
// ─────────────────────────────────────────────────────────────────────────────
const overrideAdhocStock = async (req, res, next) => {
  try {
    const {
      productId,
      date,
      openingStock,
      addedStock,
      dpIssuedStock,
      remainingStock,
      overriddenBy = 'Super Admin',
      remarks = '',
    } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'productId is required.' });
    }

    const targetDate = date || getISTDate();
    const opening  = parseFloat(openingStock  ?? 0);
    const added    = parseFloat(addedStock    ?? 0);
    const dpIssued = parseFloat(dpIssuedStock ?? 0);
    // If remainingStock is explicitly provided use it; otherwise compute
    const remaining = remainingStock !== undefined && remainingStock !== null
      ? parseFloat(remainingStock)
      : Math.max(0, opening + added - dpIssued);

    // Verify product exists
    const prodRes = await readFromCRM(`SELECT id, name, unit FROM products WHERE id = $1`, [productId]);
    if (prodRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    const prod = prodRes.rows[0];

    // Upsert — overwrite all four columns for the target date
    await writeToCRM(
      `INSERT INTO adhoc_central_inventory
         (id, product_id, date, opening_stock, added_stock, dp_issued_stock, remaining_stock, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (product_id, date) DO UPDATE SET
         opening_stock   = EXCLUDED.opening_stock,
         added_stock     = EXCLUDED.added_stock,
         dp_issued_stock = EXCLUDED.dp_issued_stock,
         remaining_stock = EXCLUDED.remaining_stock,
         updated_by      = EXCLUDED.updated_by,
         updated_at      = NOW()`,
      [randomUUID(), productId, targetDate, opening, added, dpIssued, remaining, overriddenBy]
    );

    // Audit log
    await writeToCRM(
      `INSERT INTO adhoc_stock_transactions
         (id, date, product_id, product_name, transaction_type, quantity, performed_by, remarks)
       VALUES ($1, $2, $3, $4, 'OVERRIDE', $5, $6, $7)`,
      [randomUUID(), targetDate, productId, prod.name, remaining, overriddenBy,
       remarks || `Direct override: opening=${opening}, added=${added}, dpIssued=${dpIssued}, remaining=${remaining}`]
    );

    // Sync directly to DB2 (Manager App DB)
    await syncAdhocProductToDB2(prod.name, targetDate, added, remaining, opening);

    res.json({
      success: true,
      message: `Stock overridden for ${prod.name} on ${targetDate} and synchronized to Manager App DB2!`,
      data: { productId, productName: prod.name, date: targetDate, openingStock: opening, addedStock: added, dpIssuedStock: dpIssued, remainingStock: remaining },
    });
  } catch (err) { next(err); }
};

module.exports = {
  getAdhocInventory,
  addAdhocStock,
  issueDpAdhocStock,
  getDpAdhocStock,
  recordDpAdhocSale,
  recordCustomerAdhocSale,
  getDpAdhocAudit,
  getAdhocReportData,
  overrideAdhocStock,
};

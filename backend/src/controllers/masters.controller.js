const { readFromCRM, writeToCRM, readFromApp } = require('../config/database');

// ── PRODUCTS ──────────────────────────────────────────────

const getProducts = async (req, res, next) => {
  try {
    const result = await readFromCRM('SELECT * FROM products ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

const createProduct = async (req, res, next) => {
  try {
    const { name, category, unit, price_per_unit, image_url, status = 'Active' } = req.body;
    if (!name || !unit || !price_per_unit) return res.status(400).json({ success: false, message: 'Name, unit, and price required.' });
    const result = await writeToCRM(
      'INSERT INTO products (name, category, unit, price_per_unit, image_url, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [name, category || 'Milk', unit, price_per_unit, image_url || null, status]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, category, unit, price_per_unit, image_url, status } = req.body;
    await writeToCRM(
      'UPDATE products SET name=$1, category=$2, unit=$3, price_per_unit=$4, image_url=$5, status=$6 WHERE id=$7',
      [name, category, unit, price_per_unit, image_url, status, id]
    );
    res.json({ success: true, message: 'Product updated.' });
  } catch (err) { next(err); }
};

const deleteProduct = async (req, res, next) => {
  try {
    await writeToCRM('UPDATE products SET status=$1 WHERE id=$2', ['Inactive', req.params.id]);
    res.json({ success: true, message: 'Product deactivated.' });
  } catch (err) { next(err); }
};

// ── BRANCHES ──────────────────────────────────────────────

const getBranches = async (req, res, next) => {
  try {
    const result = await readFromCRM('SELECT * FROM branches ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

const createBranch = async (req, res, next) => {
  try {
    const { branch_name, address, lat, lng, status = 'Active' } = req.body;
    if (!branch_name) return res.status(400).json({ success: false, message: 'Branch name required.' });
    const result = await writeToCRM(
      'INSERT INTO branches (branch_name, address, lat, lng, status) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [branch_name, address || '', lat || null, lng || null, status]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

const updateBranch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { branch_name, address, lat, lng, status } = req.body;
    await writeToCRM(
      'UPDATE branches SET branch_name=$1, address=$2, lat=$3, lng=$4, status=$5 WHERE id=$6',
      [branch_name, address, lat, lng, status, id]
    );
    res.json({ success: true, message: 'Branch updated.' });
  } catch (err) { next(err); }
};

// ── ROUTES ────────────────────────────────────────────────

const ROUTE_NAME_MAP = {
  'alwarpet': 'Alwarpet 1',
  'alwarpet 1': 'Alwarpet 1',
  'egmore': 'Egmore 1',
  'egmore 1': 'Egmore 1',
  'mandaveli 1': 'Mandaveli 1',
  'mandaveli 2': 'Mandaveli 2',
  'mrc ngr': 'MRC Ngr',
  'mylapore 1': 'Mylapore 1',
  'mylapore 2': 'Mylapore 2',
  'nungambakkam': 'Nungambakkam 1',
  'nungambakkam 1': 'Nungambakkam 1',
  'royapettah': 'Royapettah 2',
  'royapettah 2': 'Royapettah 2',
  't-nagar': 'T-Nagar 1',
  't-nagar 1': 'T-Nagar 1',
  'tnagar 1': 'T-Nagar 1',
  'teynampet': 'Teynampet 1',
  'teynampet 1': 'Teynampet 1',
  'triplicane': 'Triplicane 1',
  'triplicane 1': 'Triplicane 1',
  'west mambalam 1': 'West Mambalam 1',
  'w.mblm 1': 'West Mambalam 1',
  'west mambalam 2': 'West Mambalam 2',
  'w.mblm 2': 'West Mambalam 2',
};

const normalizeRouteName = (name) => {
  if (!name) return name;
  const lower = name.trim().toLowerCase();
  return ROUTE_NAME_MAP[lower] || name;
};

const getRoutes = async (req, res, next) => {
  try {
    let appRoutes = [];
    try {
      const appRouteRes = await readFromApp(
        `SELECT
          id,
          name                   AS route_name,
          zone                   AS branch_name,
          "customerCount"        AS customer_count,
          litres,
          "assignedDpId"         AS assigned_dp_id,
          "defaultPetrolAllowance" AS default_petrol_allowance,
          "createdAt"            AS created_at,
          "updatedAt"            AS updated_at,
          'Active'               AS status,
          'DB2'                  AS source
         FROM "Route"
         ORDER BY name ASC`
      );
      appRoutes = appRouteRes.rows.map(r => ({ ...r, route_name: normalizeRouteName(r.route_name) }));
      console.log(`📡 [DB2 Routes] Fetched ${appRoutes.length} routes from maram_milk_db`);
    } catch (e) {
      console.warn('⚠️ DB2 Route query warning:', e.message);
    }

    const crmRoutes = await readFromCRM(
      `SELECT r.*, b.branch_name,
        (SELECT COUNT(*) FROM customers c WHERE c.assigned_route_id = r.id::text OR c.assigned_route_id = r.route_name) as customer_count,
        'DB1' as source
       FROM routes r
       LEFT JOIN branches b ON b.id = r.branch_id
       ORDER BY r.created_at DESC`
    ).catch(() => ({ rows: [] }));

    // Hardcoded fallback using confirmed DB2 route names (used if DB2 temporarily times out)
    const fallbackDB2Routes = [
      { id: '69116213-871c-4d6c-88d3-84b59ac62e78', db2_id: 'db2-1',  route_name: 'Alwarpet 1',       branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 60,  status: 'Active', source: 'DB2-Cached' },
      { id: 'f0afbbb8-08e7-479d-9660-aae410018e01', db2_id: 'db2-2',  route_name: 'Egmore 1',          branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 80,  status: 'Active', source: 'DB2-Cached' },
      { id: '98791d4b-b096-49bb-bf0e-75ca51fca666', db2_id: 'db2-3',  route_name: 'Mandaveli 1',      branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 50,  status: 'Active', source: 'DB2-Cached' },
      { id: '9f2e4943-c2db-4ca8-9ee5-5a2c337241f9', db2_id: 'db2-4',  route_name: 'Mandaveli 2',      branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 50,  status: 'Active', source: 'DB2-Cached' },
      { id: '443e311b-0964-42dc-99de-9c18156a5d7f', db2_id: 'db2-5',  route_name: 'MRC Ngr',          branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 70,  status: 'Active', source: 'DB2-Cached' },
      { id: 'a7003dd8-219a-4546-9d9b-2969a60d716c', db2_id: 'db2-6',  route_name: 'Mylapore 1',       branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 60,  status: 'Active', source: 'DB2-Cached' },
      { id: '780f80f9-5207-43d5-bcdc-be6b341c9cd7', db2_id: 'db2-7',  route_name: 'Mylapore 2',       branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 60,  status: 'Active', source: 'DB2-Cached' },
      { id: '1b4a924f-1a3c-4658-9e23-a2a060917ac2', db2_id: 'db2-8',  route_name: 'Nungambakkam 1',    branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 90,  status: 'Active', source: 'DB2-Cached' },
      { id: '9f3ffe40-d485-4995-9dd0-ac74735c6402', db2_id: 'db2-9',  route_name: 'Royapettah 2',      branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 70,  status: 'Active', source: 'DB2-Cached' },
      { id: 'ab684dcb-a4eb-4135-ad41-b07158c30c4b', db2_id: 'db2-10', route_name: 'T-Nagar 1',         branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 100, status: 'Active', source: 'DB2-Cached' },
      { id: '59311df6-345e-47d8-97c6-f71c0f64e1eb', db2_id: 'db2-11', route_name: 'Teynampet 1',       branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 70,  status: 'Active', source: 'DB2-Cached' },
      { id: '9835f558-456c-423f-985b-f21b981172d6', db2_id: 'db2-12', route_name: 'Triplicane 1',      branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 60,  status: 'Active', source: 'DB2-Cached' },
      { id: 'c041d6b2-ea1c-488d-a293-b755f3c66aa4', db2_id: 'db2-13', route_name: 'West Mambalam 1',  branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 80,  status: 'Active', source: 'DB2-Cached' },
      { id: '6f304069-2df7-496b-b991-8c69ba597859', db2_id: 'db2-14', route_name: 'West Mambalam 2',  branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 80,  status: 'Active', source: 'DB2-Cached' },
    ];

    const baseList = appRoutes.length > 0 ? appRoutes : fallbackDB2Routes;

    // Sync routes into DB1 routes table so FK/JOIN lookups succeed
    for (const r of baseList) {
      try {
        if (r.id && r.id.includes('-') && r.id.length === 36) {
          await writeToCRM(
            `INSERT INTO routes (id, route_name, status)
             VALUES ($1, $2, 'Active')
             ON CONFLICT (id) DO UPDATE SET route_name = EXCLUDED.route_name`,
            [r.id, r.route_name]
          ).catch(() => {});
        } else {
          const check = await readFromCRM(`SELECT id FROM routes WHERE LOWER(route_name) = LOWER($1)`, [r.route_name]);
          if (check.rows.length === 0) {
            await writeToCRM(`INSERT INTO routes (route_name, status) VALUES ($1, 'Active')`, [r.route_name]);
          }
        }
      } catch (err) {
        // ignore individual route sync error
      }
    }

    // Deduplicate by route_name (CRM routes take priority over base list so UUID matches)
    const routeMap = new Map();
    for (const r of baseList) {
      if (r?.route_name) routeMap.set(r.route_name.trim().toLowerCase(), r);
    }
    for (const r of crmRoutes.rows) {
      if (r?.route_name) {
        const normName = normalizeRouteName(r.route_name);
        const key = normName.trim().toLowerCase();
        const existing = routeMap.get(key);
        routeMap.set(key, { ...existing, ...r, route_name: normName, source: 'DB1' });
      }
    }

    const finalRoutes = Array.from(routeMap.values());

    res.json({ success: true, data: finalRoutes, db2_count: appRoutes.length, db1_count: crmRoutes.rows.length });
  } catch (err) { next(err); }
};


const createRoute = async (req, res, next) => {
  try {
    const { route_name, branch_id, status = 'Active' } = req.body;
    if (!route_name) return res.status(400).json({ success: false, message: 'Route name required.' });
    const result = await writeToCRM(
      'INSERT INTO routes (route_name, branch_id, status) VALUES ($1,$2,$3) RETURNING *',
      [route_name, branch_id || null, status]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

const updateRoute = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { route_name, branch_id, status } = req.body;
    await writeToCRM(
      'UPDATE routes SET route_name=$1, branch_id=$2, status=$3 WHERE id=$4',
      [route_name, branch_id, status, id]
    );
    res.json({ success: true, message: 'Route updated.' });
  } catch (err) { next(err); }
};

const deleteRoute = async (req, res, next) => {
  try {
    const { id } = req.params;
    await writeToCRM('DELETE FROM routes WHERE id=$1', [id]);
    res.json({ success: true, message: 'Route deleted successfully.' });
  } catch (err) { next(err); }
};

// ── DPs BY ROUTE ────────────────────────────────────────────────
// GET /api/masters/dps-by-route?route_name=Teynampet
// Returns all DPs assigned to the given route from DB2
const getDpsByRoute = async (req, res, next) => {
  try {
    const { route_name = '' } = req.query;
    if (!route_name) return res.json({ success: true, data: [] });

    let dps = [];
    try {
      // Find the route in DB2 by name (case-insensitive)
      const routeRes = await readFromApp(
        `SELECT id, name, "assignedDpId" FROM "Route" WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        [route_name]
      );

      if (routeRes.rows.length > 0) {
        const route = routeRes.rows[0];
        if (route.assignedDpId) {
          // Fetch the assigned DP
          const dpRes = await readFromApp(
            `SELECT id, name, "dpCode", "mobileNumber", "vehicleNumber", zone, "isActive"
             FROM "DeliveryPerson" WHERE id = $1`,
            [route.assignedDpId]
          );
          dps = dpRes.rows;
        } else {
          // No assigned DP — return all active DPs in same zone
          const dpRes = await readFromApp(
            `SELECT id, name, "dpCode", "mobileNumber", "vehicleNumber", zone, "isActive"
             FROM "DeliveryPerson" WHERE "isActive" = true AND LOWER(name) NOT IN ('adam', 'pradeep', 'praddep', 'test', 'test dp', 'imran') AND "dpCode" NOT IN ('DP018', 'DP019', 'DP020') ORDER BY name ASC`
          );
          dps = dpRes.rows;
        }
      } else {
        // Route not found in DB2 — return all active DPs
        const dpRes = await readFromApp(
          `SELECT id, name, "dpCode", "mobileNumber", "vehicleNumber", zone, "isActive"
           FROM "DeliveryPerson" WHERE "isActive" = true AND LOWER(name) NOT IN ('adam', 'pradeep', 'praddep', 'test', 'test dp') AND "dpCode" NOT IN ('DP018', 'DP019', 'DP020') ORDER BY name ASC`
        );
        dps = dpRes.rows;
      }
    } catch (e) {
      console.warn('⚠️ DB2 getDpsByRoute warning:', e.message);
      // Fallback static DPs if DB2 is unavailable
      dps = [
        { id: 'dp-1', name: 'Ansar Ali',      dpCode: 'DP-101', mobileNumber: '', vehicleNumber: 'TN 39 AB 1024', zone: 'Zone A' },
        { id: 'dp-2', name: 'Karthik Raja',   dpCode: 'DP-102', mobileNumber: '', vehicleNumber: 'TN 39 CD 5678', zone: 'Zone A' },
        { id: 'dp-3', name: 'Saravana Kumar', dpCode: 'DP-103', mobileNumber: '', vehicleNumber: 'TN 39 EF 9012', zone: 'Zone B' },
        { id: 'dp-4', name: 'Ramesh Babu',    dpCode: 'DP-104', mobileNumber: '', vehicleNumber: 'TN 39 GH 3456', zone: 'Zone B' },
      ];
    }

    res.json({
      success: true,
      data: dps.map(d => ({
        id: d.id,
        name: d.name,
        dpCode: d.dpCode,
        phone: d.mobileNumber || '',
        vehicle: d.vehicleNumber || '',
        zone: d.zone || '',
      })),
    });
  } catch (err) { next(err); }
};

module.exports = {
  getProducts, createProduct, updateProduct, deleteProduct,
  getBranches, createBranch, updateBranch,
  getRoutes, createRoute, updateRoute, deleteRoute,
  getDpsByRoute,
};

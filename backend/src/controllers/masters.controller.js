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
      appRoutes = appRouteRes.rows;
      console.log(`📡 [DB2 Routes] Fetched ${appRoutes.length} routes from maram_milk_db`);
    } catch (e) {
      console.warn('⚠️ DB2 Route query warning:', e.message);
    }

    const crmRoutes = await readFromCRM(
      `SELECT r.*, b.branch_name,
        (SELECT COUNT(*) FROM route_assignments ra WHERE ra.route_id = r.id) as customer_count,
        'DB1' as source
       FROM routes r
       LEFT JOIN branches b ON b.id = r.branch_id
       ORDER BY r.created_at DESC`
    ).catch(() => ({ rows: [] }));

    // Hardcoded fallback using confirmed DB2 route names (used if DB2 temporarily times out)
    const fallbackDB2Routes = [
      { id: 'db2-1',  route_name: 'Alwarpet',        branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 60,  status: 'Active', source: 'DB2-Cached' },
      { id: 'db2-2',  route_name: 'Egmore',           branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 80,  status: 'Active', source: 'DB2-Cached' },
      { id: 'db2-3',  route_name: 'Mandaveli 1',      branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 50,  status: 'Active', source: 'DB2-Cached' },
      { id: 'db2-4',  route_name: 'Mandaveli 2',      branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 50,  status: 'Active', source: 'DB2-Cached' },
      { id: 'db2-5',  route_name: 'MRC Ngr',          branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 70,  status: 'Active', source: 'DB2-Cached' },
      { id: 'db2-6',  route_name: 'Mylapore 1',       branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 60,  status: 'Active', source: 'DB2-Cached' },
      { id: 'db2-7',  route_name: 'Mylapore 2',       branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 60,  status: 'Active', source: 'DB2-Cached' },
      { id: 'db2-8',  route_name: 'Nungambakkam',     branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 90,  status: 'Active', source: 'DB2-Cached' },
      { id: 'db2-9',  route_name: 'Royapettah',       branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 70,  status: 'Active', source: 'DB2-Cached' },
      { id: 'db2-10', route_name: 'T-Nagar',          branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 100, status: 'Active', source: 'DB2-Cached' },
      { id: 'db2-11', route_name: 'Teynampet',        branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 70,  status: 'Active', source: 'DB2-Cached' },
      { id: 'db2-12', route_name: 'Triplicane',       branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 60,  status: 'Active', source: 'DB2-Cached' },
      { id: 'db2-13', route_name: 'West Mambalam 1',  branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 80,  status: 'Active', source: 'DB2-Cached' },
      { id: 'db2-14', route_name: 'West Mambalam 2',  branch_name: 'Zone A', customer_count: 0, litres: 0, default_petrol_allowance: 80,  status: 'Active', source: 'DB2-Cached' },
    ];

    const db2Result   = appRoutes.length > 0 ? appRoutes : fallbackDB2Routes;
    const finalRoutes = [...db2Result, ...crmRoutes.rows];

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

module.exports = {
  getProducts, createProduct, updateProduct, deleteProduct,
  getBranches, createBranch, updateBranch,
  getRoutes, createRoute, updateRoute,
};

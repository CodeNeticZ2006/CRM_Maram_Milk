const bcrypt = require('bcryptjs');
const { readFromCRM, writeToCRM, readFromApp, writeToApp } = require('../config/database');

// ─────────────────────────────────────────────
// GET /api/access-control/admin-profile — Root Super Admin from super_admin table
// ─────────────────────────────────────────────
const getAdminProfile = async (req, res, next) => {
  try {
    const result = await readFromCRM(
      'SELECT id, name, email, phone, role, last_login FROM super_admin ORDER BY id ASC LIMIT 1'
    ).catch(() => ({ rows: [] }));

    const admin = result.rows[0] || null;
    res.json({ success: true, data: admin });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/access-control/users — All CRM & Manager Users
// ─────────────────────────────────────────────
const getUsers = async (req, res, next) => {
  try {
    // Fetch CRM super_admin users from DB1
    const crmAdmins = await readFromCRM('SELECT id, name, email, phone, role, status, access, last_login, created_at FROM super_admin_users ORDER BY created_at DESC')
      .catch(async () => {
        // Fallback table creation if table doesn't exist yet
        await writeToCRM(`
          CREATE TABLE IF NOT EXISTS super_admin_users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(150) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            phone VARCHAR(20),
            role VARCHAR(50) DEFAULT 'Manager',
            status VARCHAR(20) DEFAULT 'Active',
            access VARCHAR(50) DEFAULT 'LIMITED',
            permissions JSONB DEFAULT '[]'::jsonb,
            last_login TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `).catch(() => {});
        return { rows: [] };
      });

    // Fetch Managers from DB2 (maram_milk_db)
    let managersFromApp = [];
    try {
      const appManagerRes = await readFromApp('SELECT id, name, email, "branchName", role, "createdAt" FROM "Manager"');
      managersFromApp = appManagerRes.rows.map(m => ({
        id: `db2-${m.id}`,
        name: m.name || 'Branch Manager',
        email: m.email,
        phone: '—',
        role: m.role || 'Manager',
        status: 'Active',
        access: 'MANAGER_APP',
        branchName: m.branchName,
        source: 'DB2 Manager App',
        created_at: m.createdAt,
      }));
    } catch (db2Err) {
      console.warn('⚠️ DB2 Manager query skipped:', db2Err.message);
    }

    res.json({
      success: true,
      data: {
        crm_users: crmAdmins.rows,
        manager_app_users: managersFromApp,
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// GET /api/access-control/delivery-persons — DP Details from DB2
// ─────────────────────────────────────────────
const getDeliveryPersons = async (req, res, next) => {
  try {
    let dpList = [];
    try {
      const [dpRes, routeRes] = await Promise.all([
        readFromApp(
          'SELECT id, name, "dpCode", "mobileNumber", "vehicleNumber", zone, "petrolBalance", "isActive", "dateOfJoining", "bankAccountDetails" FROM "DeliveryPerson" WHERE "isActive" = true AND LOWER(name) NOT IN (\'adam\', \'pradeep\', \'praddep\', \'test\', \'test dp\', \'imran\') AND "dpCode" NOT IN (\'DP018\', \'DP019\', \'DP020\') ORDER BY "dpCode" ASC, name ASC'
        ),
        readFromApp('SELECT id, name, "assignedDpId" FROM "Route" ORDER BY name ASC').catch(() => ({ rows: [] })),
      ]);
      const dpRows = dpRes.rows || [];
      const routeRows = routeRes.rows || [];

      dpList = dpRows.map(dp => {
        const masterRoutes = routeRows.filter(r => String(r.assignedDpId) === String(dp.id)).map(r => r.name).filter(Boolean);
        return {
          ...dp,
          assignedRoute: masterRoutes.length > 0 ? masterRoutes.join(', ') : (dp.zone || 'Unassigned'),
        };
      });
    } catch (err) {
      console.warn('⚠️ DB2 DeliveryPerson query error:', err.message);
    }

    res.json({
      success: true,
      data: dpList,
      total: dpList.length,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// POST /api/access-control/users — Create User / Manager Account
// ─────────────────────────────────────────────
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role = 'Manager', access = 'LIMITED', permissions = [] } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await writeToCRM(
      `INSERT INTO super_admin_users (name, email, password_hash, role, status, access, permissions)
       VALUES ($1, $2, $3, $4, 'Active', $5, $6) RETURNING id, name, email, role, status, access, permissions, created_at`,
      [name, email.trim().toLowerCase(), hash, role, access, JSON.stringify(permissions)]
    );

    res.status(201).json({
      success: true,
      message: `User account created for ${name} (${role}).`,
      data: result.rows[0],
    });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ success: false, message: 'Email already exists.' });
    next(err);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/access-control/users/:id — Full User Update (name, email, role, access, permissions, status, password)
// ─────────────────────────────────────────────
const updateUserPermissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, role, access, permissions, status, password } = req.body;

    // Build dynamic SET clause
    const setClauses = [];
    const values = [];
    let idx = 1;

    if (name)        { setClauses.push(`name=$${idx++}`);        values.push(name); }
    if (email)       { setClauses.push(`email=$${idx++}`);       values.push(email.trim().toLowerCase()); }
    if (role)        { setClauses.push(`role=$${idx++}`);        values.push(role); }
    if (access)      { setClauses.push(`access=$${idx++}`);      values.push(access); }
    if (permissions) { setClauses.push(`permissions=$${idx++}`); values.push(JSON.stringify(permissions)); }
    if (status)      { setClauses.push(`status=$${idx++}`);      values.push(status); }
    if (password && password.length >= 8) {
      const hash = await bcrypt.hash(password, 12);
      setClauses.push(`password_hash=$${idx++}`);
      values.push(hash);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided to update.' });
    }

    values.push(id);
    await writeToCRM(
      `UPDATE super_admin_users SET ${setClauses.join(', ')} WHERE id=$${idx}`,
      values
    );
    res.json({ success: true, message: 'User updated successfully.' });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ success: false, message: 'Email already in use by another account.' });
    next(err);
  }
};

// ─────────────────────────────────────────────
// PUT /api/access-control/delivery-persons/:id — Update DP profile in DB2
// ─────────────────────────────────────────────
const updateDeliveryPerson = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      mobileNumber,
      vehicleNumber,
      zone,
      isActive,
      assignedRoute,
      address,
    } = req.body;

    const setClauses = [];
    const values = [];
    let idx = 1;

    if (name !== undefined)          { setClauses.push(`name=$${idx++}`);            values.push(name); }
    if (mobileNumber !== undefined)  { setClauses.push(`"mobileNumber"=$${idx++}`);  values.push(mobileNumber); }
    if (vehicleNumber !== undefined) { setClauses.push(`"vehicleNumber"=$${idx++}`); values.push(vehicleNumber); }
    if (zone !== undefined)          { setClauses.push(`zone=$${idx++}`);            values.push(zone); }
    if (address !== undefined)       { setClauses.push(`address=$${idx++}`);         values.push(address); }
    if (isActive !== undefined)      { setClauses.push(`"isActive"=$${idx++}`);      values.push(Boolean(isActive)); }

    setClauses.push(`"updatedAt"=NOW()`);

    if (setClauses.length > 1) {
      values.push(id);
      await writeToApp(
        `UPDATE "DeliveryPerson" SET ${setClauses.join(', ')} WHERE id=$${idx} OR "dpCode"=$${idx}`,
        values
      ).catch(e => console.warn('⚠️ DB2 DeliveryPerson update error:', e.message));
    }

    // If assignedRoute is updated, update the Route in DB2
    if (assignedRoute !== undefined) {
      // Unassign this DP from other routes
      await writeToApp(`UPDATE "Route" SET "assignedDpId"=NULL WHERE "assignedDpId"=$1`, [id]).catch(() => {});
      if (assignedRoute && assignedRoute !== 'Unassigned') {
        // Assign to new route
        await writeToApp(
          `UPDATE "Route" SET "assignedDpId"=$1 WHERE LOWER(name)=LOWER($2)`,
          [id, assignedRoute.trim()]
        ).catch(() => {});
      }
    }

    // Also update CRM subscriptions if name changed
    if (name) {
      await writeToCRM(
        `UPDATE subscriptions SET delivery_person_name=$1 WHERE delivery_person_id=$2 OR delivery_person_name=(SELECT name FROM "DeliveryPerson" WHERE id=$2 LIMIT 1)`,
        [name, id]
      ).catch(() => {});
    }

    res.json({ success: true, message: 'Delivery Person updated successfully.' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// DELETE /api/access-control/delivery-persons/:id — Delete/Deactivate DP in DB2
// ─────────────────────────────────────────────
const deleteDeliveryPerson = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if DP has active subscriptions in CRM
    const subCheck = await readFromCRM(
      `SELECT COUNT(*) FROM subscriptions WHERE delivery_person_id=$1 OR delivery_person_name IN (SELECT name FROM "DeliveryPerson" WHERE id=$1 OR "dpCode"=$1)`,
      [id]
    ).catch(() => ({ rows: [{ count: 0 }] }));

    const activeSubCount = parseInt(subCheck.rows[0]?.count || 0);

    // Unassign DP from any routes
    await writeToApp(`UPDATE "Route" SET "assignedDpId"=NULL WHERE "assignedDpId"=$1`, [id]).catch(() => {});

    if (activeSubCount > 0) {
      // Deactivate to preserve historical deliveries
      await writeToApp(`UPDATE "DeliveryPerson" SET "isActive"=false, "updatedAt"=NOW() WHERE id=$1 OR "dpCode"=$1`, [id]).catch(() => {});
      return res.json({
        success: true,
        archived: true,
        message: `Delivery Person deactivated (${activeSubCount} subscription(s) linked). Route unassigned.`,
      });
    }

    // Hard delete or deactivate if FK constraint exists
    try {
      await writeToApp(`DELETE FROM "DeliveryPerson" WHERE id=$1 OR "dpCode"=$1`, [id]);
    } catch {
      await writeToApp(`UPDATE "DeliveryPerson" SET "isActive"=false, "updatedAt"=NOW() WHERE id=$1 OR "dpCode"=$1`, [id]).catch(() => {});
    }

    res.json({ success: true, archived: false, message: 'Delivery Person deleted successfully.' });
  } catch (err) { next(err); }
};

module.exports = {
  getAdminProfile,
  getUsers,
  getDeliveryPersons,
  createUser,
  updateUserPermissions,
  updateDeliveryPerson,
  deleteDeliveryPerson,
};

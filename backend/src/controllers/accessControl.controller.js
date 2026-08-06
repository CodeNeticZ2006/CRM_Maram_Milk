const bcrypt = require('bcryptjs');
const { readFromCRM, writeToCRM, readFromApp } = require('../config/database');

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
      const dpRes = await readFromApp(
        'SELECT id, name, "dpCode", "mobileNumber", "vehicleNumber", zone, "petrolBalance", "isActive", "dateOfJoining", "bankAccountDetails" FROM "DeliveryPerson" ORDER BY name ASC'
      );
      dpList = dpRes.rows;
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
// PATCH /api/access-control/users/:id/permissions — Update Role Permissions
// ─────────────────────────────────────────────
const updateUserPermissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, access, permissions, status } = req.body;
    await writeToCRM(
      `UPDATE super_admin_users SET role=$1, access=$2, permissions=$3, status=$4 WHERE id=$5`,
      [role, access, JSON.stringify(permissions || []), status || 'Active', id]
    );
    res.json({ success: true, message: 'Permissions updated successfully.' });
  } catch (err) { next(err); }
};

module.exports = { getUsers, getDeliveryPersons, createUser, updateUserPermissions };

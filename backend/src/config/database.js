const { Pool, types } = require('pg');
require('dotenv').config();

// Override PG OID 1082 (DATE) parser to return plain 'YYYY-MM-DD' string instead of JS Date object
types.setTypeParser(1082, (val) => val);

// ================================================
// DB1 — Super Admin CRM (Singapore) — READ + WRITE
// ================================================
const crmPool = new Pool({
  connectionString: process.env.CRM_DB_URL,
  ssl: process.env.CRM_DB_URL && (process.env.CRM_DB_URL.includes('localhost') || process.env.CRM_DB_URL.includes('127.0.0.1'))
    ? false
    : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
});

// Handle idle client errors so unexpected connection resets (e.g. ECONNRESET on Render) do not crash the app
crmPool.on('error', (err) => {
  console.warn('⚠️  Unexpected idle error on DB1 (CRM) pool:', err.message);
});

// ================================================
// DB2 — Manager App DB (Oregon) — READ-ONLY
// ================================================
const appPool = new Pool({
  connectionString: process.env.APP_DB_URL,
  ssl: process.env.APP_DB_URL && (process.env.APP_DB_URL.includes('localhost') || process.env.APP_DB_URL.includes('127.0.0.1'))
    ? false
    : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
});

appPool.on('error', (err) => {
  console.warn('⚠️  Unexpected idle error on DB2 (App) pool:', err.message);
});

// Test connections on startup
const testConnections = async () => {
  try {
    const crmRes = await crmPool.query('SELECT NOW()');
    console.log('✅ DB1 (CRM - Singapore) connected:', crmRes.rows[0].now);
  } catch (err) {
    console.error('⚠️  DB1 (CRM) connection failed (will retry on requests):', err.message);
  }

  try {
    const appRes = await appPool.query('SELECT NOW()');
    console.log('✅ DB2 (App - Oregon) connected [READ-ONLY]:', appRes.rows[0].now);
  } catch (err) {
    console.error('⚠️  DB2 (App) connection failed (will retry on requests):', err.message);
  }
};

// ================================================
// SAFE QUERY HELPERS
// ================================================

/** Write to DB1 (CRM Storage) */
const writeToCRM = (query, params) => crmPool.query(query, params);

/** Read from DB1 (CRM Storage) */
const readFromCRM = (query, params) => crmPool.query(query, params);

/** Read from DB2 (Manager App) */
const readFromApp = (query, params) => appPool.query(query, params);

/** Write to DB2 (Manager App - Inventory updates by Super Admin) */
const writeToApp = (query, params) => appPool.query(query, params);

module.exports = { crmPool, appPool, writeToCRM, readFromCRM, readFromApp, writeToApp, testConnections };

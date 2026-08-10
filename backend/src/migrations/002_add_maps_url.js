const { writeToCRM } = require('../config/database');

const runMigration002 = async () => {
  console.log('🔄 Running migration 002 — add maps_url to customers...');

  const queries = [
    // Add maps_url column to customers
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS maps_url TEXT`,

    // Ensure routes table exists (CRM-local routes for Teynampet etc.)
    `CREATE TABLE IF NOT EXISTS routes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      route_name VARCHAR(100) NOT NULL,
      branch_id UUID,
      status VARCHAR(20) DEFAULT 'Active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  ];

  for (const q of queries) {
    await writeToCRM(q);
    console.log('  ✅', q.slice(0, 60).replace(/\n/g, ' '));
  }

  console.log('✅ Migration 002 complete.');
};

module.exports = { runMigration002 };

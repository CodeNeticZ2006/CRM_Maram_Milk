
const { writeToCRM } = require('../config/database');

const runMigration003 = async () => {
  console.log('🔄 Running migration 003 — alter assigned_route_id to VARCHAR...');

  const queries = [
    // Change assigned_route_id column from UUID to VARCHAR(100)
    `ALTER TABLE customers ALTER COLUMN assigned_route_id TYPE VARCHAR(100) USING assigned_route_id::text`,
  ];

  for (const q of queries) {
    try {
      await writeToCRM(q);
      console.log('  ✅', q.slice(0, 80));
    } catch (e) {
      console.warn('  ⚠️ Migration step warning:', e.message);
    }
  }

  console.log('✅ Migration 003 complete.');
};

module.exports = { runMigration003 };

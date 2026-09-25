const { writeToCRM } = require('../config/database');

const runMigration008 = async () => {
  console.log('🔄 Running Migration 008 — add packing_type to products...');
  try {
    await writeToCRM(`ALTER TABLE products ADD COLUMN IF NOT EXISTS packing_type VARCHAR(30) DEFAULT 'Bottle'`);
    // Backfill existing products based on unit or name if packing_type is null/empty
    await writeToCRM(`
      UPDATE products
      SET packing_type = CASE
        WHEN LOWER(unit) LIKE '%packet%' OR LOWER(name) LIKE '%packet%' THEN 'Packet'
        WHEN LOWER(unit) LIKE '%can%' OR LOWER(name) LIKE '%can%' THEN 'Can'
        ELSE 'Bottle'
      END
      WHERE packing_type IS NULL OR packing_type = ''
    `);
    console.log('✅ Migration 008 completed: packing_type added and backfilled on products table.');
  } catch (err) {
    console.error('❌ Migration 008 error:', err.message);
    throw err;
  }
};

module.exports = { runMigration008 };

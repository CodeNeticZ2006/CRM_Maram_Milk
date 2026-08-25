const { writeToCRM } = require('../config/database');

const runMigration004 = async () => {
  console.log('🔄 Running migration 004: Create operational_days table...');
  const query = `
    CREATE TABLE IF NOT EXISTS operational_days (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      date DATE UNIQUE NOT NULL,
      status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED')),
      opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMPTZ,
      rollover_time TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_op_days_date ON operational_days(date);
    CREATE INDEX IF NOT EXISTS idx_op_days_status ON operational_days(status);
  `;
  try {
    await writeToCRM(query);
    console.log('✅ Migration 004 completed: operational_days table created');
  } catch (err) {
    console.warn('⚠️ Migration 004 warning:', err.message);
  }
};

module.exports = { runMigration004 };

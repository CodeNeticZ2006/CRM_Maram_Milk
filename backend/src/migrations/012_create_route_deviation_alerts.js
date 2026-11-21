const { writeToCRM } = require('../config/database');

const runMigration012 = async () => {
  console.log('🔄 Running Migration 012: Create route_deviation_alerts table in DB1 (CRM)...');

  const query = `
    CREATE TABLE IF NOT EXISTS route_deviation_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dp_id VARCHAR(50) NOT NULL,
      dp_name VARCHAR(100),
      area_id VARCHAR(100) NOT NULL,
      area_name VARCHAR(100),
      type VARCHAR(50) NOT NULL CHECK (type IN ('OFF_ROUTE_DRIVING', 'OFF_ROUTE_STOPPED', 'CORRIDOR_DEVIATION')),
      started_at TIMESTAMPTZ NOT NULL,
      driving_seconds INTEGER DEFAULT 0,
      stopped_seconds INTEGER DEFAULT 0,
      max_distance DECIMAL(10,2) DEFAULT 0,
      location JSONB,
      trail JSONB,
      status VARCHAR(30) DEFAULT 'TO_BE_REVIEWED' CHECK (status IN ('TO_BE_REVIEWED', 'REVIEWED', 'DISMISSED')),
      reviewed_by VARCHAR(100),
      reviewed_at TIMESTAMPTZ,
      review_note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_status ON route_deviation_alerts(status);
    CREATE INDEX IF NOT EXISTS idx_alerts_dp ON route_deviation_alerts(dp_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_area ON route_deviation_alerts(area_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON route_deviation_alerts(created_at DESC);
  `;

  try {
    await writeToCRM(query);
    console.log('✅ Migration 012 Complete: route_deviation_alerts table created.');
  } catch (err) {
    console.error('❌ Migration 012 Error:', err.message);
    throw err;
  }
};

if (require.main === module) {
  runMigration012().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runMigration012 };

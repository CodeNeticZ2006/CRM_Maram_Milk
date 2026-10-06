const { crmPool } = require('../config/database');

async function runMigration011() {
  console.log('Running Migration 011 (Pause history and audit logs table)...');
  await crmPool.query(`
    CREATE TABLE IF NOT EXISTS pause_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pause_id UUID,
      subscription_id UUID,
      customer_id UUID,
      customer_name VARCHAR(255),
      customer_code VARCHAR(100),
      customer_phone VARCHAR(50),
      action VARCHAR(50) NOT NULL,
      pause_type VARCHAR(50) DEFAULT 'Temporary Hold',
      start_date DATE,
      end_date DATE,
      resume_date DATE,
      reason TEXT,
      details JSONB DEFAULT '{}'::jsonb,
      performed_by VARCHAR(100) DEFAULT 'Super Admin',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_pause_logs_created_at ON pause_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pause_logs_customer ON pause_logs(customer_id);
  `);
  console.log('✅ Migration 011 completed: pause_logs table and indexes ensured.');
}

module.exports = { runMigration011 };

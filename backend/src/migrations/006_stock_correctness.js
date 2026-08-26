const { writeToCRM } = require('../config/database');

const runMigration = async () => {
  console.log('🔄 Running Migration 006: Stock Correctness & Notifications Tables...');

  const queries = [
    // 1. Notifications Table
    `CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(150) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(30) NOT NULL DEFAULT 'Info',
      entity_type VARCHAR(50) DEFAULT 'Stock Correctness',
      entity_id UUID,
      link_url VARCHAR(255) DEFAULT '/inventory',
      dedup_key VARCHAR(255) UNIQUE,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 2. Stock Correctness Logs Table
    `CREATE TABLE IF NOT EXISTS stock_correctness_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      operational_day DATE NOT NULL,
      product_id VARCHAR(100) NOT NULL,
      product_name VARCHAR(150) NOT NULL,
      expected_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
      manager_logged_quantity DECIMAL(10,2),
      difference DECIMAL(10,2) NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL,
      review_status VARCHAR(30) NOT NULL DEFAULT 'Pending Review',
      detected_at TIMESTAMPTZ DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ,
      reviewed_by VARCHAR(100),
      remarks TEXT,
      notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
      CONSTRAINT unique_opday_product UNIQUE (operational_day, product_id)
    );`
  ];

  for (const query of queries) {
    await writeToCRM(query);
  }

  console.log('✅ Migration 006 Completed Successfully!');
};

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration 006 Failed:', err);
      process.exit(1);
    });
}

module.exports = runMigration;

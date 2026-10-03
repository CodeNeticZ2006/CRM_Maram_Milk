const { writeToCRM } = require('../config/database');

const runMigration009 = async () => {
  console.log('🔄 Running Migration 009 — subscription_items, schedules, price_history...');

  const queries = [
    // ── Extend subscriptions table ──────────────────────────────────────────
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS frequency_type VARCHAR(30) DEFAULT 'DAILY'`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS first_delivery_date DATE`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_cycle_start DATE`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS end_date DATE`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_date DATE`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS hub VARCHAR(100)`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS area VARCHAR(100)`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS delivery_person_name VARCHAR(100)`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS delivery_person_id VARCHAR(100)`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS customer_type VARCHAR(50) DEFAULT 'Regular'`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(50) DEFAULT 'Home Delivery'`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS notes TEXT`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
    `ALTER TABLE subscriptions ALTER COLUMN quantity DROP NOT NULL`,
    `ALTER TABLE subscriptions ALTER COLUMN quantity SET DEFAULT 1`,
    `ALTER TABLE subscriptions ALTER COLUMN product_id DROP NOT NULL`,

    // Add CHECK constraint safely (will fail silently if frequency_type already constrained)
    `DO $$
     BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM information_schema.constraint_column_usage
         WHERE table_name = 'subscriptions' AND column_name = 'frequency_type'
           AND constraint_name LIKE '%frequency_type%'
       ) THEN
         ALTER TABLE subscriptions ADD CONSTRAINT chk_frequency_type
           CHECK (frequency_type IN ('DAILY','ALTERNATE_DAY','CUSTOM_WEEKLY'));
       END IF;
     END $$`,

    // Backfill frequency_type from existing frequency column
    `UPDATE subscriptions SET frequency_type =
       CASE
         WHEN LOWER(COALESCE(frequency,'')) = 'daily' THEN 'DAILY'
         WHEN LOWER(COALESCE(frequency,'')) IN ('alternate','alternate day','alternate days') THEN 'ALTERNATE_DAY'
         WHEN LOWER(COALESCE(frequency,'')) IN ('weekly','custom','custom weekly') THEN 'CUSTOM_WEEKLY'
         ELSE 'DAILY'
       END
     WHERE frequency_type IS NULL`,

    // ── subscription_items — multi-product lines per subscription ──────────
    `CREATE TABLE IF NOT EXISTS subscription_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id),
      quantity DECIMAL(10,3) NOT NULL CHECK (quantity > 0),
      rate_snapshot DECIMAL(10,2),
      effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
      effective_to DATE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_sub_items_subscription ON subscription_items(subscription_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sub_items_product ON subscription_items(product_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sub_items_active ON subscription_items(subscription_id, is_active)`,

    // ── subscription_schedules — alternate/custom weekday config ───────────
    `CREATE TABLE IF NOT EXISTS subscription_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      subscription_id UUID NOT NULL UNIQUE REFERENCES subscriptions(id) ON DELETE CASCADE,
      frequency_type VARCHAR(30) NOT NULL DEFAULT 'DAILY',
      alternate_anchor_date DATE,
      custom_weekdays TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_sub_schedules_subscription ON subscription_schedules(subscription_id)`,

    // ── product_price_history — safe rate change tracking ─────────────────
    `CREATE TABLE IF NOT EXISTS product_price_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      old_price DECIMAL(10,2) NOT NULL,
      new_price DECIMAL(10,2) NOT NULL,
      effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
      changed_by VARCHAR(100),
      reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_price_history_product ON product_price_history(product_id)`,

    // ── Extend subscription_pauses for date-range pauses ──────────────────
    `ALTER TABLE subscription_pauses ADD COLUMN IF NOT EXISTS pause_start_date DATE`,
    `ALTER TABLE subscription_pauses ADD COLUMN IF NOT EXISTS pause_end_date DATE`,
    `ALTER TABLE subscription_pauses ADD COLUMN IF NOT EXISTS reason TEXT`,
    `ALTER TABLE subscription_pauses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE subscription_pauses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,

    // Backfill pause_start_date / pause_end_date from existing columns
    `UPDATE subscription_pauses
     SET pause_start_date = COALESCE(pause_date, created_at::date),
         pause_end_date   = COALESCE(resume_date, pause_date, created_at::date)
     WHERE pause_start_date IS NULL`,

    // Index for fast date-range pause lookups
    `CREATE INDEX IF NOT EXISTS idx_sub_pauses_dates ON subscription_pauses(subscription_id, pause_start_date, pause_end_date)`,
  ];

  for (const query of queries) {
    try {
      await writeToCRM(query);
    } catch (err) {
      // Ignore "already exists" / constraint already present errors — idempotent migrations
      const msg = err.message || '';
      if (msg.includes('already exists') || msg.includes('duplicate') || msg.includes('SQLSTATE 42701')) {
        console.log(`ℹ️  Migration 009 skip (already applied): ${msg.slice(0, 100)}`);
      } else {
        console.error('❌ Migration 009 error:', msg);
        throw err;
      }
    }
  }

  console.log('✅ Migration 009 completed.');
};

module.exports = { runMigration009 };


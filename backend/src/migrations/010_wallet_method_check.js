const { crmPool } = require('../config/database');

async function runMigration010() {
  console.log('Running Migration 010 (Wallet transactions method constraint)...');
  await crmPool.query(`
    ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_method_check;
    ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_method_check 
      CHECK (method IN ('Cash', 'GPay', 'PhonePe', 'Paytm', 'Razorpay', 'Adjustment', 'Wallet'));
  `);
  console.log('✅ Migration 010 completed: wallet_transactions_method_check updated.');
}

module.exports = { runMigration010 };

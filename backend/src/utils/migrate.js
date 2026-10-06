require('dotenv').config();
const { testConnections, crmPool } = require('../config/database');
const { runMigrations } = require('../migrations/001_create_tables');
const { runMigration002 } = require('../migrations/002_add_maps_url');
const { runMigration003 } = require('../migrations/003_alter_assigned_route_id');
const { runMigration004 } = require('../migrations/004_create_operational_days');
const { runAdhocMigrations } = require('../migrations/005_adhoc_inventory_and_sales');
const runMigration006 = require('../migrations/006_stock_correctness');
const { runMigration007: runMigration007RouteCustomers } = require('../migrations/007_seed_missing_route_customers');
const { runMigration007: runMigration007InventoryItems } = require('../migrations/007_seed_missing_inventory_items');
const { runMigration008 } = require('../migrations/008_add_packing_type');
const { runMigration009 } = require('../migrations/009_subscription_items');
const { runMigration010 } = require('../migrations/010_wallet_method_check');
const { runMigration011 } = require('../migrations/011_pause_logs');
const { seedSuperAdmin } = require('./seed');

async function runAllMigrations() {
  console.log('🚀 [Migration Runner] Starting database setup and all migrations (001 -> 011)...');
  await testConnections();

  try {
    console.log('\n[1/10] Running Migration 001 (Core Schema)...');
    await runMigrations();

    console.log('\n[2/10] Running Migration 002 (Maps URL)...');
    await runMigration002();

    console.log('\n[3/10] Running Migration 003 (Assigned Route ID)...');
    await runMigration003();

    console.log('\n[4/10] Running Migration 004 (Operational Days)...');
    await runMigration004();

    console.log('\n[5/10] Running Migration 005 (AdHoc Inventory & Sales)...');
    await runAdhocMigrations();

    console.log('\n[6/10] Running Migration 006 (Stock Correctness)...');
    await runMigration006();

    console.log('\n[7/10] Running Migration 007 (Seed Route Customers & Items)...');
    await runMigration007RouteCustomers();
    await runMigration007InventoryItems();

    console.log('\n[8/10] Running Migration 008 (Packing Type)...');
    await runMigration008();

    console.log('\n[9/11] Running Migration 009 (Multi-product Subscriptions, Schedules, Pauses, Price History)...');
    await runMigration009();

    console.log('\n[10/11] Running Migration 010 (Wallet transactions method check constraint)...');
    await runMigration010();

    console.log('\n[11/12] Running Migration 011 (Pause History & Audit Logs)...');
    await runMigration011();

    console.log('\n[12/12] Seeding Super Admin Account...');
    await seedSuperAdmin();

    console.log('\n🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!');
    await crmPool.end();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    await crmPool.end();
    process.exit(1);
  }
}

runAllMigrations();

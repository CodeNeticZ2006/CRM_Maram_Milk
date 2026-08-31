const { writeToCRM, readFromCRM } = require('../config/database');
const { getExpectedOperationalDate } = require('../services/operationalDay.service');
const { randomUUID } = require('crypto');

const runMigration007 = async () => {
  console.log('🔄 Running Migration 007: Seed Missing Inventory_Items Products...');

  try {
    // 1. Get current active operational date (7:00 PM IST boundary)
    const targetDate = getExpectedOperationalDate();
    console.log(`📅 Target operational date for inventory seed: ${targetDate}`);

    // Ensure backwards compatible view `adhoc_central_inventory` points to `"Inventory_Items"`
    await writeToCRM('CREATE OR REPLACE VIEW adhoc_central_inventory AS SELECT * FROM "Inventory_Items"');

    // 2. Define the 4 target missing products with search criteria
    const targetProductsDef = [
      {
        key: 'Karupatti',
        searchName: 'Karupatti - 500gm',
        sku: 'ADH-KARU-500GM',
      },
      {
        key: 'Milk 1L Bottle',
        searchName: 'Cow Milk (1 Litre)',
        sku: 'MLK-COW-1L',
      },
      {
        key: 'Milk 500ml Bottle',
        searchName: 'Cow Milk (500ml Bottle)',
        sku: 'MLK-COW-500MLB',
      },
      {
        key: 'Milk 500ml Packet',
        searchName: 'Cow Milk (500ml Packet)',
        sku: 'MLK-COW-500MLP',
      },
    ];

    let seededCount = 0;
    let skippedCount = 0;

    for (const pDef of targetProductsDef) {
      // Find existing product record in `products` table
      const prodRes = await readFromCRM(
        `SELECT id, name, category, unit, sku FROM products WHERE name = $1 OR sku = $2`,
        [pDef.searchName, pDef.sku]
      );

      if (prodRes.rows.length === 0) {
        console.warn(`⚠️ Product master record not found in 'products' table for ${pDef.key} (${pDef.searchName}). Skipping.`);
        continue;
      }

      const product = prodRes.rows[0];
      const productId = product.id;

      // Check whether an "Inventory_Items" record already exists for this product for targetDate
      const checkRes = await readFromCRM(
        `SELECT id FROM "Inventory_Items" WHERE product_id = $1 AND date = $2`,
        [productId, targetDate]
      );

      if (checkRes.rows.length > 0) {
        console.log(`  ℹ️ Inventory_Items record already exists for '${product.name}' (${productId}) on ${targetDate}. Skipping.`);
        skippedCount++;
        continue;
      }

      // Insert missing "Inventory_Items" record idempotently
      const newId = randomUUID();
      await writeToCRM(
        `INSERT INTO "Inventory_Items" (
          id, product_id, date, opening_stock, added_stock, dp_issued_stock, remaining_stock, updated_by, created_at, updated_at
        ) VALUES ($1, $2, $3, 0, 0, 0, 0, 'Super Admin Seed', NOW(), NOW())
        ON CONFLICT (product_id, date) DO NOTHING`,
        [newId, productId, targetDate]
      );

      console.log(`  ✅ Inserted missing Inventory_Items record for '${product.name}' (${productId}) on ${targetDate}. Initial stock: 0.`);
      seededCount++;
    }

    console.log(`✅ Migration 007 completed! Seeded: ${seededCount}, Skipped/Existing: ${skippedCount}`);
  } catch (err) {
    console.error('❌ Migration 007 Error:', err.message);
    throw err;
  }
};

if (require.main === module) {
  runMigration007()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration 007 execution failed:', err);
      process.exit(1);
    });
}

module.exports = { runMigration007 };

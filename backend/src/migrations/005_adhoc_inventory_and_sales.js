const { writeToCRM, readFromCRM } = require('../config/database');

const runAdhocMigrations = async () => {
  console.log('🔄 Running 005_adhoc_inventory_and_sales migrations on CRM DB...');

  const queries = [
    // 1. Ensure `category` and `sku` columns exist on `products` table
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Milk'`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(50)`,

    // 2. Central AdHoc Inventory table
    `CREATE TABLE IF NOT EXISTS adhoc_central_inventory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID REFERENCES products(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      opening_stock DECIMAL(10,3) DEFAULT 0,
      added_stock DECIMAL(10,3) DEFAULT 0,
      dp_issued_stock DECIMAL(10,3) DEFAULT 0,
      remaining_stock DECIMAL(10,3) DEFAULT 0,
      updated_by VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(product_id, date)
    )`,

    // 3. DP AdHoc Stock table (tracks per DP, per route, per product, per date)
    `CREATE TABLE IF NOT EXISTS adhoc_dp_stock (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      date DATE NOT NULL,
      dp_ref_id VARCHAR(100) NOT NULL,
      dp_name VARCHAR(150) NOT NULL,
      route_id VARCHAR(100) DEFAULT 'unassigned',
      route_name VARCHAR(150) DEFAULT 'General Route',
      product_id UUID REFERENCES products(id) ON DELETE CASCADE,
      product_name VARCHAR(150) NOT NULL,
      quantity_taken DECIMAL(10,3) DEFAULT 0,
      quantity_sold DECIMAL(10,3) DEFAULT 0,
      quantity_returned DECIMAL(10,3) DEFAULT 0,
      quantity_remaining DECIMAL(10,3) DEFAULT 0,
      selling_price DECIMAL(10,2) DEFAULT 0,
      total_sales_amount DECIMAL(10,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(date, dp_ref_id, route_id, product_id)
    )`,

    // 4. AdHoc Stock Transactions Ledger
    `CREATE TABLE IF NOT EXISTS adhoc_stock_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      date DATE NOT NULL,
      product_id UUID REFERENCES products(id),
      product_name VARCHAR(150) NOT NULL,
      transaction_type VARCHAR(50) NOT NULL, -- 'ADD_STOCK', 'DP_ISSUE', 'DP_RETURN', 'DP_SALE'
      quantity DECIMAL(10,3) NOT NULL,
      dp_ref_id VARCHAR(100),
      dp_name VARCHAR(150),
      route_id VARCHAR(100),
      route_name VARCHAR(150),
      performed_by VARCHAR(100) NOT NULL,
      remarks TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // 5. AdHoc Customer Sales table
    `CREATE TABLE IF NOT EXISTS adhoc_customer_sales (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      date DATE NOT NULL,
      customer_id UUID REFERENCES customers(id),
      customer_name VARCHAR(150),
      dp_ref_id VARCHAR(100) NOT NULL,
      dp_name VARCHAR(150) NOT NULL,
      route_id VARCHAR(100),
      route_name VARCHAR(150),
      product_id UUID REFERENCES products(id) ON DELETE CASCADE,
      product_name VARCHAR(150) NOT NULL,
      quantity DECIMAL(10,3) NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // 6. Indexes for performance
    `CREATE INDEX IF NOT EXISTS idx_adhoc_central_date ON adhoc_central_inventory(date)`,
    `CREATE INDEX IF NOT EXISTS idx_adhoc_dp_stock_dp_date ON adhoc_dp_stock(dp_ref_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_adhoc_trans_date ON adhoc_stock_transactions(date)`,
    `CREATE INDEX IF NOT EXISTS idx_adhoc_cust_sales_date ON adhoc_customer_sales(date)`,
  ];

  for (const q of queries) {
    try {
      await writeToCRM(q);
    } catch (err) {
      console.error('⚠️ AdHoc migration query error:', err.message);
      throw err;
    }
  }

  // Seed the 11 AdHoc Products into `products` table
  const adhocProducts = [
    { name: 'Curd Pot - 500ml',       category: 'AdHoc', unit: '500ml', price: 50.00,  sku: 'ADH-CURD-500ML' },
    { name: 'Cow Ghee - 500gm',       category: 'AdHoc', unit: '500gm', price: 450.00, sku: 'ADH-GHEE-500GM' },
    { name: 'Cow Ghee - 250gm',       category: 'AdHoc', unit: '250gm', price: 240.00, sku: 'ADH-GHEE-250GM' },
    { name: 'Coconut Oil - 500ml',    category: 'AdHoc', unit: '500ml', price: 180.00, sku: 'ADH-COCO-500ML' },
    { name: 'Groundnut Oil - 500ml',  category: 'AdHoc', unit: '500ml', price: 160.00, sku: 'ADH-GNUT-500ML' },
    { name: 'Sesame Oil - 500ml',     category: 'AdHoc', unit: '500ml', price: 210.00, sku: 'ADH-SESM-500ML' },
    { name: 'Paneer - 150gm',         category: 'AdHoc', unit: '150gm', price: 100.00, sku: 'ADH-PANR-150GM' },
    { name: 'Butter - 250gm',         category: 'AdHoc', unit: '250gm', price: 150.00, sku: 'ADH-BTR-250GM'  },
    { name: 'Honey - 350gm',          category: 'AdHoc', unit: '350gm', price: 220.00, sku: 'ADH-HNY-350GM'  },
    { name: 'Cane Sugar - 500gm',     category: 'AdHoc', unit: '500gm', price: 60.00,  sku: 'ADH-CSUG-500GM' },
    { name: 'Appalam Packet - 200gm', category: 'AdHoc', unit: '200gm', price: 40.00,  sku: 'ADH-APPL-200GM' },
  ];

  for (const p of adhocProducts) {
    try {
      const checkRes = await readFromCRM(`SELECT id FROM products WHERE name = $1 OR sku = $2`, [p.name, p.sku]);
      if (checkRes.rows.length === 0) {
        await writeToCRM(
          `INSERT INTO products (name, category, unit, price_per_unit, sku, status)
           VALUES ($1, $2, $3, $4, $5, 'Active')`,
          [p.name, p.category, p.unit, p.price, p.sku]
        );
        console.log(`  ➕ Seeded AdHoc Product: ${p.name} (${p.sku})`);
      } else {
        await writeToCRM(
          `UPDATE products SET category = $1, sku = $2, price_per_unit = $3 WHERE id = $4`,
          [p.category, p.sku, p.price, checkRes.rows[0].id]
        );
      }
    } catch (e) {
      console.warn(`⚠️ Error seeding product ${p.name}:`, e.message);
    }
  }

  // Also seed default Milk products into `products` table if empty
  const milkProducts = [
    { name: 'Cow Milk (1 Litre)',        category: 'Milk', unit: '1L',    price: 70.00, sku: 'MLK-COW-1L' },
    { name: 'Cow Milk (500ml Bottle)',  category: 'Milk', unit: '500ml', price: 36.00, sku: 'MLK-COW-500MLB' },
    { name: 'Cow Milk (500ml Packet)',  category: 'Milk', unit: '500ml', price: 35.00, sku: 'MLK-COW-500MLP' },
    { name: 'Buffalo Milk (1 Litre)',    category: 'Milk', unit: '1L',    price: 80.00, sku: 'MLK-BUF-1L' },
  ];
  for (const p of milkProducts) {
    try {
      const checkRes = await readFromCRM(`SELECT id FROM products WHERE name = $1`, [p.name]);
      if (checkRes.rows.length === 0) {
        await writeToCRM(
          `INSERT INTO products (name, category, unit, price_per_unit, sku, status)
           VALUES ($1, $2, $3, $4, $5, 'Active')`,
          [p.name, p.category, p.unit, p.price, p.sku]
        );
      }
    } catch (e) { /* silent */ }
  }

  console.log('✅ 005_adhoc_inventory_and_sales migrations completed!');
};

module.exports = { runAdhocMigrations };

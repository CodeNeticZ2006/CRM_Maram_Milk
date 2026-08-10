/**
 * Seed Script: Teynampet Route Customers
 * Run with: node backend/src/seeds/teynampet_customers.js
 *
 * Creates a 'Teynampet' route in the CRM (DB1) and inserts all customers
 * from the Teynampet route sheet.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { writeToCRM, readFromCRM } = require('../config/database');

const customers = [
  { name: 'Art 1326 Mubarak',           address: 'Teynampet, Chennai',  lat: 13.05747003, lng: 80.27005148, maps_url: 'https://maps.app.goo.gl/vW6msZJQjW9semkvGA' },
  { name: 'Art 249 Mohammed zhaid',      address: 'Teynampet, Chennai',  lat: 13.05820884, lng: 80.27016724, maps_url: 'https://maps.app.goo.gl/78wUctjkCuUPXfHc9' },
  { name: 'Art 328 Sankar dinesh',       address: 'Teynampet, Chennai',  lat: 13.06129438, lng: 80.26984701, maps_url: 'https://maps.app.goo.gl/MzfHomK3LbFy4xna6' },
  { name: 'Art 485 Dhanabalan vb',       address: 'Teynampet, Chennai',  lat: 13.06183692, lng: 80.26832052, maps_url: 'https://maps.app.goo.gl/uAop2BmhaO7gtndY7' },
  { name: 'Art 596 Mohammed asan',       address: 'Teynampet, Chennai',  lat: 13.06421548, lng: 80.26821547, maps_url: 'https://maps.app.goo.gl/oKF68zBFM8YxggHg6' },
  { name: 'Art 1552 Apna',               address: 'Teynampet, Chennai',  lat: 13.06018897, lng: 80.26556762, maps_url: 'https://maps.app.goo.gl/gOwdY6Zew2Vscrq69' },
  { name: 'Art 1485 Harshini hari',      address: 'Teynampet, Chennai',  lat: 13.07101836, lng: 80.2519721,  maps_url: 'https://maps.app.goo.gl/RDfNDBenfapuRQ9R6' },
  { name: 'Art 412 Sarahmathew',         address: 'Teynampet, Chennai',  lat: 13.06501564, lng: 80.25078056, maps_url: 'https://maps.app.goo.gl/VKGA8EEFkTsfLE849' },
  { name: 'Art 1365 R.D.gopinath',       address: 'Teynampet, Chennai',  lat: 13.05743134, lng: 80.25226288, maps_url: 'https://maps.app.goo.gl/XGLCZQaRm7fPjg4R9' },
  { name: 'Art 112 Jayanthi viswanathan',address: 'Teynampet, Chennai',  lat: 13.05683524, lng: 80.25189341, maps_url: 'https://maps.app.goo.gl/ayXyW4GEPdzxKPz6' },
  { name: 'Art 441 Kamlesh',             address: 'Teynampet, Chennai',  lat: 13.05638188, lng: 80.25569541, maps_url: 'https://maps.app.goo.gl/cSXVvHDf7a1k5jXg9' },
  { name: 'Art 1116 Revathybabu',        address: 'Teynampet, Chennai',  lat: 13.04849685, lng: 80.26177661, maps_url: 'https://maps.app.goo.gl/Jpiv97mgHeYejLGy7' },
  { name: 'Art 1001 Bhanumati kona',     address: 'Teynampet, Chennai',  lat: 13.04818347, lng: 80.26207833, maps_url: 'https://maps.app.goo.gl/V4Eh2MZ9Ws1JhQdg6' },
  { name: 'Art 1203 Chuchutv studio',    address: 'Teynampet, Chennai',  lat: 13.04808582, lng: 80.26300934, maps_url: 'https://maps.app.goo.gl/cFVxu7h9BH5G7a5w5' },
  { name: 'Art 1700 Guru prakesh',       address: 'Teynampet, Chennai',  lat: 13.04796836, lng: 80.26429546, maps_url: 'https://maps.app.goo.gl/cqGE3LzizK3zgXQxT8' },
  { name: 'Art 551 Abirami ganesh',      address: 'Teynampet, Chennai',  lat: 13.05000423, lng: 80.26600797, maps_url: 'https://maps.app.goo.gl/ojkgRBjBAiKU2dGu5' },
  { name: 'Art 459 A.fareed aslaam',     address: 'Teynampet, Chennai',  lat: 13.05123472, lng: 80.26508303, maps_url: 'https://maps.app.goo.gl/2nq756PC9j6gwmjD7' },
  { name: 'Art 934 Mohammed zia',        address: 'Teynampet, Chennai',  lat: 13.05427778, lng: 80.26695637, maps_url: 'https://maps.app.goo.gl/de5o4AvRgTCrpUxL7' },
  { name: 'Art 29 Surya srinivasan',     address: 'Teynampet, Chennai',  lat: 13.0493615,  lng: 80.26349904, maps_url: 'https://maps.app.goo.gl/pjACrVsEHnTknyYx7' },
  { name: 'Art 34 Madava rao',           address: 'Teynampet, Chennai',  lat: 13.05000423, lng: 80.26600797, maps_url: 'https://maps.app.goo.gl/ezyg6gVHnTqU5uDa8' },
];

const seed = async () => {
  try {
    console.log('🌱 Starting Teynampet customer seed...');

    // ── Step 1: Ensure Teynampet route exists in CRM DB ──
    let routeId;
    const existing = await readFromCRM(
      `SELECT id FROM routes WHERE LOWER(route_name) = 'teynampet' LIMIT 1`
    );

    if (existing.rows.length > 0) {
      routeId = existing.rows[0].id;
      console.log(`ℹ️  Teynampet route already exists: ${routeId}`);
    } else {
      const newRoute = await writeToCRM(
        `INSERT INTO routes (route_name, status) VALUES ($1, $2) RETURNING id`,
        ['Teynampet', 'Active']
      );
      routeId = newRoute.rows[0].id;
      console.log(`✅ Created Teynampet route: ${routeId}`);
    }

    // ── Step 2: Get current customer count for code generation ──
    const countRes = await readFromCRM('SELECT COUNT(*) FROM customers');
    let nextNum = parseInt(countRes.rows[0].count) + 1;

    // ── Step 3: Insert customers ──
    let inserted = 0;
    let skipped = 0;

    for (const c of customers) {
      // Check if customer with same name already exists
      const dup = await readFromCRM(
        `SELECT id FROM customers WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        [c.name]
      );

      if (dup.rows.length > 0) {
        console.log(`  ⚠️  Skipping duplicate: ${c.name}`);
        skipped++;
        continue;
      }

      const customer_code = `MM${String(nextNum).padStart(4, '0')}`;
      const result = await writeToCRM(
        `INSERT INTO customers
           (customer_code, name, phone, whatsapp_number, address, lat, lng,
            assigned_route_id, enquiry_source, status, maps_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id`,
        [
          customer_code,
          c.name,
          '0000000000',       // placeholder phone
          '0000000000',       // placeholder whatsapp
          c.address,
          c.lat,
          c.lng,
          routeId,
          'Direct',
          'Active',
          c.maps_url,
        ]
      );

      // Create wallet entry
      await writeToCRM(
        'INSERT INTO wallet (customer_id) VALUES ($1) ON CONFLICT DO NOTHING',
        [result.rows[0].id]
      );

      console.log(`  ✅ [${customer_code}] ${c.name}`);
      nextNum++;
      inserted++;
    }

    console.log(`\n🎉 Seed complete! Inserted: ${inserted}, Skipped (duplicates): ${skipped}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
};

seed();

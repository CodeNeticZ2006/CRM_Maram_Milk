/**
 * Seed Script: Mandaveli 2 Route Customers
 * Run with: node backend/src/seeds/mandaveli2_customers.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { writeToCRM, readFromCRM } = require('../config/database');

const customers = [
  { name: 'ART1760 - Krishnan',              lat: 13.0256791,  lng: 80.2568968, maps_url: 'https://maps.app.goo.gl/3QmtzwccNnsepN5V6' },
  { name: 'ART1185 - Subbiramanian TS',      lat: 13.0364688,  lng: 80.2613899, maps_url: 'https://maps.app.goo.gl/JfnL83UgiwhRDPYm7' },
  { name: 'ART555 - Vasumathi Sivanandhan',  lat: 13.0345452,  lng: 80.2620993, maps_url: 'https://maps.app.goo.gl/WZtQvggwUakn3qSB8' },
  { name: 'ART1630 - Palaniappan',           lat: 13.0355411,  lng: 80.2647909, maps_url: 'https://maps.app.goo.gl/6mWR5X4BVgj4Hdjc8' },
  { name: 'ART375 - Gayathri Thiyagarajan',  lat: 13.0352576,  lng: 80.2648474, maps_url: 'https://maps.app.goo.gl/2au4gQiRsmMbMdUB6' },
  { name: 'ART685 - Vijay',                  lat: 13.0344425,  lng: 80.2641293, maps_url: 'https://maps.app.goo.gl/2YkcZJW2pvJSUWdB9' },
  { name: 'ART872 - G Lakshmi',              lat: 13.0325371,  lng: 80.2603805, maps_url: 'https://maps.app.goo.gl/4S8Te4s37V4RB6tXA' },
  { name: 'ART1415 - Pon singh',             lat: 13.029431,   lng: 80.2603789, maps_url: 'https://maps.app.goo.gl/NDSCRMpTuMXKaZ2a8' },
  { name: 'ART1427 - Rajeshwari Ravi',       lat: 13.0296634,  lng: 80.2595609, maps_url: 'https://maps.app.goo.gl/69w94ZyNUPC1oDUi7' },
  { name: 'ART1693 - S. Jayaraman',          lat: 13.0280697,  lng: 80.2557555, maps_url: 'https://maps.app.goo.gl/nQNSBFGxfD7kQrmt7' },
  { name: 'ART768 - Chertalai',              lat: 13.0280988,  lng: 80.2551999, maps_url: 'https://maps.app.goo.gl/W262LnoRdPmygdkN8' },
  { name: 'ART1025 - LR MUralidharan',       lat: 13.0271057,  lng: 80.2558091, maps_url: 'https://maps.app.goo.gl/RgNfaJT6oTfDJDV38' },
  { name: 'ART1629 - Usha sundararajan',     lat: 13.0263828,  lng: 80.2560614, maps_url: 'https://maps.app.goo.gl/BCVdYT6mUaaN3tBdA' },
  { name: 'ART1514 - Nithya Sathish',        lat: 13.0271031,  lng: 80.2559043, maps_url: 'https://maps.app.goo.gl/wWhFYSFjWK7W6Kkw9' },
  { name: 'ART1439 - Hema Thiruvengadam',    lat: 13.0263187,  lng: 80.2542493, maps_url: 'https://maps.app.goo.gl/T3J5KFKW2uPmo91DA' },
  { name: 'ART1645 - Bairavi Senthil',       lat: null,        lng: null,       maps_url: null },
  { name: 'ART1487 - Senthil M',             lat: 13.0249039,  lng: 80.2545705, maps_url: 'https://maps.app.goo.gl/C2dujmmEYBni2AyZ7' },
  { name: 'ART454 - Ravindran Ravindran',    lat: 13.0238821,  lng: 80.2546411, maps_url: 'https://maps.app.goo.gl/CcPYAWVfDZ7MZCAD7' },
  { name: 'ART1343 - Ramya Ramani',          lat: 13.0236082,  lng: 80.2546345, maps_url: 'https://maps.app.goo.gl/a6X7TdrHCKCFTNCg7' },
  { name: 'ART1321 - Harish Ganesan',        lat: 13.0236993,  lng: 80.2546422, maps_url: 'https://maps.app.goo.gl/a6X7TdrHCKCFTNCg7' },
  { name: 'ART693 - Hema Diubey',            lat: 13.0230602,  lng: 80.254066,  maps_url: 'https://maps.app.goo.gl/qHjNVtt9w2HQnHBx7' },
  { name: 'ART796 - T. Dinakarakumar',       lat: 13.0198732,  lng: 80.2597605, maps_url: 'https://maps.app.goo.gl/GusrbE1a9juKCXL8A' },
];

const seed = async () => {
  try {
    console.log('🌱 Starting Mandaveli 2 customer seed...');

    // ── Step 1: Ensure Mandaveli 2 route exists in CRM DB ──
    let routeId;
    const existing = await readFromCRM(
      `SELECT id FROM routes WHERE LOWER(route_name) = 'mandaveli 2' LIMIT 1`
    );

    if (existing.rows.length > 0) {
      routeId = existing.rows[0].id;
      console.log(`ℹ️  Mandaveli 2 route already exists: ${routeId}`);
    } else {
      const newRoute = await writeToCRM(
        `INSERT INTO routes (route_name, status) VALUES ($1, $2) RETURNING id`,
        ['Mandaveli 2', 'Active']
      );
      routeId = newRoute.rows[0].id;
      console.log(`✅ Created Mandaveli 2 route: ${routeId}`);
    }

    // ── Step 2: Get current customer count for code generation ──
    const countRes = await readFromCRM('SELECT COUNT(*) FROM customers');
    let nextNum = parseInt(countRes.rows[0].count) + 1;

    // ── Step 3: Insert customers ──
    let inserted = 0;
    let skipped = 0;

    for (const c of customers) {
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
          '0000000000',
          '0000000000',
          'Mandaveli, Chennai',
          c.lat,
          c.lng,
          routeId,
          'Direct',
          'Active',
          c.maps_url,
        ]
      );

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

/**
 * Seed Script: Triplicane Route Customers
 * Run with: node backend/src/seeds/triplicane_customers.js
 *
 * Creates a 'Triplicane' route in the CRM (DB1) if missing and inserts all 20 customers
 * from the Triplicane route sheet into the customers database.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { writeToCRM, readFromCRM } = require('../config/database');

const customers = [
  { name: 'ART1454 - Raj',              address: 'Triplicane, Chennai', lat: 13.052759,  lng: 80.2787043, maps_url: 'https://maps.app.goo.gl/KaW9RKW176MNgVV47' },
  { name: 'ART1499 - Abhinav',          address: 'Triplicane, Chennai', lat: 13.05278,   lng: 80.2753901, maps_url: 'https://maps.app.goo.gl/8UnXTRUWbKP4znai6' },
  { name: 'ART178 - Prema',             address: 'Triplicane, Chennai', lat: 13.0551033, lng: 80.2752851, maps_url: 'https://maps.app.goo.gl/Z9fgMnQ8MgYCwmB56' },
  { name: 'ART1778 - Natarajan',        address: 'Triplicane, Chennai', lat: 13.0551033, lng: 80.2752851, maps_url: 'https://maps.app.goo.gl/Z9fgMnQ8MgYCwmB57' },
  { name: 'ART1182 - Anandhi',          address: 'Triplicane, Chennai', lat: 13.0542979, lng: 80.277561,  maps_url: 'https://maps.app.goo.gl/bvuZGW22yfsLRUUD9' },
  { name: 'ART1797 - Amirtha',          address: 'Triplicane, Chennai', lat: 13.0549772, lng: 80.274245,  maps_url: 'https://maps.app.goo.gl/FdsZbn4gLzSMWxjj8' },
  { name: 'ART1553 - K Muthukrishnan',  address: 'Triplicane, Chennai', lat: 13.0576821, lng: 80.276049,  maps_url: 'https://maps.app.goo.gl/EUev9mJFxSvStwyx7' },
  { name: 'ART252 - Srinivasan KDK',    address: 'Triplicane, Chennai', lat: 13.0576821, lng: 80.276049,  maps_url: 'https://maps.app.goo.gl/EUev9mJFxSvStwyx8' },
  { name: 'ART1051 - Padma priya',      address: 'Triplicane, Chennai', lat: 13.0617164, lng: 80.2730077, maps_url: 'https://maps.app.goo.gl/H9Vttmo3JQja81V68' },
  { name: 'ART1419 - Azees Hasan',      address: 'Triplicane, Chennai', lat: 13.063708,  lng: 80.2699918, maps_url: 'https://maps.app.goo.gl/bBo8vqWyCdzT7eLU7' },
  { name: 'ART1712 - sherine',          address: 'Triplicane, Chennai', lat: 13.069521,  lng: 80.2836994, maps_url: 'https://maps.app.goo.gl/NUBHqq6VAkbNmWo58' },
  { name: 'ART1017 - M.K.Poongundran',  address: 'Triplicane, Chennai', lat: 13.0647226, lng: 80.2733893, maps_url: 'https://maps.app.goo.gl/qqTecjq8UvUuqut48' },
  { name: 'ART1112 - Mahasar Ali',      address: 'Triplicane, Chennai', lat: 13.0628946, lng: 80.2736031, maps_url: 'https://maps.app.goo.gl/SVzZ3VY8dfxkecpv8' },
  { name: 'ART1053 - Saravana kumar',  address: 'Triplicane, Chennai', lat: 13.0620344, lng: 80.27118,   maps_url: 'https://maps.app.goo.gl/yYycWnGnZUY2bDc18' },
  { name: 'ART306 - Vikash Vikash',     address: 'Triplicane, Chennai', lat: 13.0606806, lng: 80.2668686, maps_url: 'https://maps.app.goo.gl/VQcspuWNibvZD5wi7' },
  { name: 'ART1694 - Rajesh',           address: 'Triplicane, Chennai', lat: 13.05835,   lng: 80.2690701, maps_url: 'https://maps.app.goo.gl/iCb3SALhs31nHXaJ6' },
  { name: 'ART1445 - Munvar basha',     address: 'Triplicane, Chennai', lat: 13.0559677, lng: 80.2687711, maps_url: 'https://maps.app.goo.gl/uwj5EXVyMpZqbPRx7' },
  { name: 'ART1371 - Hafeez',           address: 'Triplicane, Chennai', lat: 13.0545787, lng: 80.2653596, maps_url: 'https://maps.app.goo.gl/ZlzrPu12JJCWoT2C8' },
  { name: 'ART1504 - Jai kumar',        address: 'Triplicane, Chennai', lat: 13.056374,  lng: 80.269711,  maps_url: 'https://maps.app.goo.gl/uwj5EXVyMpZqbPRx7' },
  { name: 'ART1728 - Hussain shariff',  address: 'Triplicane, Chennai', lat: 13.0593161, lng: 80.2695503, maps_url: 'https://maps.app.goo.gl/fYumSNJwPhjCbVtS7' },
];

const seed = async () => {
  try {
    console.log('🌱 Starting Triplicane customer seed...');

    // ── Step 1: Ensure Triplicane route exists in CRM DB ──
    let routeId;
    const existing = await readFromCRM(
      `SELECT id FROM routes WHERE LOWER(route_name) = 'triplicane' LIMIT 1`
    );

    if (existing.rows.length > 0) {
      routeId = existing.rows[0].id;
      console.log(`ℹ️ Triplicane route already exists: ${routeId}`);
    } else {
      const newRoute = await writeToCRM(
        `INSERT INTO routes (route_name, status) VALUES ($1, $2) RETURNING id`,
        ['Triplicane', 'Active']
      );
      routeId = newRoute.rows[0].id;
      console.log(`✅ Created Triplicane route: ${routeId}`);
    }

    // ── Step 2: Get current customer code max number ──
    const codeRes = await readFromCRM(`SELECT customer_code FROM customers WHERE customer_code LIKE 'MM%'`);
    let maxNum = 0;
    for (const r of codeRes.rows) {
      const num = parseInt(r.customer_code.replace('MM', ''), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
    let nextNum = maxNum + 1;

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
        console.log(`  ⚠️ Skipped duplicate: ${c.name}`);
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
          c.lat || null,
          c.lng || null,
          routeId,
          'Direct',
          'Active',
          c.maps_url || null,
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

    console.log(`\n🎉 Triplicane seed complete! Inserted: ${inserted}, Skipped (duplicates): ${skipped}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
};

seed();

/**
 * Seed Script: Nungambakkam Route Customers
 * Run with: node backend/src/seeds/nungambakkam_customers.js
 *
 * Creates a 'Nungambakkam' route in the CRM (DB1) if missing and inserts all 25 customers
 * from the Nungambakkam route sheet into the customers database.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { writeToCRM, readFromCRM } = require('../config/database');

const customers = [
  { name: 'ART1612 - Zehra Syed Farhan',         address: 'Nungambakkam, Chennai', lat: 13.0569066, lng: 80.2457893, maps_url: 'https://maps.app.goo.gl/vZ2s9yUoZWRVvukzA9' },
  { name: 'ART1765 - Antony sekar',             address: 'Nungambakkam, Chennai', lat: 13.0569066, lng: 80.2457893, maps_url: 'https://maps.app.goo.gl/vZ2s9yUoZWRVvukzA10' },
  { name: 'ART147 - Anitha Pasupathy',          address: 'Nungambakkam, Chennai', lat: 13.0570802, lng: 80.2442337, maps_url: 'https://maps.app.goo.gl/XvjQCXQDP9sNJwpRA' },
  { name: 'ART1043 - Jayaprakash V',            address: 'Nungambakkam, Chennai', lat: 13.0576226, lng: 80.2464188, maps_url: 'https://maps.app.goo.gl/KrQGrPAyVTTQCYuj6' },
  { name: 'ART1622 - Yogasaravanan N',          address: 'Nungambakkam, Chennai', lat: 13.054629,  lng: 80.24749,   maps_url: 'https://maps.app.goo.gl/CdF98zgY1Suk7xj38' },
  { name: 'ART162 - Raja T',                    address: 'Nungambakkam, Chennai', lat: 13.0551533, lng: 80.2449651, maps_url: 'https://maps.app.goo.gl/eHgHHHErw8eQYP6QA' },
  { name: 'ART1299 - Maria Bright',             address: 'Nungambakkam, Chennai', lat: 13.05448,   lng: 80.2453818, maps_url: 'https://maps.app.goo.gl/NnL2p1cDMHUM9Pfg6' },
  { name: 'ART230 - Malini Malini',             address: 'Nungambakkam, Chennai', lat: 13.0590825, lng: 80.2452071, maps_url: 'https://maps.app.goo.gl/Ak7HufBN7vCXZeyq8' },
  { name: 'ART1572 - Ishwarya Krishnamoorthy',  address: 'Nungambakkam, Chennai', lat: 13.0594213, lng: 80.2383115, maps_url: 'https://maps.app.goo.gl/613c957onNY9ewP89' },
  { name: 'ART1599 - Minita Tejasvi',           address: 'Nungambakkam, Chennai', lat: 13.0581449, lng: 80.2383874, maps_url: 'https://maps.app.goo.gl/FZn6721LewTmmBFA7' },
  { name: 'ART293 - Ameena Ameena',             address: 'Nungambakkam, Chennai', lat: 13.05913,   lng: 80.2353784, maps_url: 'https://maps.app.goo.gl/AThjbvKGDYB4pgzHA' },
  { name: 'ART1594 - Harini Desikan',           address: 'Nungambakkam, Chennai', lat: 13.056728,  lng: 80.2346526, maps_url: 'https://maps.app.goo.gl/vx5HKE8nr1QsZHTi6' },
  { name: 'ART777 - Isha Bajaj',                address: 'Nungambakkam, Chennai', lat: 13.0623033, lng: 80.2355501, maps_url: 'https://maps.app.goo.gl/69ELVVKZbkAEmnLi6' },
  { name: 'ART1538 - G Subburaj',              address: 'Nungambakkam, Chennai', lat: 13.0682838, lng: 80.2372336, maps_url: 'https://maps.app.goo.gl/VBdW2oJ2RasaJZQC8' },
  { name: 'ART679 - Mr.Dinesh Varma',           address: 'Nungambakkam, Chennai', lat: 13.0704162, lng: 80.2398398, maps_url: 'https://maps.app.goo.gl/BBGbHzbxGqbgYhB69' },
  { name: 'ART1740 - sudha',                    address: 'Nungambakkam, Chennai', lat: 13.0694778, lng: 80.2393584, maps_url: 'https://maps.app.goo.gl/1jCE8vv8TF4E1bE6A' },
  { name: 'ART1792 - Jayapriya jayabalan',      address: 'Nungambakkam, Chennai', lat: 13.0706533, lng: 80.2372334, maps_url: 'https://maps.app.goo.gl/7dTaNqPyTeLeRH9w6' },
  { name: 'ART145 - Abdul Samad',               address: 'Nungambakkam, Chennai', lat: 13.0721197, lng: 80.2398892, maps_url: 'https://maps.app.goo.gl/detMUkXoX5uuTsii6' },
  { name: 'ART673 - Ganesan',                   address: 'Nungambakkam, Chennai', lat: 13.072108,  lng: 80.2382264, maps_url: 'https://maps.app.goo.gl/hoyz1Eq2WZEP56kz6' },
  { name: 'ART1144 - Ravi shankar',             address: 'Nungambakkam, Chennai', lat: 13.072108,  lng: 80.2382264, maps_url: 'https://maps.app.goo.gl/hoyz1Eq2WZEP56kz7' },
  { name: 'ART163 - Fayiza Fayiza',             address: 'Nungambakkam, Chennai', lat: 13.0715683, lng: 80.2407418, maps_url: 'https://maps.app.goo.gl/8gd5xfjPURP9MDy57' },
  { name: 'ART53 - Husna Aadhil',               address: 'Nungambakkam, Chennai', lat: 13.0721717, lng: 80.2506651, maps_url: 'https://maps.app.goo.gl/L2ECncSoLonZYgAZ6' },
  { name: 'ART1702 - Vimal kumar',              address: 'Nungambakkam, Chennai', lat: 13.0537701, lng: 80.2393197, maps_url: 'https://maps.app.goo.gl/RtnzwnoMWv9OTQvd6' },
  { name: 'ART170 - Dhanalakshmi Ramanathan',   address: 'Nungambakkam, Chennai', lat: 13.0540861, lng: 80.2402278, maps_url: 'https://maps.app.goo.gl/SGcKDqysR1MdHGYVA' },
  { name: 'ART231 - Syed Aasim',                address: 'Nungambakkam, Chennai', lat: 13.0627742, lng: 80.2482226, maps_url: 'https://maps.app.goo.gl/nxMXwkL56PVnTqtE8' },
];

const seed = async () => {
  try {
    console.log('🌱 Starting Nungambakkam customer seed...');

    // ── Step 1: Ensure Nungambakkam route exists in CRM DB ──
    let routeId;
    const existing = await readFromCRM(
      `SELECT id FROM routes WHERE LOWER(route_name) = 'nungambakkam' LIMIT 1`
    );

    if (existing.rows.length > 0) {
      routeId = existing.rows[0].id;
      console.log(`ℹ️ Nungambakkam route already exists: ${routeId}`);
    } else {
      const newRoute = await writeToCRM(
        `INSERT INTO routes (route_name, status) VALUES ($1, $2) RETURNING id`,
        ['Nungambakkam', 'Active']
      );
      routeId = newRoute.rows[0].id;
      console.log(`✅ Created Nungambakkam route: ${routeId}`);
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

    console.log(`\n🎉 Nungambakkam seed complete! Inserted: ${inserted}, Skipped (duplicates): ${skipped}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
};

seed();

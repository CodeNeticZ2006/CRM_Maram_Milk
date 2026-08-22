/**
 * Seed Script: Royapettah Route Customers
 * Run with: node backend/src/seeds/royapettah_customers.js
 *
 * Creates a 'Royapettah' route in the CRM (DB1) if missing and inserts all 28 customers
 * from the Royapettah route sheet into the customers database.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { writeToCRM, readFromCRM } = require('../config/database');

const customers = [
  { name: 'ART1753 - Ayub Khan',            address: 'Royapettah, Chennai', lat: 13.0495658, lng: 80.2684947, maps_url: 'https://maps.app.goo.gl/ESSvf9F8NoNJ8RWA7' },
  { name: 'ART923 - Viswanathan',           address: 'Royapettah, Chennai', lat: 13.0476826, lng: 80.2683171, maps_url: 'https://maps.app.goo.gl/8VBF7UFpB6FEgmq38' },
  { name: 'ART1101 - Keerthana',            address: 'Royapettah, Chennai', lat: 13.046668,  lng: 80.2698661, maps_url: 'https://maps.app.goo.gl/ivxSpmnp794hY7B37' },
  { name: 'ART625 - Vijay Annamalai',       address: 'Royapettah, Chennai', lat: 13.0460456, lng: 80.2678079, maps_url: 'https://maps.app.goo.gl/7EZ2zaNsXKVgKktg8' },
  { name: 'ART192 - Raja Ram',              address: 'Royapettah, Chennai', lat: 13.0460456, lng: 80.2678079, maps_url: 'https://maps.app.goo.gl/7EZ2zaNsXKVgKktg8' },
  { name: 'ART939 - Ancy',                  address: 'Royapettah, Chennai', lat: 13.0458917, lng: 80.2639084, maps_url: 'https://maps.app.goo.gl/ByJuup4dtLQfeZP56' },
  { name: 'ART1751 - Jayashree',            address: 'Royapettah, Chennai', lat: 13.0476233, lng: 80.2629401, maps_url: 'https://maps.app.goo.gl/YCag8Zpy15CbtWmm8' },
  { name: 'ART1793 - Fareedha',             address: 'Royapettah, Chennai', lat: 13.0469397, lng: 80.2575496, maps_url: 'https://maps.app.goo.gl/8h7qzxksXFeXt8g88' },
  { name: 'ART1429 - Ponraj',               address: 'Royapettah, Chennai', lat: 13.04747,   lng: 80.2565821, maps_url: 'https://maps.app.goo.gl/McVgtM9gC4aUfo8q7' },
  { name: 'ART838 - G.RajMohan',            address: 'Royapettah, Chennai', lat: 13.0471145, lng: 80.2552081, maps_url: 'https://maps.app.goo.gl/15WEnpyHRHHRymky5' },
  { name: 'ART1449 - Kala Subramaniam',     address: 'Royapettah, Chennai', lat: 13.04678,   lng: 80.2555351, maps_url: 'https://maps.app.goo.gl/GpAPDEI58G6PtGo6' },
  { name: 'ART1337 - Naseem Dawood',        address: 'Royapettah, Chennai', lat: 13.0438233, lng: 80.2537284, maps_url: 'https://maps.app.goo.gl/dRsRa74K38365FyC8' },
  { name: 'ART1248 - Srividhya Venkatesan', address: 'Royapettah, Chennai', lat: 13.0438233, lng: 80.2537284, maps_url: 'https://maps.app.goo.gl/dRsRa74K38365FyC8' },
  { name: 'ART991 - KV',                    address: 'Royapettah, Chennai', lat: 13.0403718, lng: 80.2485824, maps_url: 'https://maps.app.goo.gl/ogiEtwBmCNwJALaj8' },
  { name: 'ART1154 - Ravi',                 address: 'Royapettah, Chennai', lat: 13.0403718, lng: 80.2485824, maps_url: 'https://maps.app.goo.gl/ogiEtwBmCNwJALaj8' },
  { name: 'ART831 - V. Srivatsan',          address: 'Royapettah, Chennai', lat: 13.039635,  lng: 80.2520451, maps_url: 'https://maps.app.goo.gl/achLti23MrRu7SzA9' },
  { name: 'ART1202 - S.Gayathri',           address: 'Royapettah, Chennai', lat: 13.0395117, lng: 80.2508768, maps_url: 'https://maps.app.goo.gl/UvCRW79XUJg4CKMJ9' },
  { name: 'ART1254 - S.Babuji',             address: 'Royapettah, Chennai', lat: 13.0395117, lng: 80.2508768, maps_url: 'https://maps.app.goo.gl/UvCRW79XUJg4CKMJ9' },
  { name: 'ART122 - Akther Ghori',          address: 'Royapettah, Chennai', lat: 13.0394365, lng: 80.2532537, maps_url: 'https://maps.app.goo.gl/7rCzNFA1Ub59XOjg8' },
  { name: 'ART1601 - Swathika A',           address: 'Royapettah, Chennai', lat: 13.0414867, lng: 80.2493984, maps_url: 'https://maps.app.goo.gl/GgK6TTIp1t5udwN8' },
  { name: 'ART1122 - Ayyan Ganapathy',      address: 'Royapettah, Chennai', lat: 13.0415137, lng: 80.2533049, maps_url: 'https://maps.app.goo.gl/YWhcvKkexVHQj9Jw7' },
  { name: 'ART1262 - Pothys MD',            address: 'Royapettah, Chennai', lat: 13.0420967, lng: 80.2527327, maps_url: 'https://maps.app.goo.gl/wzvB3A6H7GRIrfQt8' },
  { name: 'ART377 - Zaheer Ismail',         address: 'Royapettah, Chennai', lat: 13.0473318, lng: 80.2521424, maps_url: 'https://maps.app.goo.gl/UcWEn5WSkCVdGWUSA' },
  { name: 'ART1627 - S. HARIHARAN',         address: 'Royapettah, Chennai', lat: 13.0483066, lng: 80.2526305, maps_url: 'https://maps.app.goo.gl/C2Sm3m1tARP5XXzz8' },
  { name: 'ART615 - Gayatri',               address: 'Royapettah, Chennai', lat: 13.0483247, lng: 80.2530997, maps_url: 'https://maps.app.goo.gl/4b5D7vgtEHcEgbxo9' },
  { name: 'ART1639 - Lakshmi Kantha',       address: 'Royapettah, Chennai', lat: null,        lng: null,       maps_url: null },
  { name: 'ART100 - Karpagam Kalayanaram',   address: 'Royapettah, Chennai', lat: null,        lng: null,       maps_url: null },
  { name: 'ART335 - Ganesh Ram',            address: 'Royapettah, Chennai', lat: null,        lng: null,       maps_url: null },
];

const seed = async () => {
  try {
    console.log('🌱 Starting Royapettah customer seed...');

    // ── Step 1: Ensure Royapettah route exists in CRM DB ──
    let routeId;
    const existing = await readFromCRM(
      `SELECT id FROM routes WHERE LOWER(route_name) IN ('royapettah', 'royapettah 2') LIMIT 1`
    );

    if (existing.rows.length > 0) {
      routeId = existing.rows[0].id;
      console.log(`ℹ️ Royapettah 2 route already exists: ${routeId}`);
    } else {
      const newRoute = await writeToCRM(
        `INSERT INTO routes (route_name, status) VALUES ($1, $2) RETURNING id`,
        ['Royapettah 2', 'Active']
      );
      routeId = newRoute.rows[0].id;
      console.log(`✅ Created Royapettah 2 route: ${routeId}`);
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

    console.log(`\n🎉 Royapettah seed complete! Inserted: ${inserted}, Skipped (duplicates): ${skipped}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
};

seed();

const { readFromCRM, writeToCRM } = require('../config/database');

const OFFICIAL_ROUTES = [
  { id: '1b4a924f-1a3c-4658-9e23-a2a060917ac2', name: 'Nungambakkam 1' },
  { id: '9835f558-456c-423f-985b-f21b981172d6', name: 'Triplicane 1' },
  { id: '59311df6-345e-47d8-97c6-f71c0f64e1eb', name: 'Teynampet 1' },
  { id: '9f2e4943-c2db-4ca8-9ee5-5a2c337241f9', name: 'Mandaveli 2' },
  { id: '9f3ffe40-d485-4995-9dd0-ac74735c6402', name: 'Royapettah 2' },
];

const nungambakkamCustomers = [
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

const triplicaneCustomers = [
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

async function execQueryWithRetry(fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      console.warn(`  ⚠️ Attempt ${attempt} DB error, retrying in ${attempt * 2}s...`);
      await new Promise(res => setTimeout(res, attempt * 2000));
    }
  }
}

async function seedCustomersForRoute(routeId, routeName, customersList) {
  // Ensure route exists
  await execQueryWithRetry(() => writeToCRM(
    `INSERT INTO routes (id, route_name, status)
     VALUES ($1, $2, 'Active')
     ON CONFLICT (id) DO UPDATE SET route_name = EXCLUDED.route_name, status = 'Active'`,
    [routeId, routeName]
  ));

  const codeRes = await execQueryWithRetry(() => readFromCRM(`SELECT customer_code FROM customers WHERE customer_code LIKE 'MM%'`));
  let maxNum = 0;
  for (const r of codeRes.rows) {
    const num = parseInt(r.customer_code.replace('MM', ''), 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;
  }
  let nextNum = maxNum + 1;

  let inserted = 0;
  for (const c of customersList) {
    const dup = await execQueryWithRetry(() => readFromCRM(
      `SELECT id FROM customers WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [c.name]
    ));

    if (dup.rows.length > 0) {
      await execQueryWithRetry(() => writeToCRM(
        `UPDATE customers SET assigned_route_id = $1 WHERE LOWER(name) = LOWER($2) AND (assigned_route_id IS NULL OR assigned_route_id != $1)`,
        [routeId, c.name]
      ));
      continue;
    }

    const customerCode = `MM${String(nextNum).padStart(4, '0')}`;
    const result = await execQueryWithRetry(() => writeToCRM(
      `INSERT INTO customers
         (customer_code, name, phone, whatsapp_number, address, lat, lng,
          assigned_route_id, enquiry_source, status, maps_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        customerCode,
        c.name,
        '0000000000',
        '0000000000',
        c.address,
        c.lat || null,
        c.lng || null,
        routeId,
        'Direct',
        'Active',
        c.maps_url || null,
      ]
    ));

    const customerId = result.rows[0].id;
    await execQueryWithRetry(() => writeToCRM(
      'INSERT INTO wallet (customer_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [customerId]
    ));

    nextNum++;
    inserted++;
  }
  console.log(`  ✅ ${routeName}: inserted ${inserted} customers.`);
}

async function runMigration007() {
  console.log('🔄 Running Migration 007: Seed Nungambakkam & Triplicane route customers...');

  try {
    for (const r of OFFICIAL_ROUTES) {
      await execQueryWithRetry(() => writeToCRM(
        `INSERT INTO routes (id, route_name, status)
         VALUES ($1, $2, 'Active')
         ON CONFLICT (id) DO UPDATE SET route_name = EXCLUDED.route_name, status = 'Active'`,
        [r.id, r.name]
      ));
    }

    await seedCustomersForRoute('1b4a924f-1a3c-4658-9e23-a2a060917ac2', 'Nungambakkam 1', nungambakkamCustomers);
    await seedCustomersForRoute('9835f558-456c-423f-985b-f21b981172d6', 'Triplicane 1', triplicaneCustomers);

    console.log('✅ Migration 007 Completed Successfully!');
  } catch (err) {
    console.error('❌ Migration 007 Error:', err.stack || err);
  }
}

if (require.main === module) {
  runMigration007().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runMigration007 };

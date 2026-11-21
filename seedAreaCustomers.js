const fs = require('fs');
const path = require('path');
try {
  const dotenv = require(path.resolve(__dirname, 'backend/node_modules/dotenv'));
  dotenv.config({ path: path.resolve(__dirname, 'backend/.env') });
} catch (e) {}

const { AREA_CONFIG, resolveArea } = require('./backend/src/config/areaConfig');
const { writeToCRM, readFromCRM } = require('./backend/src/config/database');

async function seedAreaCustomers() {
  console.log('🚀 Running seedAreaCustomers: Seeding canonical 5-area customers from data/customers.json...');

  const jsonPath = path.resolve(__dirname, 'backend/data/customers.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('❌ Error: backend/data/customers.json not found at', jsonPath);
    process.exit(1);
  }

  const customersData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`📦 Loaded ${customersData.length} customers from customers.json`);

  const areaSummary = {};
  Object.values(AREA_CONFIG).forEach(area => {
    areaSummary[area.name] = { mapped: 0, unmapped: 0, total: 0 };
  });

  customersData.forEach(c => {
    const area = resolveArea(c.area);
    const areaName = area ? area.name : c.area;
    if (!areaSummary[areaName]) areaSummary[areaName] = { mapped: 0, unmapped: 0, total: 0 };
    areaSummary[areaName].total++;
    const isMapped = c.lat && c.lng && !isNaN(parseFloat(c.lat)) && !isNaN(parseFloat(c.lng));
    if (isMapped) {
      areaSummary[areaName].mapped++;
    } else {
      areaSummary[areaName].unmapped++;
    }
  });

  console.log('\n📊 Customer breakdown by canonical area:');
  let totalMapped = 0;
  let totalUnmapped = 0;
  for (const [areaName, counts] of Object.entries(areaSummary)) {
    console.log(`  • ${areaName}: ${counts.mapped} mapped, ${counts.unmapped} unmapped (Total: ${counts.total})`);
    totalMapped += counts.mapped;
    totalUnmapped += counts.unmapped;
  }
  console.log(`  => Total: ${totalMapped} mapped pins, ${totalUnmapped} unmapped side panel stops (All: ${customersData.length})\n`);

  // Attempt database insertion if DB connection is active
  try {
    for (const [routeId, area] of Object.entries(AREA_CONFIG)) {
      await writeToCRM(
        `INSERT INTO routes (id, route_name, status)
         VALUES ($1, $2, 'Active')
         ON CONFLICT (id) DO UPDATE SET route_name = EXCLUDED.route_name, status = 'Active'`,
        [routeId, area.name]
      );
    }

    let inserted = 0;
    let updated = 0;

    for (const [idx, c] of customersData.entries()) {
      const area = resolveArea(c.area);
      const routeId = area ? area.id : null;
      const customerCode = c.customerId || `MM${String(1001 + idx).padStart(4, '0')}`;
      const lat = c.lat ? parseFloat(c.lat) : null;
      const lng = c.lng ? parseFloat(c.lng) : null;

      const dup = await readFromCRM(
        `SELECT id FROM customers WHERE LOWER(name) = LOWER($1) OR customer_code = $2 LIMIT 1`,
        [c.name, customerCode]
      );

      if (dup.rows && dup.rows.length > 0) {
        await writeToCRM(
          `UPDATE customers
           SET assigned_route_id = $1, address = $2, lat = $3, lng = $4, maps_url = $5, status = 'Active'
           WHERE id = $6`,
          [routeId, c.address || 'Chennai', lat, lng, c.maps_url || null, dup.rows[0].id]
        );
        updated++;
      } else {
        await writeToCRM(
          `INSERT INTO customers
             (customer_code, name, phone, whatsapp_number, address, lat, lng,
              assigned_route_id, enquiry_source, status, maps_url)
           VALUES ($1, $2, '0000000000', '0000000000', $3, $4, $5, $6, 'Direct', 'Active', $7)`,
          [customerCode, c.name, c.address || 'Chennai', lat, lng, routeId, c.maps_url || null]
        );
        inserted++;
      }
    }

    console.log(`✅ CRM Database synced successfully: ${inserted} inserted, ${updated} updated.`);
  } catch (dbErr) {
    console.warn(`⚠️ CRM Database offline or unavailable (${dbErr.message || dbErr}).`);
    console.log('✅ File-based single source of truth backend/data/customers.json verified and ready.');
  }

  return { totalMapped, totalUnmapped, total: customersData.length };
}

if (require.main === module) {
  seedAreaCustomers()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ seedAreaCustomers failed:', err);
      process.exit(1);
    });
}

module.exports = { seedAreaCustomers };

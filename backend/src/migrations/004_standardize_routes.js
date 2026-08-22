const { readFromCRM, writeToCRM } = require('../config/database');

const OFFICIAL_ROUTES = [
  { id: '69116213-871c-4d6c-88d3-84b59ac62e78', db2_id: 'db2-1',  name: 'Alwarpet 1' },
  { id: 'f0afbbb8-08e7-479d-9660-aae410018e01', db2_id: 'db2-2',  name: 'Egmore 1' },
  { id: '98791d4b-b096-49bb-bf0e-75ca51fca666', db2_id: 'db2-3',  name: 'Mandaveli 1' },
  { id: '9f2e4943-c2db-4ca8-9ee5-5a2c337241f9', db2_id: 'db2-4',  name: 'Mandaveli 2' },
  { id: '443e311b-0964-42dc-99de-9c18156a5d7f', db2_id: 'db2-5',  name: 'MRC Ngr' },
  { id: 'a7003dd8-219a-4546-9d9b-2969a60d716c', db2_id: 'db2-6',  name: 'Mylapore 1' },
  { id: '780f80f9-5207-43d5-bcdc-be6b341c9cd7', db2_id: 'db2-7',  name: 'Mylapore 2' },
  { id: '1b4a924f-1a3c-4658-9e23-a2a060917ac2', db2_id: 'db2-8',  name: 'Nungambakkam 1' },
  { id: '9f3ffe40-d485-4995-9dd0-ac74735c6402', db2_id: 'db2-9',  name: 'Royapettah 2' },
  { id: 'ab684dcb-a4eb-4135-ad41-b07158c30c4b', db2_id: 'db2-10', name: 'T-Nagar 1' },
  { id: '59311df6-345e-47d8-97c6-f71c0f64e1eb', db2_id: 'db2-11', name: 'Teynampet 1' },
  { id: '9835f558-456c-423f-985b-f21b981172d6', db2_id: 'db2-12', name: 'Triplicane 1' },
  { id: 'c041d6b2-ea1c-488d-a293-b755f3c66aa4', db2_id: 'db2-13', name: 'West Mambalam 1' },
  { id: '6f304069-2df7-496b-b991-8c69ba597859', db2_id: 'db2-14', name: 'West Mambalam 2' },
];

const LEGACY_NAME_MAP = {
  'alwarpet': 'Alwarpet 1',
  'alwarpet 1': 'Alwarpet 1',
  'egmore': 'Egmore 1',
  'egmore 1': 'Egmore 1',
  'mandaveli 1': 'Mandaveli 1',
  'mandaveli 2': 'Mandaveli 2',
  'mrc ngr': 'MRC Ngr',
  'mylapore 1': 'Mylapore 1',
  'mylapore 2': 'Mylapore 2',
  'nungambakkam': 'Nungambakkam 1',
  'nungambakkam 1': 'Nungambakkam 1',
  'royapettah': 'Royapettah 2',
  'royapettah 2': 'Royapettah 2',
  't-nagar': 'T-Nagar 1',
  't-nagar 1': 'T-Nagar 1',
  'tnagar 1': 'T-Nagar 1',
  'teynampet': 'Teynampet 1',
  'teynampet 1': 'Teynampet 1',
  'triplicane': 'Triplicane 1',
  'triplicane 1': 'Triplicane 1',
  'west mambalam 1': 'West Mambalam 1',
  'w.mblm 1': 'West Mambalam 1',
  'west mambalam 2': 'West Mambalam 2',
  'w.mblm 2': 'West Mambalam 2',
};

async function standardizeRoutes() {
  console.log('🔄 Starting route standardization migration...');

  try {
    // 1. Ensure all 14 official routes exist in CRM DB `routes` table with correct IDs & names
    for (const r of OFFICIAL_ROUTES) {
      await writeToCRM(
        `INSERT INTO routes (id, route_name, status)
         VALUES ($1, $2, 'Active')
         ON CONFLICT (id) DO UPDATE SET route_name = EXCLUDED.route_name, status = 'Active'`,
        [r.id, r.name]
      );
    }

    // 2. Map legacy customer route text/IDs in `customers` table to standardized IDs/names
    const customersRes = await readFromCRM('SELECT id, assigned_route_id FROM customers WHERE assigned_route_id IS NOT NULL');
    for (const cust of customersRes.rows) {
      const current = cust.assigned_route_id.trim();
      const lower = current.toLowerCase();

      // Check if it's already an official UUID
      const matchUuid = OFFICIAL_ROUTES.find(r => r.id === current || r.db2_id === current);
      if (matchUuid) {
        // Keep UUID or set to official ID
        if (cust.assigned_route_id !== matchUuid.id) {
          await writeToCRM('UPDATE customers SET assigned_route_id = $1 WHERE id = $2', [matchUuid.id, cust.id]);
        }
        continue;
      }

      // Check if legacy name maps to standardized name
      const targetName = LEGACY_NAME_MAP[lower];
      if (targetName) {
        const targetObj = OFFICIAL_ROUTES.find(r => r.name === targetName);
        if (targetObj) {
          await writeToCRM('UPDATE customers SET assigned_route_id = $1 WHERE id = $2', [targetObj.id, cust.id]);
        }
      }
    }

    // 3. Delete any extra non-standard routes from `routes` table
    const validIds = OFFICIAL_ROUTES.map(r => r.id);
    const deleteRes = await writeToCRM(
      `DELETE FROM routes WHERE id NOT IN (${validIds.map((_, i) => `$${i + 1}`).join(',')})`,
      validIds
    );
    console.log(`🧹 Cleaned up non-standard route records. Deleted count: ${deleteRes.rowCount || 0}`);

    // 4. Verify final route list in database
    const finalRoutes = await readFromCRM('SELECT id, route_name, status FROM routes ORDER BY route_name ASC');
    console.log(`✅ Standardized routes count in CRM DB: ${finalRoutes.rows.length}`);
    console.log(finalRoutes.rows.map((r, i) => `${i + 1}. ${r.route_name} (${r.id})`));

  } catch (err) {
    console.error('❌ Migration failed:', err);
  }
}

standardizeRoutes().then(() => process.exit(0));

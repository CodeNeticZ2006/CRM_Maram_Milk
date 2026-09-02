require('dotenv').config();
const { writeToCRM } = require('../config/database');

async function updateReportNames() {
  try {
    const res = await writeToCRM(
      "UPDATE reports SET generated_by = $1 WHERE generated_by ILIKE $2 OR generated_by = $3 OR generated_by IS NULL",
      ['Sarfaraz Ahmed', '%Sarfaz%', 'Super Admin']
    );
    console.log('✅ Updated reports count:', res.rowCount);
  } catch (err) {
    console.error('⚠️ DB update report names error:', err.message);
  }
}

updateReportNames().then(() => process.exit(0));

const bcrypt = require('bcryptjs');
const { writeToCRM } = require('../config/database');

const seedSuperAdmin = async () => {
  const email = 'admin@marammilk.com';
  const password = 'Sarfaraz@marammilk';
  const hash = await bcrypt.hash(password, 12);

  const check = await writeToCRM('SELECT id FROM super_admin WHERE email = $1', [email]);
  if (check.rows.length > 0) {
    await writeToCRM('UPDATE super_admin SET name = $1, password_hash = $2 WHERE email = $3', ['Sarfaraz Ahmed', hash, email]);
    console.log('ℹ️  Super Admin updated in DB: Sarfaraz Ahmed');
    return;
  }

  await writeToCRM(
    `INSERT INTO super_admin (name, email, password_hash, phone)
     VALUES ($1, $2, $3, $4)`,
    ['Sarfaraz Ahmed', email, hash, '+919999999999']
  );

  console.log('✅ Super Admin seeded:');
  console.log('   Name    : Sarfaraz Ahmed');
  console.log('   Email   :', email);
  console.log('   Password:', password);
};

module.exports = { seedSuperAdmin };

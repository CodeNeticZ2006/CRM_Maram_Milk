const { readFromCRM, writeToCRM } = require('../config/database');

const fixCustomerDates = async () => {
  try {
    const res = await readFromCRM('SELECT id FROM customers ORDER BY id');
    const customers = res.rows;
    console.log(`Setting realistic registration dates for ${customers.length} customers...`);

    for (let i = 0; i < customers.length; i++) {
      // Spread customer created_at over the last 90 days (1 to 90 days ago)
      const daysAgo = Math.floor((i / customers.length) * 90) + 1;
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);

      await writeToCRM('UPDATE customers SET created_at = $1 WHERE id = $2', [d, customers[i].id]);
    }

    console.log('✅ Customer created_at timestamps updated successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error updating customer dates:', err);
    process.exit(1);
  }
};

fixCustomerDates();

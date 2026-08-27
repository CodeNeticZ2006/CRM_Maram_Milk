const { writeToCRM, readFromCRM } = require('../config/database');

const cleanMockData = async () => {
  try {
    console.log('🧹 Purging synthetic mock seed data from CRM database...');

    // 1. Delete mock hold requests & change requests
    await writeToCRM("DELETE FROM hold_requests WHERE reason = 'Out of town'");
    await writeToCRM("DELETE FROM change_requests WHERE request_type = 'Quantity Change'");
    await writeToCRM("DELETE FROM hold_requests");
    await writeToCRM("DELETE FROM change_requests");
    console.log('✅ Purged hold and change requests.');

    // 2. Delete mock enquiries
    await writeToCRM("DELETE FROM customer_enquiries WHERE name LIKE 'Enquiry User%'");
    await writeToCRM("DELETE FROM customer_enquiries");
    console.log('✅ Purged customer enquiries.');

    // 3. Delete mock deliveries
    await writeToCRM("DELETE FROM deliveries");
    console.log('✅ Purged mock deliveries.');

    // 4. Delete mock payments & invoices
    await writeToCRM("DELETE FROM payments");
    await writeToCRM("DELETE FROM invoices");
    console.log('✅ Purged mock payments and invoices.');

    // 5. Delete mock wallet transactions & reset wallet balances
    await writeToCRM("DELETE FROM wallet_transactions");
    await writeToCRM("DELETE FROM wallet");
    await writeToCRM("UPDATE customers SET wallet_balance = 0");
    console.log('✅ Reset wallet transactions & zeroed balances.');

    // 6. Delete mock subscriptions
    await writeToCRM("DELETE FROM subscriptions");
    console.log('✅ Purged mock subscriptions.');

    // 7. Delete mock milk inventory
    await writeToCRM("DELETE FROM milk_inventory");
    console.log('✅ Purged mock milk inventory.');

    // 8. Restore customer created_at to NOW() if set in past
    await writeToCRM("UPDATE customers SET created_at = NOW()");
    console.log('✅ Restored customer created_at timestamps.');

    console.log('🎉 Cleanup complete! All synthetic mock seed data has been removed.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
  }
};

cleanMockData();

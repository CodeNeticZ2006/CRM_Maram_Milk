const { readFromCRM, writeToCRM } = require('../config/database');
const { getExpectedOperationalDate } = require('../services/operationalDay.service');

const seedData = async () => {
  try {
    console.log('🌱 Seeding operational dashboard data...');

    const opDay = getExpectedOperationalDate();
    const customersRes = await readFromCRM('SELECT id FROM customers LIMIT 70');
    const customers = customersRes.rows;

    if (customers.length === 0) {
      console.log('No customers found! Run customer seeds first.');
      process.exit(1);
    }

    console.log(`Found ${customers.length} customers.`);

    // 1. Spread customer created_at over last 6 months for realistic growth trend
    const monthsAgo = [5, 4, 3, 2, 1, 0];
    const customerPerMonth = Math.floor(customers.length / 6);

    for (let i = 0; i < customers.length; i++) {
      const mIdx = Math.min(Math.floor(i / customerPerMonth), 5);
      const mOffset = monthsAgo[mIdx];
      const d = new Date();
      d.setMonth(d.getMonth() - mOffset);
      d.setDate(Math.max(1, (i % 28) + 1));

      const isNeg = i % 7 === 0;
      const bal = isNeg ? -150 * (1 + (i % 3)) : 250 + (i * 15);

      await writeToCRM('UPDATE customers SET created_at = $1, wallet_balance = $2 WHERE id = $3', [d, bal, customers[i].id]);
      await writeToCRM(`
        INSERT INTO wallet (customer_id, balance, total_recharged, updated_at) 
        VALUES ($1, $2, $3, NOW()) 
        ON CONFLICT (customer_id) 
        DO UPDATE SET balance = $2, total_recharged = $3
      `, [customers[i].id, bal, Math.max(0, bal)]);
    }
    console.log('✅ Updated 70 customers & wallets with 6-month timeline & balances.');

    // 2. Subscriptions (55 active subscriptions)
    await writeToCRM('DELETE FROM subscriptions');
    const productsRes = await readFromCRM('SELECT id FROM products LIMIT 5');
    const prodId = productsRes.rows[0]?.id;

    for (let i = 0; i < 55; i++) {
      await writeToCRM(`
        INSERT INTO subscriptions (customer_id, product_id, quantity, start_date, status, frequency, created_at)
        VALUES ($1, $2, 1.0, CURRENT_DATE - 30, 'Active', 'Daily', NOW())
      `, [customers[i].id, prodId]);
    }
    console.log('✅ Seeded 55 active subscriptions.');

    // 3. Customer Enquiries (8 enquiries this month)
    await writeToCRM('DELETE FROM customer_enquiries');
    for (let i = 0; i < 8; i++) {
      await writeToCRM(`
        INSERT INTO customer_enquiries (name, phone, address, status, created_at)
        VALUES ($1, $2, 'Triplicane, Chennai', 'Pending', NOW())
      `, [`Enquiry User ${i+1}`, `987654321${i}`]);
    }
    console.log('✅ Seeded 8 enquiries.');

    // 4. Hold & Change Requests (4 Hold, 3 Change Pending)
    await writeToCRM('DELETE FROM hold_requests');
    await writeToCRM('DELETE FROM change_requests');

    for (let i = 0; i < 4; i++) {
      await writeToCRM(`
        INSERT INTO hold_requests (customer_id, hold_from, hold_to, reason, status, created_at)
        VALUES ($1, CURRENT_DATE, CURRENT_DATE + 5, 'Out of town', 'Pending', NOW())
      `, [customers[i].id]);
    }

    for (let i = 4; i < 7; i++) {
      await writeToCRM(`
        INSERT INTO change_requests (customer_id, request_type, old_value, new_value, status, created_at)
        VALUES ($1, 'Quantity Change', '1L Cow Milk', '2L Cow Milk', 'Pending', NOW())
      `, [customers[i].id]);
    }
    console.log('✅ Seeded Hold & Change Requests.');

    // 5. Deliveries (Deliveries for today & past days)
    await writeToCRM('DELETE FROM deliveries');
    for (let i = 0; i < 45; i++) {
      await writeToCRM(`
        INSERT INTO deliveries (customer_id, product_id, quantity, status, delivered_at, created_at)
        VALUES ($1, $2, 1.0, 'Delivered', NOW(), $3)
      `, [customers[i].id, prodId, opDay]);
    }

    // Past month deliveries for total milk delivered aggregation
    for (let i = 0; i < 60; i++) {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - (i % 25));
      await writeToCRM(`
        INSERT INTO deliveries (customer_id, product_id, quantity, status, delivered_at, created_at)
        VALUES ($1, $2, 1.5, 'Delivered', $3, $3)
      `, [customers[i % customers.length].id, prodId, pastDate]);
    }
    console.log('✅ Seeded deliveries for today & month.');

    // 6. Payments (Verified payments over last 6 months and today)
    await writeToCRM('DELETE FROM payments');
    for (let m = 0; m < 6; m++) {
      const pDate = new Date();
      pDate.setMonth(pDate.getMonth() - m);
      const amount = 45000 + (m * 8500);
      for (let k = 0; k < 5; k++) {
        await writeToCRM(`
          INSERT INTO payments (customer_id, amount, method, status, payment_date, created_at)
          VALUES ($1, $2, 'Razorpay', 'Verified', $3::DATE, $3::TIMESTAMPTZ)
        `, [customers[k].id, amount / 5, pDate]);
      }
    }
    // Today's revenue payments
    await writeToCRM(`
      INSERT INTO payments (customer_id, amount, method, status, payment_date, created_at)
      VALUES ($1, 3450.00, 'GPay', 'Verified', $2, NOW())
    `, [customers[0].id, opDay]);
    await writeToCRM(`
      INSERT INTO payments (customer_id, amount, method, status, payment_date, created_at)
      VALUES ($1, 2800.00, 'Cash', 'Verified', $2, NOW())
    `, [customers[1].id, opDay]);
    console.log('✅ Seeded payments & revenue history.');

    // 7. Invoices (Pending invoices)
    await writeToCRM('DELETE FROM invoices');
    for (let i = 0; i < 12; i++) {
      await writeToCRM(`
        INSERT INTO invoices (invoice_number, customer_id, month, year, grand_total, payment_status, due_date, created_at)
        VALUES ($1, $2, 8, 2026, 1250.00, 'Pending', CURRENT_DATE + 7, NOW())
      `, [`INV-202608-${100+i}`, customers[i].id]);
    }
    console.log('✅ Seeded 12 pending invoices.');

    // 8. Wallet Transactions
    await writeToCRM('DELETE FROM wallet_transactions');
    // Today's recharges
    await writeToCRM(`
      INSERT INTO wallet_transactions (customer_id, amount, type, method, status, created_at)
      VALUES ($1, 2000.00, 'Recharge', 'Cash', 'Completed', NOW())
    `, [customers[0].id]);
    await writeToCRM(`
      INSERT INTO wallet_transactions (customer_id, amount, type, method, status, created_at)
      VALUES ($1, 3500.00, 'Recharge', 'Razorpay', 'Completed', NOW())
    `, [customers[1].id]);

    // Monthly transactions
    for (let i = 0; i < 20; i++) {
      const isRefund = i % 6 === 0;
      const isCash = i % 2 === 0;
      await writeToCRM(`
        INSERT INTO wallet_transactions (customer_id, amount, type, method, status, created_at)
        VALUES ($1, $2, $3, $4, 'Completed', NOW() - INTERVAL '10 days')
      `, [customers[i].id, isRefund ? 200.00 : 1500.00, isRefund ? 'Refund' : 'Recharge', isCash ? 'Cash' : 'Razorpay']);
    }
    console.log('✅ Seeded wallet transactions.');

    // 9. Milk Inventory for today
    await writeToCRM(`
      INSERT INTO milk_inventory (date, opening_stock, milk_received, today_dispatch, remaining_stock, damaged_stock, closing_stock, next_day_stock, updated_at)
      VALUES ($1, 350.000, 500.000, 485.500, 14.500, 2.000, 12.500, 450.000, NOW())
      ON CONFLICT (date)
      DO UPDATE SET opening_stock = 350.000, milk_received = 500.000, today_dispatch = 485.500, remaining_stock = 14.500, damaged_stock = 2.000, closing_stock = 12.500, next_day_stock = 450.000, updated_at = NOW()
    `, [opDay]);
    console.log('✅ Seeded today milk inventory.');

    console.log('🎉 Dashboard operational data seeding complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding error:', err);
    process.exit(1);
  }
};

seedData();

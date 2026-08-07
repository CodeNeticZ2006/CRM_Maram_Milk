const { writeToCRM } = require('../config/database');

const runMigrations = async () => {
  console.log('🔄 Running DB1 (CRM) migrations...');

  const queries = [

    // ── Auth & OTP ──────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS super_admin (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone VARCHAR(20) NOT NULL,
      profile_image TEXT,
      last_login TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS otp_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_id UUID REFERENCES super_admin(id) ON DELETE CASCADE,
      otp_hash TEXT NOT NULL,
      method VARCHAR(10) NOT NULL CHECK (method IN ('email','sms')),
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      attempts INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // ── Masters ─────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS branches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      branch_name VARCHAR(100) NOT NULL,
      address TEXT,
      lat DECIMAL(10,8),
      lng DECIMAL(11,8),
      manager_ref_id UUID,
      status VARCHAR(20) DEFAULT 'Active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      category VARCHAR(50),
      unit VARCHAR(20) NOT NULL,
      price_per_unit DECIMAL(10,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'Active',
      image_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS pricing_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID REFERENCES products(id) ON DELETE CASCADE,
      customer_segment VARCHAR(50),
      price DECIMAL(10,2) NOT NULL,
      effective_from DATE,
      effective_to DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // ── Customers ────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS customers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      whatsapp_number VARCHAR(20),
      address TEXT,
      lat DECIMAL(10,8),
      lng DECIMAL(11,8),
      assigned_route_id UUID,
      dp_ref_id UUID,
      manager_ref_id UUID,
      wallet_balance DECIMAL(10,2) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'Active',
      enquiry_source VARCHAR(50),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS customer_notes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
      note TEXT NOT NULL,
      created_by VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS customer_enquiries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      address TEXT,
      enquiry_date DATE DEFAULT CURRENT_DATE,
      status VARCHAR(30) DEFAULT 'Pending',
      converted_to_customer_id UUID REFERENCES customers(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // ── Subscriptions & Pause ────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
      product_id UUID REFERENCES products(id),
      quantity DECIMAL(10,3) NOT NULL,
      frequency VARCHAR(20) DEFAULT 'Daily' CHECK (frequency IN ('Daily','Weekly','Monthly')),
      start_date DATE NOT NULL,
      status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active','Paused','Cancelled')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS subscription_pauses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
      customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
      product_id UUID REFERENCES products(id),
      pause_type VARCHAR(30) DEFAULT 'Single Date' CHECK (pause_type IN ('Single Date','Vacation','Weekly Skip','Monthly Skip')),
      pause_date DATE,
      resume_date DATE,
      status VARCHAR(20) DEFAULT 'Active',
      created_by VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS vacation_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      reason TEXT,
      status VARCHAR(20) DEFAULT 'Pending',
      approved_by VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS hold_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
      hold_from DATE NOT NULL,
      hold_to DATE NOT NULL,
      reason TEXT,
      status VARCHAR(20) DEFAULT 'Pending',
      approved_by VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS change_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
      request_type VARCHAR(50) NOT NULL,
      old_value TEXT,
      new_value TEXT,
      status VARCHAR(20) DEFAULT 'Pending',
      source VARCHAR(30) DEFAULT 'Manual',
      approved_by VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // ── Inventory ─────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS milk_inventory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      date DATE UNIQUE NOT NULL,
      opening_stock DECIMAL(10,3) DEFAULT 0,
      milk_received DECIMAL(10,3) DEFAULT 0,
      today_dispatch DECIMAL(10,3) DEFAULT 0,
      remaining_stock DECIMAL(10,3) DEFAULT 0,
      damaged_stock DECIMAL(10,3) DEFAULT 0,
      closing_stock DECIMAL(10,3) DEFAULT 0,
      next_day_stock DECIMAL(10,3) DEFAULT 0,
      updated_by VARCHAR(100),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS product_inventory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID REFERENCES products(id),
      date DATE NOT NULL,
      quantity DECIMAL(10,3) DEFAULT 0,
      batch_number VARCHAR(50),
      expiry_date DATE,
      supplier VARCHAR(100),
      remaining_qty DECIMAL(10,3) DEFAULT 0,
      min_stock_level DECIMAL(10,3) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(product_id, date)
    )`,

    `CREATE TABLE IF NOT EXISTS inventory_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      inventory_item_id VARCHAR(100) NOT NULL,
      product_name VARCHAR(150) NOT NULL,
      previous_stock DECIMAL(10,3) DEFAULT 0,
      quantity_added DECIMAL(10,3) NOT NULL,
      updated_stock DECIMAL(10,3) NOT NULL,
      unit VARCHAR(50) DEFAULT 'Litres',
      batch_number VARCHAR(100),
      supplier VARCHAR(150),
      action_type VARCHAR(50) DEFAULT 'ADD_STOCK',
      remarks TEXT,
      added_by VARCHAR(150) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // ── Logistics & Delivery ──────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS routes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      route_name VARCHAR(100) NOT NULL,
      branch_id UUID REFERENCES branches(id),
      dp_ref_id UUID,
      manager_ref_id UUID,
      status VARCHAR(20) DEFAULT 'Active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS route_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
      customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
      sequence_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(route_id, customer_id)
    )`,

    `CREATE TABLE IF NOT EXISTS optimized_routes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      route_id UUID REFERENCES routes(id),
      dp_ref_id UUID NOT NULL,
      date DATE NOT NULL,
      distance_km DECIMAL(10,2),
      eta_minutes INTEGER,
      polyline_json JSONB,
      waypoints_json JSONB,
      fuel_liters DECIMAL(10,3),
      status VARCHAR(20) DEFAULT 'Pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(route_id, dp_ref_id, date)
    )`,

    `CREATE TABLE IF NOT EXISTS daily_dispatch (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      date DATE NOT NULL,
      route_id UUID REFERENCES routes(id),
      dp_ref_id UUID NOT NULL,
      total_customers INTEGER DEFAULT 0,
      total_milk_liters DECIMAL(10,3) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft','Dispatched','Completed')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(date, route_id)
    )`,

    `CREATE TABLE IF NOT EXISTS deliveries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dispatch_id UUID REFERENCES daily_dispatch(id),
      customer_id UUID REFERENCES customers(id),
      product_id UUID REFERENCES products(id),
      quantity DECIMAL(10,3),
      status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending','Delivered','Failed','Skipped')),
      delivered_at TIMESTAMPTZ,
      lat DECIMAL(10,8),
      lng DECIMAL(11,8),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS gps_tracking (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dp_ref_id UUID NOT NULL,
      route_id UUID REFERENCES routes(id),
      lat DECIMAL(10,8) NOT NULL,
      lng DECIMAL(11,8) NOT NULL,
      speed DECIMAL(5,2),
      timestamp TIMESTAMPTZ DEFAULT NOW()
    )`,

    // ── Wallet & Payments ─────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS wallet (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
      balance DECIMAL(10,2) DEFAULT 0,
      total_recharged DECIMAL(10,2) DEFAULT 0,
      total_debited DECIMAL(10,2) DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS wallet_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID REFERENCES customers(id),
      type VARCHAR(20) NOT NULL CHECK (type IN ('Recharge','Debit','Refund','Adjustment')),
      amount DECIMAL(10,2) NOT NULL,
      method VARCHAR(30) CHECK (method IN ('Cash','GPay','PhonePe','Paytm','Razorpay','Adjustment')),
      reference VARCHAR(100),
      description TEXT,
      status VARCHAR(20) DEFAULT 'Completed',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_number VARCHAR(30) UNIQUE NOT NULL,
      customer_id UUID REFERENCES customers(id),
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      milk_total DECIMAL(10,2) DEFAULT 0,
      subproduct_total DECIMAL(10,2) DEFAULT 0,
      grand_total DECIMAL(10,2) DEFAULT 0,
      pdf_url TEXT,
      payment_status VARCHAR(30) DEFAULT 'Pending',
      due_date DATE,
      sent_via_whatsapp BOOLEAN DEFAULT FALSE,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(customer_id, month, year)
    )`,

    `CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID REFERENCES customers(id),
      invoice_id UUID REFERENCES invoices(id),
      amount DECIMAL(10,2) NOT NULL,
      method VARCHAR(30) CHECK (method IN ('Cash','GPay','PhonePe','Paytm','Razorpay','Wallet','Advance')),
      transaction_ref VARCHAR(100),
      status VARCHAR(30) DEFAULT 'Pending Verification' CHECK (status IN ('Verified','Pending Verification','Failed','Partial','Advance')),
      payment_link_token TEXT,
      token_used BOOLEAN DEFAULT FALSE,
      verified_by VARCHAR(100),
      payment_date DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS customer_ledger (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      description TEXT NOT NULL,
      debit DECIMAL(10,2) DEFAULT 0,
      credit DECIMAL(10,2) DEFAULT 0,
      balance DECIMAL(10,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // ── Communication & Operations ────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS whatsapp_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID REFERENCES customers(id),
      request_type VARCHAR(50) NOT NULL,
      raw_message TEXT,
      payload_json JSONB,
      payment_link TEXT,
      token_hash TEXT,
      status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
      approved_by VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS ecom_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID REFERENCES customers(id),
      order_items_json JSONB NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      payment_status VARCHAR(30) DEFAULT 'Pending',
      delivery_date DATE,
      status VARCHAR(30) DEFAULT 'Pending',
      razorpay_order_id VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS feedback (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID REFERENCES customers(id),
      category VARCHAR(50),
      message TEXT NOT NULL,
      rating INTEGER CHECK (rating BETWEEN 1 AND 5),
      status VARCHAR(20) DEFAULT 'Open',
      responded_by VARCHAR(100),
      response TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS sms_notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      recipient_type VARCHAR(20),
      recipient_id UUID,
      phone VARCHAR(20) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(20) CHECK (type IN ('SMS','WhatsApp','Push')),
      status VARCHAR(20) DEFAULT 'Pending',
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      report_type VARCHAR(50) NOT NULL,
      date_from DATE,
      date_to DATE,
      format VARCHAR(10) CHECK (format IN ('PDF','Excel')),
      file_url TEXT,
      generated_by VARCHAR(100),
      generated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_type VARCHAR(30),
      user_ref_id UUID,
      action VARCHAR(100) NOT NULL,
      entity VARCHAR(50),
      entity_id UUID,
      detail_json JSONB,
      ip_address VARCHAR(45),
      timestamp TIMESTAMPTZ DEFAULT NOW()
    )`,

    // ── Indexes for performance ───────────────────────────────────────────
    `CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status)`,
    `CREATE INDEX IF NOT EXISTS idx_customers_route ON customers(assigned_route_id)`,
    `CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_subscription_pauses_date ON subscription_pauses(pause_date)`,
    `CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_gps_dp_time ON gps_tracking(dp_ref_id, timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit_logs(timestamp)`,
  ];

  for (const query of queries) {
    try {
      await writeToCRM(query);
    } catch (err) {
      console.error('Migration error:', err.message);
      throw err;
    }
  }

  console.log(`✅ All ${queries.length} migrations completed on DB1 (CRM)`);
};

module.exports = { runMigrations };

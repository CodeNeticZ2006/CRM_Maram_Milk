require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { testConnections, getDatabaseHealth } = require('./config/database');
const { runMigrations } = require('./migrations/001_create_tables');
const { runMigration002 } = require('./migrations/002_add_maps_url');
const { runMigration003 } = require('./migrations/003_alter_assigned_route_id');
const { runMigration004 } = require('./migrations/004_create_operational_days');
const { runAdhocMigrations } = require('./migrations/005_adhoc_inventory_and_sales');
const runMigration006 = require('./migrations/006_stock_correctness');
const { runMigration007: runMigration007RouteCustomers } = require('./migrations/007_seed_missing_route_customers');
const { runMigration007: runMigration007InventoryItems } = require('./migrations/007_seed_missing_inventory_items');
const { seedSuperAdmin } = require('./utils/seed');
const { errorHandler } = require('./middleware/errorHandler');
const { checkAndTriggerRollover } = require('./services/operationalDay.service');

// ── Routes ──────────────────────────────────────────────────────────────────
const authRoutes          = require('./routes/auth.routes');
const dashboardRoutes     = require('./routes/dashboard.routes');
const customersRoutes     = require('./routes/customers.routes');
const mastersRoutes       = require('./routes/masters.routes');
const subscriptionsRoutes = require('./routes/subscriptions.routes');
const pauseRoutes         = require('./routes/pause.routes');
const walletRoutes        = require('./routes/wallet.routes');
const paymentsRoutes      = require('./routes/payments.routes');
const whatsappRoutes      = require('./routes/whatsapp.routes');
const reportsRoutes       = require('./routes/reports.routes');
const accessControlRoutes = require('./routes/accessControl.routes');
const inventoryRoutes     = require('./routes/inventory.routes');
const adhocRoutes         = require('./routes/adhoc.routes');
const stockCorrectnessRoutes = require('./routes/stockCorrectness.routes');
const routeIntelligenceRoutes = require('./routes/routeIntelligence.routes');
const emptyBottlesRoutes  = require('./routes/emptyBottles.routes');
const operationalDayRoutes = require('./routes/operationalDay.routes');

const app = express();
const PORT = process.env.PORT || 5000;

const getCorsOrigins = () => {
  const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
  if (!process.env.FRONTEND_URL) return defaultOrigins;
  const envOrigins = process.env.FRONTEND_URL
    .split(',')
    .map((url) => url.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return [...new Set([...envOrigins, ...defaultOrigins])];
};

// ── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: getCorsOrigins(),
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// Global rate limiter
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' },
}));

// Strict rate limiter for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts. Try again in 15 minutes.' },
});

// ── Body Parsers & Request Logger ────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Express HTTP Request Logger Middleware + Operational Day Check
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`📡 [${req.method}] ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });

  // Lazy check for 7:00 PM IST operational rollover (non-blocking)
  checkAndTriggerRollover().catch(err => console.warn('⚠️ Rollover check error:', err.message));

  next();
});

// ── Health Check ─────────────────────────────────────────────────────────────
const healthHandler = async (req, res) => {
  const dbHealth = await getDatabaseHealth();
  res.json({
    status: 'ok',
    service: 'Maram Milk CRM API',
    timestamp: new Date().toISOString(),
    databases: dbHealth,
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);


// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',          authLimiter, authRoutes);
app.use('/api/dashboard',     dashboardRoutes);
app.use('/api/customers',     customersRoutes);
app.use('/api/masters',       mastersRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/pause',         pauseRoutes);
app.use('/api/wallet',        walletRoutes);
app.use('/api/payments',      paymentsRoutes);
app.use('/api/whatsapp',      whatsappRoutes);
app.use('/api/reports',       reportsRoutes);
app.use('/api/access-control', accessControlRoutes);
app.use('/api/stock-correctness', stockCorrectnessRoutes);
app.use('/api/notifications',     stockCorrectnessRoutes);
app.use('/api/inventory/adhoc', adhocRoutes);
app.use('/api/adhoc',           adhocRoutes);
app.use('/api/inventory',      inventoryRoutes);
app.use('/api/route-intelligence', routeIntelligenceRoutes);
app.use('/api/empty-bottles',  emptyBottlesRoutes);
app.use('/api/operational-day', operationalDayRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
});

// Global error handler
app.use(errorHandler);

// ── Startup ──────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    console.log('🚀 Starting Maram Milk CRM API...');
    await testConnections();

    // Run migrations and seeding — non-fatal if DB unavailable
    try {
      await runMigrations();
      await runMigration002();
      await runMigration003();
      await runMigration004();
      await runAdhocMigrations();
      await runMigration006();
      await runMigration007RouteCustomers();
      await runMigration007InventoryItems();
      await seedSuperAdmin();
      // Initialize/verify active operational day on boot
      await checkAndTriggerRollover();
    } catch (dbErr) {
      console.warn('⚠️  DB setup skipped (DB unreachable):', dbErr.message);
    }

    // Schedule background 60s check for 7:00 PM IST rollover
    setInterval(() => {
      checkAndTriggerRollover().catch(err => console.warn('⚠️ Background rollover check warning:', err.message));
    }, 60000);

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n✅ Server running on http://127.0.0.1:${PORT}`);
      console.log(`📡 API Base: http://localhost:${PORT}/api`);
      console.log(`🔐 Auth:     http://localhost:${PORT}/api/auth`);
      console.log(`📊 Dashboard:http://localhost:${PORT}/api/dashboard`);
      console.log(`📅 Op Day:   http://localhost:${PORT}/api/operational-day/current`);
      console.log('\n');
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

start();

module.exports = app;

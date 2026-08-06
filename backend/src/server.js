require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { testConnections } = require('./config/database');
const { runMigrations } = require('./migrations/001_create_tables');
const { seedSuperAdmin } = require('./utils/seed');
const { errorHandler } = require('./middleware/errorHandler');

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

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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

// Express HTTP Request Logger Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`📡 [${req.method}] ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Maram Milk CRM API', timestamp: new Date().toISOString() });
});

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
app.use('/api/inventory',      inventoryRoutes);

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
      await seedSuperAdmin();
    } catch (dbErr) {
      console.warn('⚠️  DB setup skipped (DB unreachable):', dbErr.message);
    }

    app.listen(PORT, () => {
      console.log(`\n✅ Server running on http://localhost:${PORT}`);
      console.log(`📡 API Base: http://localhost:${PORT}/api`);
      console.log(`🔐 Auth:     http://localhost:${PORT}/api/auth`);
      console.log(`📊 Dashboard:http://localhost:${PORT}/api/dashboard`);
      console.log('\n');
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

start();

module.exports = app;

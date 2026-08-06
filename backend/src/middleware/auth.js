const { verifyToken } = require('../config/jwt');

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

/**
 * Super Admin Dedicated Email Check / Full Root Privileges
 */
const isDedicatedSuperAdmin = (req) => {
  const email = (req.admin?.email || '').toLowerCase().trim();
  const role = req.admin?.role || '';
  return email === 'admin@marammilk.com' || role === 'SuperAdmin' || role === 'Super Admin';
};

const requireSuperAdmin = (req, res, next) => {
  if (!isDedicatedSuperAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: '⛔ Access Denied: This action requires Dedicated Super Admin privileges (admin@marammilk.com).'
    });
  }
  next();
};

/**
 * Granular Module & Action Access Level Check
 * @param {string} moduleName — e.g. 'CUSTOMERS', 'WALLET', 'PAYMENTS', 'MASTERS', 'LOGISTICS'
 * @param {boolean} isWriteAction — true if POST/PUT/PATCH/DELETE edit operation
 */
const requirePermission = (moduleName, isWriteAction = false) => {
  return (req, res, next) => {
    // 1. Dedicated Super Admin has full unrestricted access everywhere
    if (isDedicatedSuperAdmin(req)) return next();

    const access = req.admin?.access || 'LIMITED';
    const permissions = req.admin?.permissions || [];

    // 2. Check Read-Only restriction on write actions
    if (isWriteAction && access === 'READ_ONLY') {
      return res.status(403).json({
        success: false,
        message: `⛔ Access Denied: You have Read-Only access. Editing in ${moduleName} is restricted.`
      });
    }

    // 3. Full Control users can view and edit all modules
    if (access === 'FULL_CONTROL') return next();

    // 4. Check if module is in allowed permissions list
    const hasModuleAccess = permissions.includes('*') || permissions.includes(moduleName);
    if (!hasModuleAccess) {
      return res.status(403).json({
        success: false,
        message: `⛔ Access Denied: You do not have permission to access the ${moduleName} module.`
      });
    }

    next();
  };
};

module.exports = { authenticate, requireSuperAdmin, requirePermission, isDedicatedSuperAdmin };

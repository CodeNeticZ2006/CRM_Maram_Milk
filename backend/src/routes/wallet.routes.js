const express = require('express');
const router = express.Router();
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const { getWallets, rechargeWallet, getWalletTransactions } = require('../controllers/wallet.controller');

router.use(authenticate);
router.get('/',                          getWallets);
router.get('/:customerId/transactions',  getWalletTransactions);

// Super Admin ONLY endpoint for Wallet Recharge
router.post('/recharge',                 requireSuperAdmin, rechargeWallet);

module.exports = router;

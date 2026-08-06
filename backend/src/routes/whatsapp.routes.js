const express = require('express');
const router = express.Router();
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const { getWhatsappRequests, updateWhatsappStatus, getWhatsappStats } = require('../controllers/whatsapp.controller');

router.use(authenticate);
router.get('/stats', getWhatsappStats);
router.get('/',      getWhatsappRequests);

// Super Admin ONLY endpoint for approving/rejecting WhatsApp requests
router.patch('/:id', requireSuperAdmin, updateWhatsappStatus);

module.exports = router;

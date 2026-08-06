const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getInventory, updateInventory } = require('../controllers/inventory.controller');

router.use(authenticate);

router.get('/',        getInventory);
router.post('/update', updateInventory);

module.exports = router;

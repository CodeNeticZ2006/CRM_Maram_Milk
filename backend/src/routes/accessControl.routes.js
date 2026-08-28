const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getAdminProfile, getUsers, getDeliveryPersons, createUser, updateUserPermissions } = require('../controllers/accessControl.controller');

router.use(authenticate);

router.get('/admin-profile',     getAdminProfile);
router.get('/users',             getUsers);
router.get('/delivery-persons',  getDeliveryPersons);
router.post('/users',            createUser);
router.patch('/users/:id',       updateUserPermissions);

module.exports = router;

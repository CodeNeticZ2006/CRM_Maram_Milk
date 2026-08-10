const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getProducts, createProduct, updateProduct, deleteProduct, getBranches, createBranch, updateBranch, getRoutes, createRoute, updateRoute, getDpsByRoute } = require('../controllers/masters.controller');

router.use(authenticate);

// Products
router.get('/products',       getProducts);
router.post('/products',      createProduct);
router.put('/products/:id',   updateProduct);
router.delete('/products/:id', deleteProduct);

// Branches
router.get('/branches',       getBranches);
router.post('/branches',      createBranch);
router.put('/branches/:id',   updateBranch);

// Routes
router.get('/routes',         getRoutes);
router.post('/routes',        createRoute);
router.put('/routes/:id',     updateRoute);

// DPs by Route
router.get('/dps-by-route',   getDpsByRoute);

module.exports = router;

// src/server/routes/calculateRoutes.js
const express = require('express');
const router = express.Router();
const { emission } = require('../controllers/emissionController');

router.post('/emissions', emission);

module.exports = router;

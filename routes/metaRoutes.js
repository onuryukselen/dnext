const express = require('express');
// const userController = require('./../controllers/userController');
const metaController = require('./../controllers/metaController');

const router = express.Router();

router.get('/protectedEndPoint', metaController.protectedEndPoint);

module.exports = router;

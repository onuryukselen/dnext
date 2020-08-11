const express = require('express');
const viewsController = require('../controllers/viewsController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(viewsController.alerts);
router.get('/receivetoken', authController.ssoReceiveToken);

router.use(authController.isLoggedIn);
router.get('/', viewsController.getOverview);

router.get('/login', authController.ensureSingleSignOn, viewsController.getOverview);

router.get('/tour/:slug', viewsController.getTour);
router.get('/me', authController.protect, viewsController.getAccount);
router.get('/my-tours', authController.protect, viewsController.getMyTours);

router.post('/submit-user-data', authController.protect, viewsController.updateUserData);

module.exports = router;

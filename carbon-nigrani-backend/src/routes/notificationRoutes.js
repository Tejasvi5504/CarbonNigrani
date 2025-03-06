const express = require('express');
const router = express.Router();
const {
    getNotifications,
    markAsRead,
    markAllAsRead,
    archiveNotification
} = require('../controllers/notificationController');

router.get('/fetch', getNotifications);
router.put('/:notificationId/read', markAsRead);
router.put('/read-all', markAllAsRead);
router.put('/:notificationId/archive', archiveNotification);

module.exports = router;

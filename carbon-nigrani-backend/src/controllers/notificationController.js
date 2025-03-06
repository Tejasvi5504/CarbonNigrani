const { postgresPool } = require('../config/db');

// Get all notifications with enhanced filtering
const getNotifications = async (req, res) => {
    const { archived, priority, category, isRead } = req.query;
    try {
        let query = `
            SELECT
                n.*,
                u.username as actor_name
            FROM notifications n
            LEFT JOIN users u ON n.user_id = u.user_id
            WHERE 1=1
        `;
        const queryParams = [];
        let paramCount = 1;

        // Add filters if provided
        if (archived !== undefined) {
            query += ` AND n.archived = $${paramCount}`;
            queryParams.push(archived === 'true');
            paramCount++;
        }

        if (priority) {
            query += ` AND n.priority = $${paramCount}`;
            queryParams.push(priority);
            paramCount++;
        }

        if (category) {
            query += ` AND n.category = $${paramCount}`;
            queryParams.push(category);
            paramCount++;
        }

        if (isRead !== undefined) {
            query += ` AND n.is_read = $${paramCount}`;
            queryParams.push(isRead === 'true');
            paramCount++;
        }

        query += ' ORDER BY n.created_at DESC';

        const result = await postgresPool.query(query, queryParams);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

// Create a new notification with enhanced fields
const createNotification = async (
    userId,
    actionType,
    description,
    targetId = null,
    targetType = null,
    priority = 'low',
    category = null
) => {
    try {
        const result = await postgresPool.query(
            `INSERT INTO notifications
            (user_id, action_type, description, target_id, target_type, priority, category)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [userId, actionType, description, targetId, targetType, priority, category]
        );
        return result.rows[0];
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};

// Mark notification as read with timestamp
const markAsRead = async (req, res) => {
    const { notificationId } = req.params;
    try {
        await postgresPool.query(
            'UPDATE notifications SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE notification_id = $1',
            [notificationId]
        );
        res.status(200).json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to update notification' });
    }
};

// Archive notification
const archiveNotification = async (req, res) => {
    const { notificationId } = req.params;
    try {
        await postgresPool.query(
            'UPDATE notifications SET archived = true WHERE notification_id = $1',
            [notificationId]
        );
        res.status(200).json({ message: 'Notification archived' });
    } catch (error) {
        console.error('Error archiving notification:', error);
        res.status(500).json({ error: 'Failed to archive notification' });
    }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
    try {
        await postgresPool.query(
            'UPDATE notifications SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE is_read = false'
        );
        res.status(200).json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Failed to update notifications' });
    }
};

module.exports = {
    getNotifications,
    createNotification,
    markAsRead,
    markAllAsRead,
    archiveNotification
};

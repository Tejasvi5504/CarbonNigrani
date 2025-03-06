const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { postgresPool } = require('../config/db');

exports.loginUser = async (req, res) => {
    const { username, password } = req.body;

    try {
        // First check if user exists and get their status
        const userResult = await postgresPool.query(
            'SELECT u.*, r.role_name FROM users u JOIN roles r ON u.role_id = r.role_id WHERE username = $1',
            [username]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        const user = userResult.rows[0];

        // Check if user is inactive
        if (!user.status) {
            return res.status(403).json({
                message: "Your account has been temporarily suspended. Please contact the administrator.",
                isInactive: true
            });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.user_id, username: user.username, role: user.role_name },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Update last login timestamp
        await postgresPool.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
            [user.user_id]
        );

        // Send response
        res.json({
            token,
            userData: {
                id: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role_name
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: "Internal server error" });
    }
};

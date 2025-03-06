const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { postgresPool } = require('../config/db');

exports.registerUser = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not defined in the environment');
        process.exit(1);
    }

    // if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    //     return res.status(400).json({ message: 'Username must be 3-20 characters long and contain only letters, numbers, or underscores' });
    // }

    if (password.length < 4) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    try {
        const userEmail = `${username}@carbonnigrani.in`;
        console.log("yes");

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        console.log(hashedPassword);

        // Insert user into database
        const userResult = await postgresPool.query(
            `INSERT INTO users (username, email, password_hash, role_id, created_at, updated_at)
             VALUES ($1, $2, $3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING *;`,
            [username, userEmail, hashedPassword]
        );
        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ message: 'User registration failed' });
        }

        // Generate JWT token
        const token = jwt.sign({ userId: user.user_id, role: user.role_id }, process.env.JWT_SECRET, {
            expiresIn: '1h',
        });

        res.status(201).json({
            message: 'Registration successful',
            token,
            userData: {
                userId: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role_id,
            },
        });
    } catch (error) {
        console.error('Error during user registration:', error.message);

        // Unique constraint violation handling
        if (error.code === '23505') {
            const errorMessage = error.detail.includes('username')
                ? 'Username already exists'
                : 'Email already exists';
            return res.status(400).json({ message: errorMessage });
        } else {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }
};

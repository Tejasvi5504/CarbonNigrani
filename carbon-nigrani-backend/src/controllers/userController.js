const bcrypt = require("bcrypt");
const { postgresPool } = require('../config/db');
const { createNotification } = require('./notificationController');

// Fetch all users
const getUsers = async (req, res) => {
    try {
      const result = await postgresPool.query(
        `SELECT
        u.user_id,
        u.username,
        u.email,
        u.role_id,
        r.role_name,
        u.status,
        u.last_login,
        to_char(u.updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_at
      FROM
        users u
      JOIN
        roles r
      ON
        u.role_id = r.role_id;`
      );
        console.log(result.rows);

      // Return the result rows as a JSON response
      res.status(200).json(result.rows);
    } catch (error) {
      console.error("Database query failed:", error.message);
      res.status(500).json({ error: "Failed to fetch users" });
    }
};

// Toggle User Status
const toggleUserStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        // Validate the status is boolean
        if (typeof status !== 'boolean') {
            return res.status(400).json({ error: "Status must be a boolean value" });
        }

        const result = await postgresPool.query(
            "UPDATE users SET status = $1 WHERE user_id = $2 RETURNING *",
            [status, id]
        );
        await postgresPool.query(
            'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        await createNotification(
            id,
            'USER_STATUS_CHANGED',
            `User ${result.rows[0].username}'s status was changed to ${status ? 'active' : 'inactive'}`,
            result.rows[0].user_id,
            'user',
            'high',
            'user_management'
        );

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Database query failed:", error.message);
        res.status(500).json({ error: "Failed to update user status" });
    }
};

// Create a new user
const createUser = async (req, res) => {
  const { username, email, password, role } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await postgresPool.query(
      "INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *",
      [username, email, hashedPassword, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating user");
  }
};

// Update user details
const updateUser = async (req, res) => {
  const { user_id, username, email, password, role_id, status } = req.body;

  try {
    // Start building the query and values array
    let updateFields = [
      'username = $1',
      'email = $2',
      'role_id = $3',
      'status = $4',
      'updated_at = CURRENT_TIMESTAMP'
    ];
    let values = [username, email, role_id, status];
    let valueIndex = 5;

    // Add password to update if provided
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push(`password_hash = $${valueIndex}`);
      values.push(hashedPassword);
      valueIndex++;
    }

    // Add user_id as the last parameter
    values.push(user_id);

    const query = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE user_id = $${valueIndex}
      RETURNING *, to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') as formatted_updated_at
    `;

    console.log('Update query:', query);
    console.log('Update values:', values);

    const result = await postgresPool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    await createNotification(
        user_id,
        'USER_UPDATED',
        `User ${result.rows[0].username} was updated`,
        result.rows[0].user_id,
        'user',
        'medium',
        'user_management'
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Database query failed:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
};

// Delete a user
const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    await postgresPool.query("DELETE FROM users WHERE id = $1", [id]);
    res.status(204).send("User deleted");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting user");
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus
};

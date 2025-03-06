const express = require('express');
const router = express.Router();
const { loginUser } = require('../controllers/loginUserController');
const { registerUser } = require('../controllers/registerUserController');

// Route for logging in
router.post('/login', loginUser);
router.post('/register', registerUser);
router.post('/logout', (req, res) => {
    res.json({ messsage: 'Logout successfully' });
});

module.exports = router;

const express = require('express');
const router = express.Router();

// Controller se functions import kiye (Path is perfectly correct now)
const { registerUser, loginUser } = require('../controllers/authController');

// http://localhost:5000/api/auth/register (Frontend ke sath sync kar diya)
router.post('/register', registerUser);

// http://localhost:5000/api/auth/login
router.post('/login', loginUser);

module.exports = router;
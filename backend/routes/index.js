const express = require('express');
const router = express.Router();

// Saare routes same folder (routes/) me hain
const authRoutes = require('./authRoutes');
const postRoutes = require('./postRoutes');
const userRoutes = require('./userRoutes');
const chatRoutes = require('./chatRoutes'); 

router.use('/auth', authRoutes);
router.use('/posts', postRoutes);
router.use('/users', userRoutes);

// 👑 FIXED: /chat ko badal kar /chats kiya taake frontend ke fetch URL (`/api/chats/messages`) ke sath perfectly map ho sake!
router.use('/chats', chatRoutes); 

module.exports = router;
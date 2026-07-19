const express = require('express');
const router = express.Router();

// 👑 FIXED: Destructuring me 'deleteMessageForEveryone' add kar diya hai
const { startConversation, sendMessage, getMessages, getAllUsersForChat, deleteMessageForEveryone } = require('../controllers/chatController');

// Clean direct extraction lookup
const { upload } = require('../../config/cloudinary'); 

// Debugging validator check
console.log("Chat Cloudinary Middleware Status:", typeof upload === 'function' || (upload && typeof upload.single === 'function') ? "✅ Loaded Perfectly!" : "❌ Still Undefined!");

// ==========================================
// 💬 CHAT ROUTES SETUP
// ==========================================

// 1. Chat room initiate karne ke liye
router.post('/conversation', startConversation);

// 2. Message bhejne ke liye
router.post('/message', upload.single('media'), sendMessage);

// 3. Kisi conversation ki encrypted history nikalne ke liye
router.get('/messages/:conversation_id', getMessages);

// 4. Chat sidebar ke liye saare registered users nikalne ka route
router.get('/users/all', getAllUsersForChat);

// 5. Delete for everyone endpoint
router.delete('/message/:message_id', deleteMessageForEveryone);

module.exports = router;
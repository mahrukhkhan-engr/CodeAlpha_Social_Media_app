const express = require('express');
const router = express.Router();

// Controllers import - Added comment management functions 💬
const { 
    createPost, 
    getAllPosts, 
    addComment, 
    deletePost, 
    getPostLikes,    // 👈 Likes list controller function
    getPostComments, // 👈 Comments list controller function
    deleteComment    // 👈 Comment delete controller function
} = require('../controllers/postController');

// Cloudinary config import
const cloudinaryModule = require('../../config/cloudinary'); 
const upload = cloudinaryModule.upload || cloudinaryModule; 

// Debugging logs to verify status
console.log("Cloudinary Upload Middleware Status:", typeof upload === 'function' || (upload && typeof upload.single === 'function') ? "✅ Loaded" : "❌ Undefined!");
console.log("CreatePost Controller Status:", typeof createPost === 'function' ? "✅ Loaded" : "❌ Undefined!");
console.log("DeletePost Controller Status:", typeof deletePost === 'function' ? "✅ Loaded" : "❌ Undefined!");

// ==========================================
// 🚀 ROUTES MANAGEMENT
// ==========================================

// 1. Create a new post (Supports multiple images/videos)
router.post('/', upload.array('media', 10), createPost); 

// 2. Get all posts for the home feed
router.get('/', getAllPosts);           

// 3. Delete a post dynamically (Authorized to author only) 🗑️
router.delete('/:post_id', deletePost);

// ==========================================
// ❤️ LIKES USER INTERFACE MANAGEMENT
// ==========================================
// Get list of users who liked a specific post 👥
router.get('/:post_id/likes', getPostLikes);

// ==========================================
// 💬 COMMENTS MANAGEMENT ENDPOINTS
// ==========================================
// Add a comment to a specific post
router.post('/:post_id/comment', addComment); 

// Get all comments for a specific post with user profiles 📰
router.get('/:post_id/comments', getPostComments);

// Delete a specific comment by its unique ID 🗑️
router.delete('/comment/:comment_id', deleteComment);

module.exports = router;
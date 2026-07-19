const pool = require('../../db');

// =========================================================================
// 📸 1. CREATE NEW POST (MULTIPLE & SINGLE MEDIA SAFELY HANDLED)
// =========================================================================
const createPost = async (req, res) => {
    try {
        const user_id = req.body.user_id;
        const finalCaption = req.body.content || req.body.caption || '';
        const parsedUserId = user_id ? parseInt(user_id, 10) : null;

        let mediaUrls = [];
        if (req.files && req.files.length > 0) {
            mediaUrls = req.files.map(file => file.path);
        } else if (req.file) {
            mediaUrls.push(req.file.path);
        }

        if (!parsedUserId || (finalCaption.trim() === '' && mediaUrls.length === 0)) {
            return res.status(400).json({ error: "Validation failed. Caption or media is required." });
        }

        const dbMediaValue = mediaUrls.length > 0 ? mediaUrls.join(',') : null;

        const newPost = await pool.query(
            "INSERT INTO posts (user_id, caption, image_url) VALUES ($1, $2, $3) RETURNING *",
            [parsedUserId, finalCaption.trim(), dbMediaValue]
        );

        return res.status(201).json({ success: true, post: newPost.rows[0] });
    } catch (err) {
        console.error("Crash in createPost pipeline:", err.message);
        return res.status(500).json({ error: `Server pipeline error: ${err.message}` });
    }
};

// =========================================================================
// 📰 2. GET ALL POSTS (FEED - UPDATED WITH REAL-TIME LIKE STATES)
// =========================================================================
const getAllPosts = async (req, res) => {
    try {
        const current_user_id = req.query.current_user_id ? parseInt(req.query.current_user_id, 10) : null;

        const posts = await pool.query(`
            SELECT p.id, p.user_id, p.image_url, p.created_at, p.caption AS content,
                   u.username, u.profile_pic,
                   (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS total_likes,
                   (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS total_comments,
                   CASE WHEN $1::int IS NOT NULL AND EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $1) THEN TRUE ELSE FALSE END AS is_liked
            FROM posts p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
        `, [current_user_id]);

        return res.status(200).json(posts.rows);
    } catch (err) {
        console.error("Error in getAllPosts:", err.message);
        return res.status(500).json({ error: "Server error" });
    }
};

// =========================================================================
// 🗑️ 3. DELETE A POST (With Foreign Constraints Manual Cascade Cleanup)
// =========================================================================
const deletePost = async (req, res) => {
    const { post_id } = req.params;
    const { user_id } = req.body;
    try {
        const postCheck = await pool.query("SELECT * FROM posts WHERE id = $1", [post_id]);
        if (postCheck.rows.length === 0) {
            return res.status(404).json({ error: "Post not found" });
        }
        if (postCheck.rows[0].user_id !== parseInt(user_id, 10)) {
            return res.status(403).json({ error: "Unauthorized! You can only delete your own posts." });
        }
        
        await pool.query("DELETE FROM likes WHERE post_id = $1", [post_id]);
        await pool.query("DELETE FROM comments WHERE post_id = $1", [post_id]);
        await pool.query("DELETE FROM posts WHERE id = $1", [post_id]);

        return res.status(200).json({ success: true, message: "Post deleted successfully!" });
    } catch (err) {
        console.error("Delete Error:", err.message);
        return res.status(500).json({ error: "Server error while deleting post" });
    }
};

// =========================================================================
// 💬 4. ADD COMMENT TO A POST (Modified to return user metadata instantly)
// =========================================================================
const addComment = async (req, res) => {
    const { post_id } = req.params;
    const { user_id, comment_text } = req.body;
    if (!user_id || !comment_text || comment_text.trim() === '') {
        return res.status(400).json({ error: "Comment text and user id are required" });
    }
    try {
        const newCommentRes = await pool.query(
            "INSERT INTO comments (post_id, user_id, comment_text) VALUES ($1, $2, $3) RETURNING *",
            [parseInt(post_id, 10), parseInt(user_id, 10), comment_text.trim()]
        );

        // Fetch user data for instant frontend injection layer mapping
        const commentUser = await pool.query(
            "SELECT username, profile_pic FROM users WHERE id = $1",
            [parseInt(user_id, 10)]
        );

        const mergedComment = {
            ...newCommentRes.rows[0],
            username: commentUser.rows[0].username,
            profile_pic: commentUser.rows[0].profile_pic
        };

        return res.status(201).json({ message: "Comment added!", comment: mergedComment });
    } catch (err) {
        console.error("Error in addComment:", err.message);
        return res.status(500).json({ error: "Server error" });
    }
};

// =========================================================================
// ❤️ 5. GET USERS WHO LIKED A POST
// =========================================================================
const getPostLikes = async (req, res) => {
    const { post_id } = req.params;
    try {
        const result = await pool.query(`
            SELECT u.id, u.username, u.profile_pic 
            FROM likes l
            JOIN users u ON l.user_id = u.id
            WHERE l.post_id = $1
        `, [parseInt(post_id, 10)]);

        return res.status(200).json(result.rows);
    } catch (err) {
        console.error("🔥 Error fetching post likes list:", err.message);
        return res.status(500).json({ error: "Server error fetching likes list." });
    }
};

// =========================================================================
// 💬 6. NEW: GET ALL COMMENTS FOR A SPECIFIC POST
// =========================================================================
const getPostComments = async (req, res) => {
    const { post_id } = req.params;
    try {
        const comments = await pool.query(`
            SELECT c.id, c.post_id, c.user_id, c.comment_text, c.created_at,
                   u.username, u.profile_pic
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.post_id = $1
            ORDER BY c.created_at ASC
        `, [parseInt(post_id, 10)]);

        return res.status(200).json(comments.rows);
    } catch (err) {
        console.error("🔥 Error in getPostComments:", err.message);
        return res.status(500).json({ error: "Server error fetching comments." });
    }
};

// =========================================================================
// 🗑️ 7. NEW: DELETE A SPECIFIC COMMENT
// =========================================================================
const deleteComment = async (req, res) => {
    const { comment_id } = req.params;
    const { user_id } = req.body; // To verify if the user owns the comment

    try {
        const commentCheck = await pool.query("SELECT * FROM comments WHERE id = $1", [parseInt(comment_id, 10)]);
        if (commentCheck.rows.length === 0) {
            return res.status(404).json({ error: "Comment not found." });
        }

        // Check ownership authorization layer
        if (commentCheck.rows[0].user_id !== parseInt(user_id, 10)) {
            return res.status(403).json({ error: "Unauthorized! You can only delete your own comments." });
        }

        await pool.query("DELETE FROM comments WHERE id = $1", [parseInt(comment_id, 10)]);
        return res.status(200).json({ success: true, message: "Comment deleted successfully!" });
    } catch (err) {
        console.error("🔥 Error in deleteComment:", err.message);
        return res.status(500).json({ error: "Server error deleting comment." });
    }
};

module.exports = { 
    createPost, 
    getAllPosts, 
    deletePost, 
    addComment, 
    getPostLikes, 
    getPostComments, // Added to export
    deleteComment    // Added to export
};
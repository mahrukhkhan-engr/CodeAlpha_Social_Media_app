const path = require('path');
// 💡 PERMANENT FIX: Database pool link crash protect logic
const pool = require(path.join(__dirname, '../../db'));

// =========================================================================
// 🔍 1. SEARCH USERS BY USERNAME OR EMAIL (Insta-Style with Live Follow Status)
// =========================================================================
const searchUsers = async (req, res) => {
    try {
        const { query, current_user_id } = req.query;

        if (!query) {
            return res.status(400).json({ error: "Search query is required." });
        }

        const parsedUserId = current_user_id ? parseInt(current_user_id, 10) : null;

        const result = await pool.query(
            `SELECT u.id, u.username, u.email, u.profile_pic,
             CASE WHEN f.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_following
             FROM users u
             LEFT JOIN followers f ON f.following_id = u.id AND f.follower_id = $2
             WHERE (u.username ILIKE $1 OR u.email ILIKE $1) AND u.id != $2
             LIMIT 10`,
            [`%${query}%`, parsedUserId]
        );

        return res.status(200).json(result.rows);
    } catch (err) {
        console.error("🔥 Error in searchUsers:", err.message);
        return res.status(500).json({ error: "Server error during search." });
    }
};

// =========================================================================
// 👍 2. LIKE / UNLIKE A POST (Toggle System)
// =========================================================================
const toggleLike = async (req, res) => {
    const { user_id, post_id } = req.body;
    try {
        const existingLike = await pool.query(
            "SELECT * FROM likes WHERE user_id = $1 AND post_id = $2",
            [user_id, post_id]
        );
        if (existingLike.rows.length > 0) {
            await pool.query("DELETE FROM likes WHERE user_id = $1 AND post_id = $2", [user_id, post_id]);
            return res.status(200).json({ message: "👎 Post unliked successfully" });
        } else {
            await pool.query("INSERT INTO likes (user_id, post_id) VALUES ($1, $2)", [user_id, post_id]);
            return res.status(201).json({ message: "👍 Post liked successfully" });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error" });
    }
};

// =========================================================================
// ➕ 3. FOLLOW / UNFOLLOW A USER (Toggle System)
// =========================================================================
const toggleFollow = async (req, res) => {
    const { follower_id, following_id } = req.body;
    if (parseInt(follower_id, 10) === parseInt(following_id, 10)) {
        return res.status(400).json({ error: "You cannot follow yourself!" });
    }
    try {
        const existingFollow = await pool.query(
            "SELECT * FROM followers WHERE follower_id = $1 AND following_id = $2",
            [follower_id, following_id]
        );
        if (existingFollow.rows.length > 0) {
            await pool.query("DELETE FROM followers WHERE follower_id = $1 AND following_id = $2", [follower_id, following_id]);
            return res.status(200).json({ message: "Unfollowed user", action: "unfollowed" });
        } else {
            await pool.query("INSERT INTO followers (follower_id, following_id) VALUES ($1, $2)", [follower_id, following_id]);
            return res.status(201).json({ message: "Followed user", action: "followed" });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error" });
    }
};

// =========================================================================
// 👤 4. GET USER PROFILE
// =========================================================================
const getUserProfile = async (req, res) => {
    const { username } = req.params; 
    const { current_user_id } = req.query;

    try {
        let userResult;
        const isNumericId = /^\d+$/.test(username); 

        if (isNumericId || req.path.includes('/id/')) {
            userResult = await pool.query(
                `SELECT id, username, email, bio, profile_pic, created_at FROM users WHERE id = $1`, 
                [parseInt(username, 10)]
            );
        } else {
            userResult = await pool.query(
                `SELECT id, username, email, bio, profile_pic, created_at FROM users WHERE username = $1`, 
                [username]
            );
        }

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        const targetUser = userResult.rows[0];

        const followersListRes = await pool.query(
            `SELECT u.id, u.username, u.profile_pic 
             FROM followers f 
             JOIN users u ON f.follower_id = u.id 
             WHERE f.following_id = $1`, 
            [targetUser.id]
        );

        const followingListRes = await pool.query(
            `SELECT u.id, u.username, u.profile_pic 
             FROM followers f 
             JOIN users u ON f.following_id = u.id 
             WHERE f.follower_id = $1`, 
            [targetUser.id]
        );

        let isFollowing = false;
        if (current_user_id) {
            const followCheck = await pool.query(
                "SELECT 1 FROM followers WHERE follower_id = $1 AND following_id = $2",
                [parseInt(current_user_id, 10), targetUser.id]
            );
            isFollowing = followCheck.rows.length > 0;
        }

        const userPostsRes = await pool.query(
            `SELECT p.id, p.caption, p.image_url, p.created_at, u.username 
             FROM posts p 
             JOIN users u ON p.user_id = u.id 
             WHERE p.user_id = $1 
             ORDER BY p.created_at DESC`,
            [targetUser.id]
        );

        return res.status(200).json({
            user: targetUser,
            posts: userPostsRes.rows,
            followers_count: followersListRes.rows.length,
            following_count: followingListRes.rows.length,
            followers: followersListRes.rows, 
            following: followingListRes.rows,   
            is_following: isFollowing
        });

    } catch (err) {
        console.error("🔥 Error in getUserProfile Engine:", err.message);
        res.status(500).json({ error: "Server error while fetching profile details." });
    }
};

// =========================================================================
// ✏️ 5. UPDATE BIO
// =========================================================================
const updateBio = async (req, res) => {
    const { user_id, bio } = req.body;
    try {
        const result = await pool.query(
            "UPDATE users SET bio = $1 WHERE id = $2 RETURNING id, username, bio",
            [bio, parseInt(user_id, 10)]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
        return res.status(200).json({ message: "Bio updated successfully", user: result.rows[0] });
    } catch (err) {
        console.error("🔥 Error in updateBio:", err.message);
        return res.status(500).json({ error: "Server error updating bio." });
    }
};

// =========================================================================
// 📸 6. UPDATE PROFILE PICTURE (With Object Extraction Strategy)
// =========================================================================
const updateProfilePic = async (req, res) => {
    try {
        let user_id = req.body.user_id;
        
        if (typeof user_id === 'object' && user_id !== null) {
            user_id = user_id.id || user_id.user_id || Object.values(user_id)[0];
        }

        const parsedUserId = parseInt(user_id, 10);

        if (!parsedUserId || isNaN(parsedUserId)) {
            console.error("🔥 Error: Profile Pic Update failed due to Invalid user_id:", user_id);
            return res.status(400).json({ error: "Invalid or missing User ID." });
        }
        
        let filePath = null;
        if (req.file) {
            filePath = req.file.path || req.file.secure_url; 
        } else if (req.body.profile_pic) {
            filePath = req.body.profile_pic;
        }
        
        if (!filePath) {
            filePath = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
        }

        const result = await pool.query(
            "UPDATE users SET profile_pic = $1 WHERE id = $2 RETURNING profile_pic",
            [filePath, parsedUserId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found in database." });
        }

        return res.status(200).json({ profile_pic: result.rows[0].profile_pic });
    } catch (err) {
        console.error("🔥 Error in updateProfilePic Engine:", err);
        return res.status(500).json({ error: "Server error uploading avatar picture." });
    }
};

// =========================================================================
// 🗑️ 7. DELETE PROFILE PICTURE
// =========================================================================
const deleteProfilePic = async (req, res) => {
    const { user_id } = req.body;
    try {
        const defaultAvatar = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
        await pool.query("UPDATE users SET profile_pic = $1 WHERE id = $2", [defaultAvatar, parseInt(user_id, 10)]);
        return res.status(200).json({ message: "Profile picture removed successfully", defaultAvatar });
    } catch (err) {
        console.error("🔥 Error in deleteProfilePic:", err.message);
        return res.status(500).json({ error: "Server error removing avatar picture." });
    }
};

module.exports = { 
    searchUsers, 
    toggleLike, 
    toggleFollow, 
    getUserProfile, 
    updateBio, 
    updateProfilePic, 
    deleteProfilePic 
};
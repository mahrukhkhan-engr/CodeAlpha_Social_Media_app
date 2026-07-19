const pool = require('../../db'); // Path setup
const { encrypt, decrypt } = require('../../utils/cryptoUtil'); // Aapki existing crypto mapping

// =========================================================================
// 🚀 1. START CONVERSATION (Room check or Create)
// =========================================================================
const startConversation = async (req, res) => {
    try {
        const sender_id = parseInt(req.body.user_id, 10);
        const receiver_id = parseInt(req.body.receiver_id, 10);

        if (!sender_id || !receiver_id) {
            return res.status(400).json({ error: "Sender and Receiver ID required." });
        }

        const roomCheck = await pool.query(
            `SELECT * FROM conversations 
             WHERE (user_one_id = $1 AND user_two_id = $2) 
                OR (user_one_id = $2 AND user_two_id = $1)`,
            [sender_id, receiver_id]
        );

        if (roomCheck.rows.length > 0) {
            return res.status(200).json(roomCheck.rows[0]);
        }

        const u1 = sender_id < receiver_id ? sender_id : receiver_id;
        const u2 = sender_id < receiver_id ? receiver_id : sender_id;

        const newRoom = await pool.query(
            "INSERT INTO conversations (user_one_id, user_two_id) VALUES ($1, $2) RETURNING *",
            [u1, u2]
        );

        return res.status(201).json(newRoom.rows[0]);
    } catch (err) {
        console.error("Room handler failed:", err.message);
        return res.status(500).json({ error: "Database Room Pipeline crash." });
    }
};

// =========================================================================
// 📤 2. SEND MESSAGE (Save text/media into DB with Encryption)
// =========================================================================
const sendMessage = async (req, res) => {
    try {
        const { conversation_id, sender_id, message_type, message_text } = req.body;
        
        let fileUrl = null;
        let finalType = message_type || 'text';

        if (req.file) {
            fileUrl = req.file.path; // Cloudinary secure storage path
            
            // 👑 SMART CHECK: File mimetype switch engine
            if (req.file.mimetype.includes('video')) {
                finalType = 'video';
            } else if (req.file.mimetype.includes('audio')) {
                finalType = 'audio';
            } else if (req.file.mimetype.includes('image')) {
                finalType = 'image';
            }
        }

        let finalMediaText = message_text;
        if (finalType === 'text' && message_text) {
            finalMediaText = encrypt(message_text); // Crypt utility activation
        }

        const newMsg = await pool.query(
            `INSERT INTO messages (conversation_id, sender_id, message_type, message_text, file_url) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [conversation_id, sender_id, finalType, finalMediaText, fileUrl]
        );

        const output = { ...newMsg.rows[0] };
        if (output.message_type === 'text') {
            output.message_text = message_text; // Frontend sync ke liye original return kiya
        }

        return res.status(201).json(output);
    } catch (err) {
        console.error("🔥 Chat Media save error:", err.message);
        return res.status(500).json({ error: "Failed to write data packet." });
    }
};

// =========================================================================
// 📥 3. GET MESSAGES (Fetch and safe-decrypt with try-catch backup)
// =========================================================================
const getMessages = async (req, res) => {
    try {
        const { conversation_id } = req.params;

        const result = await pool.query(
            "SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC",
            [conversation_id]
        );

        const decryptedMessages = result.rows.map(msg => {
            if (msg.message_type === 'text' && msg.message_text) {
                try {
                    msg.message_text = decrypt(msg.message_text);
                } catch (decError) {
                    console.error(`Failed to decrypt message ID ${msg.id}:`, decError.message);
                    // Clear text fallback agar data structure corrupt ho sake
                }
            }
            return msg;
        });

        return res.status(200).json(decryptedMessages);
    } catch (err) {
        console.error("History pipeline crash:", err.message);
        return res.status(500).json({ error: "Server error fetching chat keys." });
    }
};

// =========================================================================
// 👥 4. GET ALL REGISTERED USERS FOR CHAT SIDEBAR
// =========================================================================
const getAllUsersForChat = async (req, res) => {
    try {
        const result = await pool.query("SELECT id, username, profile_pic FROM users ORDER BY username ASC");
        return res.status(200).json(result.rows);
    } catch (err) {
        console.error("Failed to fetch registered app users:", err.message);
        return res.status(500).json({ error: "Server error fetching users." });
    }
};

// =========================================================================
// 🗑️ 5. DELETE FOR EVERYONE (Authorized Only)
// =========================================================================
const deleteMessageForEveryone = async (req, res) => {
    try {
        const { message_id } = req.params;
        const { sender_id } = req.body; 

        if (!message_id || !sender_id) {
            return res.status(400).json({ error: "Missing required parameters." });
        }

        const msgCheck = await pool.query("SELECT * FROM messages WHERE id = $1", [message_id]);
        if (msgCheck.rows.length === 0) {
            return res.status(404).json({ error: "Message not found." });
        }

        if (msgCheck.rows[0].sender_id !== parseInt(sender_id, 10)) {
            return res.status(403).json({ error: "Unauthorized! You can only delete your own messages." });
        }

        // Delete node execution
        await pool.query("DELETE FROM messages WHERE id = $1", [message_id]);

        return res.status(200).json({ success: true, message_id: parseInt(message_id, 10) });
    } catch (err) {
        console.error("Error in delete message pipeline:", err.message);
        return res.status(500).json({ error: "Failed to delete message packet." });
    }
};

module.exports = { startConversation, sendMessage, getMessages, getAllUsersForChat, deleteMessageForEveryone };
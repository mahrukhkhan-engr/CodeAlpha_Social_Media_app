const pool = require('../../db'); // Database connection import kiya

// 1. REGISTER USER (Signup)
const registerUser = async (req, res) => {
    const { username, email, password } = req.body;

    // Validation: Check karo sab data aaya hai ya nahi
    if (!username || !email || !password) {
        return res.status(400).json({ error: "Please fill all fields" });
    }

    try {
        // Database me naya user insert karne ki SQL query
        const newUser = await pool.query(
            "INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, created_at",
            [username, email, password]
        );

        res.status(201).json({
            message: "🎉 User registered successfully!",
            user: newUser.rows[0]
        });
    } catch (err) {
        console.error(err.message);
        // Agar username ya email pehle se exist karta ho (Unique constraint error)
        if (err.code === '23505') {
            return res.status(400).json({ error: "Username or Email already exists!" });
        }
        res.status(500).json({ error: "Server error occurred" });
    }
};

// 2. LOGIN USER
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Please provide email and password" });
    }

    try {
        // User ko email ke zariye database me dhoodo
        const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

        if (user.rows.length === 0) {
            return res.status(400).json({ error: "Invalid Credentials (User not found)" });
        }

        // Password match karo (Abhi simple plain text check kar rahe hain)
        if (user.rows[0].password !== password) {
            return res.status(400).json({ error: "Invalid Credentials (Wrong password)" });
        }

        res.status(200).json({
            message: "🔓 Login successful!",
            user: {
                id: user.rows[0].id,
                username: user.rows[0].username,
                email: user.rows[0].email
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error occurred" });
    }
};

// Functions ko export kiya taake routes file inko use kar sakay
module.exports = { registerUser, loginUser };
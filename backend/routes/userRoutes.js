const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// =========================================================================
// 🔄 DYNAMIC CLOUDINARY PATH AUTO-RESOLVER
// =========================================================================
let upload = null;
const possiblePaths = [
    path.join(__dirname, '../config/cloudinary.js'),
    path.join(__dirname, '../../config/cloudinary.js'),
    path.join(process.cwd(), 'config/cloudinary.js'),
    path.join(process.cwd(), 'backend/config/cloudinary.js')
];

let foundPath = null;
for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        foundPath = p;
        break;
    }
}

if (foundPath) {
    console.log(`✅ Cloudinary Config successfully resolved at: ${foundPath}`);
    upload = require(foundPath);
} else {
    const multer = require('multer');
    upload = multer({ storage: multer.memoryStorage() });
}

// Controllers mapping
const controllerPath = path.join(__dirname, '../controllers/userController');
const { 
    toggleLike, 
    toggleFollow, 
    getUserProfile, 
    searchUsers,
    updateBio,      
    updateProfilePic,
    deleteProfilePic 
} = require(controllerPath);

// 🔍 Real-Time Search Endpoint
router.get('/search', searchUsers); 

// 💜 Like Feature Endpoint
router.post('/like', toggleLike); 

// ➕ Follow / Unfollow Feature Endpoint
router.post('/follow', toggleFollow); 

// ✏️ Update Bio Endpoint
router.put('/bio', updateBio);

// 📸 SAFE UPDATE PROFILE PIC (Catches Multer/Cloudinary errors and sends clean JSON)
router.post('/update-dp', (req, res, next) => {
    upload.single('profile_pic')(req, res, (err) => {
        if (err) {
            console.error("🔥 Multer/Cloudinary Upload Error:", err);
            return res.status(400).json({ error: err.message || "Cloudinary upload failed. Please check credentials/file type." });
        }
        next();
    });
}, updateProfilePic);

// 🗑️ Delete Profile Picture Endpoint
router.post('/delete-dp', deleteProfilePic);

// 👤 Dynamic Profile Fetch
router.get('/profile/id/:userId', getUserProfile);
router.get('/profile/:username', getUserProfile); 

module.exports = router;
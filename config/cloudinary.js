const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'candy_social_media',
        // ⚡ CRITICAL: Isse video aur images dono ek sath upload ho sakengi
        resource_type: 'auto', 
        allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'mp4', 'mov', 'webm']
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB Max Limit videos ke liye
});

// =========================================================================
// 👑 UNIVERSAL BULLETPROOF EXPORTS
// =========================================================================
// 1. postRoutes.js ke liye (jo direct default require use karti hai)
module.exports = upload;          

// 2. chatRoutes.js ke liye (jo const { upload } = require(...) destructuring karti hai)
module.exports.upload = upload;   

// 3. Kisi bhi general standard frontend/backend modular fallback ke liye
module.exports.default = upload;
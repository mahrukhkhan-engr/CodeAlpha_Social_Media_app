const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-cbc';
// Ensure the secret is exactly 32 bytes
const SECRET_KEY = crypto.createHash('sha256').update(String(process.env.CHAT_ENCRYPTION_SECRET)).digest('base64').substring(0, 32);
const IV_LENGTH = 16; // For AES, this is always 16

// 1. Encrypt Function
function encrypt(text) {
    if (!text) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// 2. Decrypt Function
function decrypt(text) {
    if (!text) return null;
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        return "[Encrypted/Corrupted Message]";
    }
}

module.exports = { encrypt, decrypt };
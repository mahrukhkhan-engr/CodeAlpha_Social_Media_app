// Backend API Base URL (Tumhara local node server port)
const API_URL = 'http://localhost:5000/api/auth';

// DOM Elements Selection
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const toSignupBtn = document.getElementById('to-signup');
const toLoginBtn = document.getElementById('to-login');
const authSubtitle = document.getElementById('auth-subtitle');
const alertBox = document.getElementById('alert-box');

// ==========================================
// 🔄 1. TOGGLE LOGIN / SIGNUP FORMS
// ==========================================
toSignupBtn.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    authSubtitle.innerText = "Join us today! It only takes a minute.";
    clearAlert();
});

toLoginBtn.addEventListener('click', () => {
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    authSubtitle.innerText = "Connect with friends in our sweet community!";
    clearAlert();
});

// Helper functions for Alerts
function showAlert(message, type) {
    alertBox.innerText = message;
    alertBox.className = `alert alert-${type}`;
    alertBox.classList.remove('hidden');
}

function clearAlert() {
    alertBox.className = 'alert hidden';
    alertBox.innerText = '';
}

// ==========================================
// 📝 2. SIGNUP API INTEGRATION
// ==========================================
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Signup failed');
        }

        showAlert('✨ Account created successfully! Please login.', 'success');
        signupForm.reset();
        
        // Auto switch to login form after 2 seconds
        setTimeout(() => {
            toLoginBtn.click();
        }, 2000);

    } catch (error) {
        showAlert(error.message, 'error');
    }
});

// ==========================================
// 🔓 3. LOGIN API INTEGRATION
// ==========================================
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Invalid credentials');
        }

        // 💾 Save JWT Token aur User Details in Browser Storage
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        showAlert('🔓 Login successful! Redirecting...', 'success');

        // Redirect to Main Feed Page after 1.5 seconds
        setTimeout(() => {
            window.location.href = 'feed.html';
        }, 1500);

    } catch (error) {
        showAlert(error.message, 'error');
    }
});
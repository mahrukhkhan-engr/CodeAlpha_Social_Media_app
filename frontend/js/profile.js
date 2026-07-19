// Backend API Base URLs
const USERS_API_URL = 'https://candy-social-media-app.vercel.app/api/users';
const POSTS_API_URL = 'https://candy-social-media-app.vercel.app/api/posts';

// 🔐 SECURITY CHECK
const token = localStorage.getItem('token');
const currentUserRaw = localStorage.getItem('user');
let currentUser = null;

try { 
    if (currentUserRaw) currentUser = JSON.parse(currentUserRaw); 
} catch (e) { 
    console.error("Error parsing user storage:", e); 
}

if (!token || !currentUser) {
    window.location.href = 'index.html';
}

// URL parameters parsing
const urlParams = new URLSearchParams(window.location.search);
let targetUsername = urlParams.get('username');
let targetUserId = urlParams.get('user_id');

// DOM Elements Selection
const profileAvatar = document.getElementById('profile-avatar');
const ownDpControls = document.getElementById('own-dp-controls');
const dpFileSelector = document.getElementById('dp-file-selector');
const removeDpBtn = document.getElementById('remove-dp-btn');

const profileUsername = document.getElementById('profile-username');
const profileEmail = document.getElementById('profile-email');
const followersCount = document.getElementById('followers-count');
const followingCount = document.getElementById('following-count');
const followBtn = document.getElementById('follow-btn');
const userPostsContainer = document.getElementById('user-posts-container');
const logoutBtn = document.getElementById('logout-btn');

// Bio Components Mapping
const bioTextTarget = document.getElementById('bio-text-target');
const bioEditInput = document.getElementById('bio-edit-input');
const actionEditBio = document.getElementById('action-edit-bio');
const actionSaveBio = document.getElementById('action-save-bio');

// Modal Elements Selection
const followersModal = document.getElementById('followers-list-modal');
const followingModal = document.getElementById('following-list-modal');
const triggerFollowers = document.getElementById('trigger-followers-modal');
const triggerFollowing = document.getElementById('trigger-following-modal');
const closeFollowersBtn = document.getElementById('close-followers-btn');
const closeFollowingBtn = document.getElementById('close-following-btn');
const followersBoxRender = document.getElementById('followers-box-render');
const followingBoxRender = document.getElementById('following-box-render');

// Sync navbar profile link
if (document.getElementById('nav-profile-link') && currentUser.username) {
    document.getElementById('nav-profile-link').href = `profile.html?username=${currentUser.username}`;
}

// Global target states
let resolvedTargetId = null;
let isOwnProfile = false;
let globalProfileDataBackup = null; 

// Apply active UI permissions helper
function applyUIPermissions() {
    if (isOwnProfile) {
        if (ownDpControls) ownDpControls.classList.remove('hidden');
        if (actionEditBio) actionEditBio.classList.remove('hidden');
        if (followBtn) {
            followBtn.classList.add('hidden');
            followBtn.style.display = 'none';
        }
    } else {
        if (ownDpControls) ownDpControls.classList.add('hidden');
        if (actionEditBio) actionEditBio.classList.add('hidden');
        if (actionSaveBio) actionSaveBio.classList.add('hidden');
        if (bioEditInput) bioEditInput.style.display = 'none';
        if (bioTextTarget) bioTextTarget.style.display = 'block';

        if (followBtn) {
            followBtn.classList.remove('hidden');
            followBtn.style.display = 'block';
            if (globalProfileDataBackup?.is_following || globalProfileDataBackup?.isFollowing) {
                followBtn.innerText = '➖ Unfollow';
                followBtn.className = 'btn-logout';
            } else {
                followBtn.innerText = '➕ Follow';
                followBtn.className = 'btn-primary';
            }
        }
    }
}

// ==========================================
// 📥 1. FETCH PROFILE DETAILS FROM BACKEND
// ==========================================
async function fetchProfileDetails() {
    try {
        let fetchUrl = "";
        const currentLoggedInId = currentUser.id || currentUser.user_id;
        
        if (targetUserId) {
            fetchUrl = `${USERS_API_URL}/profile/id/${targetUserId}?current_user_id=${currentLoggedInId}`;
        } else if (targetUsername) {
            fetchUrl = `${USERS_API_URL}/profile/${targetUsername}?current_user_id=${currentLoggedInId}`;
        } else {
            targetUsername = currentUser.username;
            fetchUrl = `${USERS_API_URL}/profile/${currentUser.username}?current_user_id=${currentLoggedInId}`;
        }

        const response = await fetch(fetchUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load profile details');
        }

        globalProfileDataBackup = data; 
        resolvedTargetId = data.user.id; 
        isOwnProfile = (currentUser.username === data.user.username || currentLoggedInId === data.user.id);

        // UI Injection
        if (profileUsername) profileUsername.innerText = `@${data.user.username}`;
        if (profileEmail) profileEmail.innerText = data.user.email || '';
        if (bioTextTarget) bioTextTarget.innerText = data.user.bio || "Hello CandySocial! ✨";
        
        // Dynamic fallback load
        if (profileAvatar) {
            profileAvatar.src = data.user.profile_pic || "https://cdn-icons-png.flaticon.com/512/149/149071.png";
            profileAvatar.onerror = function() {
                this.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
            };
        }

        if (followersCount) followersCount.innerText = data.followers_count !== undefined ? data.followers_count : 0;
        if (followingCount) followingCount.innerText = data.following_count !== undefined ? data.following_count : 0;

        applyUIPermissions();

        if (data.posts) {
            renderUserPosts(data.posts);
        } else {
            fetchUserPosts(data.user.id, data.user.username);
        }

    } catch (error) {
        console.error(error);
        isOwnProfile = (!targetUsername || targetUsername === currentUser.username);
        if (isOwnProfile) {
            if (profileUsername) profileUsername.innerText = `@${currentUser.username}`;
            if (profileEmail) profileEmail.innerText = currentUser.email || '';
            if (bioTextTarget) bioTextTarget.innerText = currentUser.bio || "Hello CandySocial! ✨";
            if (profileAvatar) {
                profileAvatar.src = currentUser.profile_pic || "https://cdn-icons-png.flaticon.com/512/149/149071.png";
                profileAvatar.onerror = function() {
                    this.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
                };
            }
            applyUIPermissions();
            fetchUserPosts(currentUser.id || currentUser.user_id, currentUser.username);
        } else {
            if (userPostsContainer) {
                userPostsContainer.innerHTML = `<div class="loading-text" style="color: red; padding: 20px; text-align: center;">❌ Profile Error: ${error.message}</div>`;
            }
        }
    }
}

// ==========================================
// 📸 2. FETCH SPECIFIC USER'S POSTS 
// ==========================================
async function fetchUserPosts(userId, usernameFallback) {
    try {
        const response = await fetch(`${POSTS_API_URL}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const allPosts = await response.json();
        const nameToMatch = usernameFallback || targetUsername;
        const userPosts = allPosts.filter(post => post.user_id === userId || post.username === nameToMatch);

        renderUserPosts(userPosts);
    } catch (error) {
        if (userPostsContainer) {
            userPostsContainer.innerHTML = `<div class="loading-text" style="color: red; padding: 20px; text-align: center;">❌ Error loading posts.</div>`;
        }
    }
}

function renderUserPosts(posts) {
    if (!userPostsContainer) return;
    if (posts.length === 0) {
        userPostsContainer.innerHTML = '<div class="no-posts-placeholder">📷 No sweet memories shared yet. 🍬</div>';
        return;
    }

    userPostsContainer.innerHTML = '';
    posts.forEach(post => {
        const postCard = document.createElement('div');
        postCard.className = 'card post-card';
        postCard.style.marginTop = '15px';
        
        const postDate = new Date(post.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });

        let mediaHTML = '';
        if (post.image_url) {
            const mediaFiles = String(post.image_url).split(',').map(url => url.trim()).filter(url => url !== '');
            mediaFiles.forEach(mediaItem => {
                const isVideo = mediaItem.toLowerCase().includes('.mp4') || mediaItem.toLowerCase().includes('/video/upload');
                mediaHTML += `<div class="post-media-preview" style="margin-top: 12px; border-radius: 12px; overflow: hidden;">
                    ${isVideo ? 
                        `<video src="${mediaItem}" style="width: 100%; max-height: 350px; object-fit: contain;" controls></video>` : 
                        `<img src="${mediaItem}" style="width: 100%; max-height: 450px; object-fit: contain; border-radius:12px;" alt="Post Media" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'">`
                    }
                </div>`;
            });
        }

        postCard.innerHTML = `
            <div class="post-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span class="post-user" style="font-weight: 700; color: var(--primary-teal, #00ADB5);">👤 @${post.username || targetUsername || currentUser.username}</span>
                <span class="post-time" style="color: var(--text-muted, #736289); font-size: 0.85rem;">${postDate}</span>
            </div>
            <div class="post-content" style="font-size: 1rem; color: var(--text-main, #1A2536); line-height: 1.5; white-space: pre-wrap;">${post.caption || post.content || ''}</div>
            ${mediaHTML}
        `;
        userPostsContainer.appendChild(postCard);
    });
}

// ==========================================
// 🤝 3. FOLLOW / UNFOLLOW INTERACTION
// ==========================================
if (followBtn) {
    followBtn.addEventListener('click', async () => {
        try {
            const currentLoggedInId = currentUser.id || currentUser.user_id;
            const response = await fetch(`${USERS_API_URL}/follow`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    follower_id: currentLoggedInId, 
                    following_id: resolvedTargetId
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Action failed.');
            fetchProfileDetails(); 
        } catch (error) {
            alert(`❌ Action failed: ${error.message}`);
        }
    });
}

// ==========================================
// ✏️ 4. BIO SECTION CONTROLLERS
// ==========================================
if (actionEditBio && actionSaveBio) {
    actionEditBio.addEventListener('click', () => {
        bioEditInput.value = bioTextTarget.innerText === "Hello CandySocial! ✨" ? "" : bioTextTarget.innerText;
        bioTextTarget.style.display = 'none';
        bioEditInput.style.display = 'block';
        bioEditInput.focus();
        actionEditBio.classList.add('hidden');
        actionSaveBio.classList.remove('hidden');
    });

    actionSaveBio.addEventListener('click', async () => {
        const updatedBioText = bioEditInput.value.trim();
        const currentLoggedInId = currentUser.id || currentUser.user_id;

        try {
            const response = await fetch(`${USERS_API_URL}/bio`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    user_id: currentLoggedInId,
                    bio: updatedBioText
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not update profile bio.');

            bioTextTarget.innerText = updatedBioText || "Hello CandySocial! ✨";
            currentUser.bio = updatedBioText;
            localStorage.setItem('user', JSON.stringify(currentUser));

            bioTextTarget.style.display = 'block';
            bioEditInput.style.display = 'none';
            actionEditBio.classList.remove('hidden');
            actionSaveBio.classList.add('hidden');
        } catch (err) {
            alert(`❌ Bio change failed: ${err.message}`);
        }
    });
}

// ==========================================
// 📸 5. PROFILE IMAGE DP OPERATIONS (FIXED Multipart Format)
// ==========================================
if (dpFileSelector) {
    dpFileSelector.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const currentLoggedInId = currentUser.id || currentUser.user_id;
        
        // Strict boundary dynamic handling without 'Content-Type' header overrides
        const formPayload = new FormData();
        formPayload.append("user_id", String(currentLoggedInId));
        formPayload.append("profile_pic", file);

        try {
            profileAvatar.style.opacity = "0.5";
            
            const response = await fetch(`${USERS_API_URL}/update-dp`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}` 
                    // ⚠️ DO NOT add Content-Type: multipart/form-data here, let browser add it with boundary.
                },
                body: formPayload
            });

            const rawText = await response.text();
            let data;
            try {
                data = JSON.parse(rawText);
            } catch (jsonErr) {
                console.error("Non-JSON Server response:", rawText);
                throw new Error("Server did not return valid JSON.");
            }

            if (!response.ok) throw new Error(data.error || 'Failed to upload image.');

            if (data.profile_pic) {
                profileAvatar.src = data.profile_pic;
                currentUser.profile_pic = data.profile_pic;
                localStorage.setItem('user', JSON.stringify(currentUser));
                window.location.reload(); 
            }
        } catch (err) {
            alert(`❌ Upload error: ${err.message}`);
        } finally {
            profileAvatar.style.opacity = "1";
        }
    });
}

if (removeDpBtn) {
    removeDpBtn.addEventListener('click', async () => {
        if (!confirm("Are you sure you want to remove your profile picture?")) return;
        const currentLoggedInId = currentUser.id || currentUser.user_id;

        try {
            const response = await fetch(`${USERS_API_URL}/delete-dp`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ user_id: currentLoggedInId })
            });

            if (!response.ok) throw new Error('Deletion failed.');

            profileAvatar.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
            currentUser.profile_pic = null;
            localStorage.setItem('user', JSON.stringify(currentUser));
            window.location.reload();
        } catch (err) {
            alert(`❌ Removal crash: ${err.message}`);
        }
    });
}

// ==========================================
// 👥 6. MODAL INTERACTIVE POPUPS CONTROLS
// ==========================================
function openModal(modalElement, listData, targetBox, typeTitle) {
    modalElement.style.display = 'flex';
    targetBox.innerHTML = '';

    if (!listData || listData.length === 0) {
        targetBox.innerHTML = `<p style="text-align:center; padding:15px; color:#736289; font-weight:600;">No users in this list yet. 🍬</p>`;
        return;
    }

    listData.forEach(userNode => {
        const row = document.createElement('div');
        row.className = 'user-list-item';
        row.style.cursor = 'pointer';
        
        row.onclick = () => {
            modalElement.style.display = 'none';
            window.location.href = `profile.html?username=${userNode.username}`;
        };

        row.innerHTML = `
            <img src="${userNode.profile_pic || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" alt="Avatar" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'">
            <span style="font-weight: 600; color: var(--text-main, #1A2536);">@${userNode.username}</span>
        `;
        targetBox.appendChild(row);
    });
}

if (triggerFollowers) {
    triggerFollowers.addEventListener('click', () => {
        if (globalProfileDataBackup) {
            openModal(followersModal, globalProfileDataBackup.followers, followersBoxRender, 'Followers');
        }
    });
}

if (triggerFollowing) {
    triggerFollowing.addEventListener('click', () => {
        if (globalProfileDataBackup) {
            openModal(followingModal, globalProfileDataBackup.following, followingBoxRender, 'Following');
        }
    });
}

if (closeFollowersBtn) closeFollowersBtn.onclick = () => followersModal.style.display = 'none';
if (closeFollowingBtn) closeFollowingBtn.onclick = () => followingModal.style.display = 'none';

window.onclick = (event) => {
    if (event.target === followersModal) followersModal.style.display = 'none';
    if (event.target === followingModal) followingModal.style.display = 'none';
};

// ==========================================
// 🚪 7. LOGOUT OPERATION
// ==========================================
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'index.html';
    });
}

// Initialize runtime sequence
fetchProfileDetails();
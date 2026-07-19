const POSTS_API_URL = 'https://candy-social-media-app.vercel.app/api/posts';
const USERS_API_URL = 'https://candy-social-media-app.vercel.app/api/users'; 
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

const postsContainer = document.getElementById('posts-container');
const createPostForm = document.getElementById('create-post-form');
const postContentInput = document.getElementById('post-content');
const logoutBtn = document.getElementById('logout-btn');

const searchInput = document.getElementById('user-search-input');
const searchDropdown = document.getElementById('search-results-dropdown');
const currentLoggedInId = currentUser ? (currentUser.id || currentUser.user_id) : null;

if (document.getElementById('nav-profile-link') && currentUser.username) {
    document.getElementById('nav-profile-link').href = `profile.html?username=${currentUser.username}`;
}

// =========================================================================
// 🔍 INSTA-STYLE LIVE SEARCH (USERNAME & EMAIL) WITH REDIRECTION
// =========================================================================
if (searchInput && searchDropdown) {
    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        if (!query) {
            searchDropdown.innerHTML = '';
            searchDropdown.style.display = 'none';
            return;
        }

        try {
            const response = await fetch(`${USERS_API_URL}/search?query=${encodeURIComponent(query)}&current_user_id=${currentLoggedInId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Search failed');
            const users = await response.json();
            searchDropdown.innerHTML = '';
            searchDropdown.style.display = 'block';

            if (!users || users.length === 0) {
                searchDropdown.innerHTML = `<div class="no-result-text" style="padding: 15px; text-align: center; color: #ff6b6b; font-weight: 600;">❌ No user found</div>`;
                return;
            }

            users.forEach(user => {
                const item = document.createElement('div');
                item.className = 'search-item';
                const avatar = user.profile_pic && user.profile_pic !== 'default_avatar.png' ? user.profile_pic : 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
                item.innerHTML = `
                    <div class="search-user-info" style="cursor:pointer; display: flex; align-items: center; gap: 10px; flex: 1;">
                        <img src="${avatar}" class="search-avatar" alt="avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                        <div style="display: flex; flex-direction: column;">
                            <span class="search-username" style="font-weight: bold;">@${user.username}</span>
                            <span style="font-size: 0.75rem; color: #888;">${user.email || ''}</span>
                        </div>
                    </div>
                    <button class="btn-follow-toggle ${user.is_following ? 'btn-unfollow' : 'btn-follow'}" data-userid="${user.id}">
                        ${user.is_following ? 'Following' : 'Follow'}
                    </button>
                `;

                item.querySelector('.search-user-info').addEventListener('click', () => {
                    window.location.href = `profile.html?username=${user.username}`;
                });
                searchDropdown.appendChild(item);
            });

            document.querySelectorAll('.btn-follow-toggle').forEach(btn =>
                btn.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    const followingId = btn.getAttribute('data-userid');
                    await handleFollowToggle(followingId, btn);
                })
            );
        } catch (err) {
            console.error("Live Search Handling Error:", err);
            searchDropdown.innerHTML = `<div class="no-result-text" style="padding: 15px; text-align: center; color: #ff6b6b; font-weight: 600;">❌ No user found</div>`;
        }
    });
}

document.addEventListener('click', (e) => {
    if (searchInput && !searchInput.contains(e.target) && searchDropdown && !searchDropdown.contains(e.target)) {
        searchDropdown.style.display = 'none';
    }
});

async function handleFollowToggle(followingId, buttonElement) {
    try {
        const response = await fetch(`${USERS_API_URL}/follow`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ follower_id: currentLoggedInId, following_id: followingId })
        });
        if (!response.ok) throw new Error('Follow toggle failed');
        const data = await response.json();
        if (data.action === 'followed') {
            buttonElement.innerText = 'Following';
            buttonElement.className = 'btn-follow-toggle btn-unfollow';
        } else {
            buttonElement.innerText = 'Follow';
            buttonElement.className = 'btn-follow-toggle btn-follow';
        }
    } catch (err) {
        alert(`❌ Action failed: ${err.message}`);
    }
}

// =========================================================================
// ❤️ REAL-TIME LIKE TOGGLE SYSTEM
// =========================================================================
window.toggleLikeUI = async function(postId, btnElement) {
    try {
        const response = await fetch(`${USERS_API_URL}/like`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ user_id: currentLoggedInId, post_id: postId })
        });
        if (!response.ok) throw new Error('Like execution failed');
        const data = await response.json();
        
        const countSpan = document.getElementById(`likes-count-${postId}`);
        let currentCount = parseInt(countSpan.innerText, 10) || 0;

        if (data.message.includes('liked successfully')) {
            btnElement.innerHTML = '❤️ Liked';
            btnElement.classList.add('liked');
            currentCount += 1;
        } else {
            btnElement.innerHTML = '🤍 Like';
            btnElement.classList.remove('liked');
            currentCount = Math.max(0, currentCount - 1);
        }
        countSpan.innerText = currentCount;
    } catch (err) {
        console.error("Like Action Error:", err.message);
    }
};

// SHOW LIKES LIST POPUP MODAL
window.showLikesModal = async function(postId) {
    try {
        const response = await fetch(`${POSTS_API_URL}/${postId}/likes`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Could not fetch likes list');
        const users = await response.json();

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.id = 'likes-modal';

        let usersHTML = '';
        if (users.length === 0) {
            usersHTML = '<p style="text-align:center; color:#888; padding:15px;">No likes yet 🤍</p>';
        } else {
            users.forEach(u => {
                const avatar = u.profile_pic && u.profile_pic !== 'default_avatar.png' ? u.profile_pic : 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
                usersHTML += `
                    <div class="user-list-item" style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <img src="${avatar}" class="modal-avatar" alt="profile_pic" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
                        <a href="profile.html?username=${u.username}" class="modal-username" style="font-weight:bold; color:var(--text-main); text-decoration:none;">@${u.username}</a>
                    </div>
                `;
            });
        }

        modalOverlay.innerHTML = `
            <div class="modal-content" style="background:white; padding:20px; border-radius:12px; max-width:400px; margin:100px auto; position:relative;">
                <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:15px;">
                    <h3 style="margin:0;">Likes ❤️</h3>
                    <button class="close-modal-btn" onclick="document.getElementById('likes-modal').remove()" style="background:none; border:none; font-size:1.5rem; cursor:pointer;">&times;</button>
                </div>
                <div class="modal-body">
                    ${usersHTML}
                </div>
            </div>
        `;
        document.body.appendChild(modalOverlay);
    } catch (err) {
        console.error("Error showing likes modal:", err);
    }
};

// =========================================================================
// 💬 INTERACTIVE COMMENTS POPUP MODAL
// =========================================================================
window.showCommentsModal = async function(postId) {
    try {
        const response = await fetch(`${POSTS_API_URL}/${postId}/comments`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to load comments');
        const comments = await response.json();

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.id = 'comments-modal';

        let commentsHTML = `<div class="comments-list-wrapper" id="modal-comments-list-${postId}" style="max-height:250px; overflow-y:auto; margin-bottom:15px;">`;
        
        if (comments.length === 0) {
            commentsHTML += `<p class="no-comments-msg" style="text-align:center; color:#888; padding:15px;">No sweet comments yet. Be the first! 🍬</p>`;
        } else {
            comments.forEach(c => {
                const avatar = c.profile_pic && c.profile_pic !== 'default_avatar.png' ? c.profile_pic : 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
                let delBtn = '';
                if (c.user_id === currentLoggedInId) {
                    delBtn = `<button onclick="deleteCommentUI(${c.id}, ${postId}, this)" style="background:none; border:none; color:#ff5c5c; cursor:pointer; font-size:0.9rem; padding:0 5px;">🗑️</button>`;
                }
                commentsHTML += `
                    <div class="user-list-item" id="comment-row-${c.id}" style="display:flex; align-items:center; gap:10px; margin-bottom:12px; justify-content:space-between;">
                        <div style="display:flex; align-items:center; gap:10px; flex:1;">
                            <img src="${avatar}" class="modal-avatar" alt="pfp" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
                            <div style="display:flex; flex-direction:column;">
                                <a href="profile.html?username=${c.username}" class="modal-username" style="font-size:0.85rem; font-weight:bold; color:var(--text-main); text-decoration:none;">@${c.username}</a>
                                <span style="font-size:0.9rem; color:#333; margin-top:2px;">${c.comment_text}</span>
                            </div>
                        </div>
                        ${delBtn}
                    </div>
                `;
            });
        }
        commentsHTML += `</div>`;

        modalOverlay.innerHTML = `
            <div class="modal-content" style="background:white; padding:20px; border-radius:12px; max-width:420px; margin:100px auto; position:relative; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:15px;">
                    <h3 style="margin:0;">Comments 💬</h3>
                    <button class="close-modal-btn" onclick="document.getElementById('comments-modal').remove()" style="background:none; border:none; font-size:1.5rem; cursor:pointer;">&times;</button>
                </div>
                <div class="modal-body">
                    ${commentsHTML}
                    <div class="comment-input-form-row" style="display:flex; gap:10px; border-top:1px solid #eee; padding-top:12px;">
                        <input type="text" id="modal-new-comment-input" style="flex:1; padding:10px 14px; border:1px solid #ddd; border-radius:20px; outline:none;" placeholder="Write a sweet comment...">
                        <button onclick="submitCommentUI(${postId})" class="btn-primary" style="padding:10px 18px; border-radius:20px; font-size:0.9rem; background:var(--primary-teal); color:white; border:none; cursor:pointer;">Send</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalOverlay);
    } catch (err) {
        console.error("Error triggering comments modal framework:", err);
    }
};

// SUBMIT NEW COMMENT HANDLER
window.submitCommentUI = async function(postId) {
    const inputField = document.getElementById('modal-new-comment-input');
    const commentText = inputField.value.trim();
    if (!commentText) return;

    try {
        const response = await fetch(`${POSTS_API_URL}/${postId}/comment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ user_id: currentLoggedInId, comment_text: commentText })
        });
        if (!response.ok) throw new Error('Failed to post comment');
        const data = await response.json();
        
        const listContainer = document.getElementById(`modal-comments-list-${postId}`);
        const noMsg = listContainer.querySelector('.no-comments-msg');
        if (noMsg) noMsg.remove();

        const avatar = data.comment.profile_pic && data.comment.profile_pic !== 'default_avatar.png' ? data.comment.profile_pic : 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        const newRow = document.createElement('div');
        newRow.className = 'user-list-item';
        newRow.id = `comment-row-${data.comment.id}`;
        newRow.style = "display:flex; align-items:center; gap:10px; margin-bottom:12px; justify-content:space-between;";
        newRow.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; flex:1;">
                <img src="${avatar}" class="modal-avatar" alt="pfp" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
                <div style="display:flex; flex-direction:column;">
                    <a href="profile.html?username=${data.comment.username}" class="modal-username" style="font-size:0.85rem; font-weight:bold; color:var(--text-main); text-decoration:none;">@${data.comment.username}</a>
                    <span style="font-size:0.9rem; color:#333; margin-top:2px;">${data.comment.comment_text}</span>
                </div>
            </div>
            <button onclick="deleteCommentUI(${data.comment.id}, ${postId}, this)" style="background:none; border:none; color:#ff5c5c; cursor:pointer; font-size:0.9rem; padding:0 5px;">🗑️</button>
        `;
        listContainer.appendChild(newRow);
        inputField.value = '';

        // Feed Counter Increment Sync
        const textBtn = document.getElementById(`comment-trigger-btn-${postId}`);
        if (textBtn) {
            let match = textBtn.innerText.match(/\d+/);
            let updatedVal = match ? parseInt(match[0], 10) + 1 : 1;
            textBtn.innerText = `💬 Comment (${updatedVal})`;
        }
    } catch (err) {
        alert("❌ Error posting comment: " + err.message);
    }
};

// DELETE SPECIFIC COMMENT HANDLER
window.deleteCommentUI = async function(commentId, postId, btnElement) {
    if (!confirm("Are you sure you want to delete your comment? 🗑️")) return;
    try {
        const response = await fetch(`${POSTS_API_URL}/comment/${commentId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ user_id: currentLoggedInId })
        });
        if (!response.ok) throw new Error('Authorization rejected or deletion error');
        
        document.getElementById(`comment-row-${commentId}`).remove();

        // Feed Counter Decrement Sync
        const textBtn = document.getElementById(`comment-trigger-btn-${postId}`);
        if (textBtn) {
            let match = textBtn.innerText.match(/\d+/);
            let updatedVal = match ? Math.max(0, parseInt(match[0], 10) - 1) : 0;
            textBtn.innerText = `💬 Comment (${updatedVal})`;
        }
    } catch (err) {
        alert("❌ Deletion failed: " + err.message);
    }
};

// =========================================================================
// 📰 HOME FEED CORE LOGIC
// =========================================================================
async function fetchPosts() {
    try {
        const response = await fetch(`${POSTS_API_URL}?current_user_id=${currentLoggedInId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch posts');
        const posts = await response.json();
        renderPosts(posts);
    } catch (error) {
        if (postsContainer) postsContainer.innerHTML = `<div style="color:red; padding:20px;">❌ Error: ${error.message}</div>`;
    }
}

function renderPosts(posts) {
    if (!postsContainer) return;
    if (posts.length === 0) {
        postsContainer.innerHTML = '<div class="loading-text">No sweet posts yet.</div>';
        return;
    }
    postsContainer.innerHTML = '';
    posts.forEach((post, postIndex) => {
        const postCard = document.createElement('div');
        postCard.className = 'post-card';
        const postDate = new Date(post.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        let mediaFiles = [];
        if (post.image_url) {
            mediaFiles = String(post.image_url).split(',').map(url => url.trim()).filter(url => url !== '');
        }

        let mediaHTML = '';
        if (mediaFiles.length > 0) {
            mediaHTML = `<div class="slider-container" style="position:relative; overflow:hidden; border-radius:12px; margin-top:10px; background:#000; min-height:250px; max-height:400px; display:flex; align-items:center; justify-content:center;">`;
            mediaFiles.forEach((url, i) => {
                const trimmedUrl = url.trim();
                const isVideo = trimmedUrl.toLowerCase().includes('.mp4') || trimmedUrl.toLowerCase().includes('.mov') || trimmedUrl.toLowerCase().includes('.webm');
                mediaHTML += `
                    <div class="slide-${postIndex}" style="display: ${i === 0 ? 'block' : 'none'}; width:100%; text-align:center;">
                        ${isVideo ? `<video src="${trimmedUrl}" controls style="width:100%; max-height:400px; object-fit:contain;"></video>` : `<img src="${trimmedUrl}" style="width:100%; max-height:400px; object-fit:contain;" alt="Candy Media">`}
                    </div>`;
            });
            if (mediaFiles.length > 1) {
                mediaHTML += `
                    <button type="button" onclick="moveSlide(${postIndex}, -1)" style="position:absolute; top:50%; left:10px; transform:translateY(-50%); background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:50%; width:35px; height:35px; cursor:pointer; font-weight:bold; z-index:10; font-size:1.1rem;">❮</button>
                    <button type="button" onclick="moveSlide(${postIndex}, 1)" style="position:absolute; top:50%; right:10px; transform:translateY(-50%); background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:50%; width:35px; height:35px; cursor:pointer; font-weight:bold; z-index:10; font-size:1.1rem;">❯</button>
                    <div style="position:absolute; bottom:12px; width:100%; text-align:center; color:#fff; text-shadow:1px 1px 4px #000; font-size:0.85rem; font-weight:500; z-index:10;">
                        <span style="background:rgba(0,0,0,0.5); padding:3px 10px; border-radius:12px;">Slide <span id="slide-idx-${postIndex}">1</span> of ${mediaFiles.length}</span>
                    </div>`;
            }
            mediaHTML += `</div>`;
        }

        let deleteBtnHTML = '';
        if (currentLoggedInId && post.user_id === currentLoggedInId) {
            deleteBtnHTML = `<button onclick="deletePostUI(${post.id})" style="background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:1.1rem;">🗑️</button>`;
        }

        const isLikedClass = post.is_liked ? 'liked' : '';
        const isLikedText = post.is_liked ? '❤️ Liked' : '🤍 Like';

        postCard.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 5px 0;">
                <span style="font-weight:bold; color: var(--text-main); cursor:pointer;" onclick="window.location.href='profile.html?username=${post.username}'">👤 @${post.username}</span>
                <div style="display:flex; gap:10px; align-items:center;">
                    <span style="font-size:0.8rem; color:#888;">${postDate}</span>
                    ${deleteBtnHTML}
                </div>
            </div>
            <div style="margin-top:8px; color: var(--text-main); font-size:0.95rem;">${post.content || post.caption || ''}</div>
            ${mediaHTML}
            
            <div style="margin-top: 10px; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); cursor: pointer;" onclick="showLikesModal(${post.id})">
                Liked by <span id="likes-count-${post.id}" style="color: var(--primary-teal); font-weight: bold;">${post.total_likes || 0}</span> users
            </div>

            <div style="margin-top:8px; display:flex; gap:15px; border-top:1px solid #f1f1f1; padding-top:10px;">
                <button class="action-btn ${isLikedClass}" onclick="toggleLikeUI(${post.id}, this)">${isLikedText}</button>
                <button class="action-btn" id="comment-trigger-btn-${post.id}" onclick="showCommentsModal(${post.id})">💬 Comment (${post.total_comments || 0})</button>
            </div>
        `;
        postsContainer.appendChild(postCard);
    });
}

window.moveSlide = function(postIndex, direction) {
    const slides = document.querySelectorAll(`.slide-${postIndex}`);
    if (slides.length <= 1) return;
    let activeIdx = 0;
    slides.forEach((slide, idx) => {
        if (slide.style.display === 'block') activeIdx = idx;
    });
    slides[activeIdx].style.display = 'none';
    let newIdx = activeIdx + direction;
    if (newIdx >= slides.length) newIdx = 0;
    if (newIdx < 0) newIdx = slides.length - 1;
    slides[newIdx].style.display = 'block';
    const counterEl = document.getElementById(`slide-idx-${postIndex}`);
    if (counterEl) counterEl.innerText = newIdx + 1;
};

if (createPostForm) {
    createPostForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = postContentInput.value.trim();
        const mediaFileInput = document.getElementById('post-media');
        const files = mediaFileInput ? mediaFileInput.files : [];
        const userId = currentLoggedInId;

        if (!userId) {
            alert("❌ Session error: Please logout and login again!");
            return;
        }
        if (!content && files.length === 0) {
            alert("❌ Please write something or select photos/videos to post!");
            return;
        }

        const formData = new FormData();
        formData.append('user_id', String(userId));
        formData.append('content', content);
        formData.append('caption', content);

        for (let i = 0; i < files.length; i++) {
            formData.append('media', files[i]);
        }

        try {
            const response = await fetch(POSTS_API_URL, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const rawText = await response.text();
                console.error("Server raw layout error:", rawText);
                throw new Error("Backend server encountered an upload crash. Check node terminal logs!");
            }

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Upload failed');
            postContentInput.value = '';
            if (mediaFileInput) mediaFileInput.value = '';
            fetchPosts();
        } catch (error) {
            alert(`❌ Post failed: ${error.message}`);
        }
    });
}

window.deletePostUI = async function(postId) {
    if (!confirm("Are you sure you want to delete this post? 🍬")) return;
    try {
        await fetch(`${POSTS_API_URL}/${postId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ user_id: currentLoggedInId })
        });
        fetchPosts();
    } catch (error) { alert(error.message); }
};

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => { 
        localStorage.clear();
        window.location.href = 'index.html'; 
    });
}

fetchPosts();
// =========================================================================
// 🌐 CONFIGURATION & INITIALIZATION
// =========================================================================
const BACKEND_URL = 'http://localhost:5000';
const socket = io(BACKEND_URL);

const token = localStorage.getItem('token');
const currentUserRaw = localStorage.getItem('user');
let currentUser = null;

try {
    if (currentUserRaw) currentUser = JSON.parse(currentUserRaw);
} catch (e) {
    console.error("Error parsing current user:", e);
}

// Session Validation
if (!token || !currentUser) {
    window.location.href = 'index.html';
}

// DOM Elements
const usersContainer = document.getElementById('users-container');
const activeChatHeader = document.getElementById('active-chat-header');
const messagesContainer = document.getElementById('messages-container');
const chatForm = document.getElementById('chat-form');
const messageTextInput = document.getElementById('message-text-input');
const attachBtn = document.getElementById('attach-btn');
const mediaInput = document.getElementById('media-input');
const micBtn = document.getElementById('mic-btn');

let activeConversationId = null;
let activeReceiverId = null;
let mediaRecorder = null;
let audioChunks = [];

const currentUserId = currentUser.id || currentUser.user_id;

// =========================================================================
// 👤 1. LOAD ALL USERS IN SIDEBAR
// =========================================================================
async function loadUsers() {
    try {
        // 👑 CHANGED URL: Ab yeh specific chat users ka endpoint call karega
        const response = await fetch(`${BACKEND_URL}/api/chats/users/all`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Failed to load friends");
        const users = await response.json();

        usersContainer.innerHTML = '';
        
        // Apne aap ko list se filter out kar rahay hain
        const friends = users.filter(u => u.id !== currentUserId);

        if (friends.length === 0) {
            usersContainer.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">No sweet friends found. ✨</div>';
            return;
        }

        friends.forEach(user => {
            const userEl = document.createElement('div');
            userEl.className = 'user-item';
            userEl.id = `user-item-${user.id}`;
            userEl.innerHTML = `
                <img src="${user.profile_pic && user.profile_pic !== 'default_avatar.png' ? user.profile_pic : 'default_avatar.png'}" class="user-avatar" alt="avatar">
                <div><strong>@${user.username}</strong></div>
            `;
            userEl.addEventListener('click', () => openChatRoom(user));
            usersContainer.appendChild(userEl);
        });
    } catch (err) {
        usersContainer.innerHTML = `<div style="color:red;padding:10px;">❌ Error: ${err.message}</div>`;
    }
}
// =========================================================================
// 🔒 2. OPEN SECURE CHAT ROOM
// =========================================================================
async function openChatRoom(receiver) {
    activeReceiverId = receiver.id;
    activeChatHeader.innerHTML = `💬 Chatting with <strong>@${receiver.username}</strong> <span style="font-size:0.8rem;color:#27ae60;margin-left:10px;">● Secure Connection</span>`;
    
    // Active class highlighted handle
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`user-item-${receiver.id}`).classList.add('active');

    try {
        // Backend se conversation index dhoundna ya create karna
        const res = await fetch(`${BACKEND_URL}/api/chats/conversation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ user_id: currentUserId, receiver_id: receiver.id })
        });
        const conversation = await res.json();
        activeConversationId = conversation.id;

        // Socket.io room join activation trigger
        socket.emit('join_room', activeConversationId);

        // Form controls un-hide setup
        chatForm.style.display = 'flex';

        // Load History Stream
        loadChatHistory(activeConversationId);

    } catch (err) {
        alert("Could not initialize secure pipeline: " + err.message);
    }
}

// =========================================================================
// 📥 3. LOAD & RENDER DECRYPTED MESSAGES
// =========================================================================
async function loadChatHistory(convId) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/chats/messages/${convId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const messages = await res.json();

        messagesContainer.innerHTML = '';
        if (messages.length === 0) {
            messagesContainer.innerHTML = '<div style="text-align:center;color:#aaa;margin-top:50px;">🔒 This chat is encrypted. Start messaging safely!</div>';
            return;
        }

        messages.forEach(msg => appendMessageBubble(msg));
        scrollToBottom();
    } catch (err) {
        messagesContainer.innerHTML = `<div style="color:red;">Error loading secure nodes.</div>`;
    }
}

function appendMessageBubble(msg) {
    const bubbleWrapper = document.createElement('div');
    bubbleWrapper.className = `msg-wrapper ${msg.sender_id === currentUserId ? 'sent-wrapper' : 'received-wrapper'}`;
    bubbleWrapper.id = `msg-block-${msg.id}`;
    bubbleWrapper.style.display = 'flex';
    bubbleWrapper.style.flexDirection = 'column';
    bubbleWrapper.style.alignItems = msg.sender_id === currentUserId ? 'flex-end' : 'flex-start';

    const bubble = document.createElement('div');
    bubble.className = `msg-bubble ${msg.sender_id === currentUserId ? 'msg-sent' : 'msg-received'}`;
    bubble.style.position = 'relative';

    // Core content renderer block
    if (msg.message_type === 'text') {
        bubble.innerText = msg.message_text;
    } else if (msg.message_type === 'image') {
        bubble.innerHTML = `<img src="${msg.file_url}" style="max-width:200px; border-radius:10px; display:block;" alt="Sent Image">`;
    } else if (msg.message_type === 'video') {
        bubble.innerHTML = `<video src="${msg.file_url}" controls style="max-width:240px; border-radius:10px; display:block;"></video>`;
    } else if (msg.message_type === 'audio') {
        bubble.innerHTML = `<audio src="${msg.file_url}" controls style="max-width:240px; display:block;"></audio>`;
    }

    bubbleWrapper.appendChild(bubble);

    // 👑 DELETE FOR EVERYONE BUTTON (Sirf humare bheje huye messages par dikhay ga)
    if (msg.sender_id === currentUserId) {
        const deleteBtn = document.createElement('span');
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.style.cssText = 'font-size: 0.75rem; cursor: pointer; margin-top: 2px; opacity: 0.6; transition: 0.2s;';
        deleteBtn.title = 'Delete for everyone';
        deleteBtn.addEventListener('mouseover', () => deleteBtn.style.opacity = '1');
        deleteBtn.addEventListener('mouseout', () => deleteBtn.style.opacity = '0.6');
        
        deleteBtn.addEventListener('click', () => deleteMessageFromServer(msg.id, activeConversationId));
        bubbleWrapper.appendChild(deleteBtn);
    }

    messagesContainer.appendChild(bubbleWrapper);
    scrollToBottom();
}

// 🚀 API CALL TO DELETE MESSAGE & TRIGGER SOCKET
async function deleteMessageFromServer(messageId, conversationId) {
    if (!confirm("Are you sure you want to delete this message for everyone? 🗑️")) return;

    try {
        const res = await fetch(`${BACKEND_URL}/api/chats/message/${messageId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ sender_id: currentUserId })
        });
        const data = await res.json();

        if (data.success) {
            // 1. Apni screen se delete karo
            const element = document.getElementById(`msg-block-${messageId}`);
            if (element) element.remove();

            // 2. Live socket message bhejo taake samne wale ki screen se bhi uda de
            socket.emit('delete_live_message', { conversation_id: conversationId, message_id: messageId });
        }
    } catch (err) {
        console.error("Deletion handshake failed:", err);
    }
}
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// =========================================================================
// 📤 4. SEND TEXT MESSAGE & SIGNAL SOCKET
// =========================================================================
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = messageTextInput.value.trim();
    if (!text || !activeConversationId) return;

    messageTextInput.value = '';

    const payload = {
        conversation_id: activeConversationId,
        sender_id: currentUserId,
        message_type: 'text',
        message_text: text
    };

    try {
        const res = await fetch(`${BACKEND_URL}/api/chats/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const savedMsg = await res.json();

        // Local UI layout push
        appendMessageBubble(savedMsg);

        // Live Socket.io global node synchronization broad stream
        socket.emit('send_live_message', savedMsg);

    } catch (err) {
        console.error("Failed to sync text node:", err);
    }
});

// =========================================================================
// 📎 5. ATTACH MEDIA NODES (IMAGES/VIDEOS)
// =========================================================================
attachBtn.addEventListener('click', () => mediaInput.click());

mediaInput.addEventListener('change', async () => {
    if (mediaInput.files.length === 0) return;
    const file = mediaInput.files[0];
    
    // Auto detection check type status
    let type = 'image';
    if (file.type.includes('video')) type = 'video';

    const formData = new FormData();
    formData.append('conversation_id', activeConversationId);
    formData.append('sender_id', currentUserId);
    formData.append('message_type', type);
    formData.append('media', file);

    try {
        activeChatHeader.innerText = "⏳ Uploading media files to secure clouds...";
        const res = await fetch(`${BACKEND_URL}/api/chats/message`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const savedMsg = await res.json();
        
        // Reset inputs & titles
        mediaInput.value = '';
        activeChatHeader.innerHTML = `💬 Chatting with secure connection`;

        appendMessageBubble(savedMsg);
        socket.emit('send_live_message', savedMsg);
    } catch (err) {
        alert("Media cloud handshake crashed.");
    }
});

// =========================================================================
// 🎙️ 6. VOICE NOTE RECORDER UTILITY
// =========================================================================
micBtn.addEventListener('click', async () => {
    if (!mediaRecorder) {
        // Recording Start Logic Setup
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => { audioChunks.push(e.data); };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioFile = new File([audioBlob], "voice_note.webm", { type: 'audio/webm' });

                const formData = new FormData();
                formData.append('conversation_id', activeConversationId);
                formData.append('sender_id', currentUserId);
                formData.append('message_type', 'audio');
                formData.append('media', audioFile);

                activeChatHeader.innerText = "⏳ Uploading voice message...";
                const res = await fetch(`${BACKEND_URL}/api/chats/message`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const savedMsg = await res.json();

                appendMessageBubble(savedMsg);
                socket.emit('send_live_message', savedMsg);
                activeChatHeader.innerHTML = `💬 Chatting with secure connection`;
            };

            mediaRecorder.start();
            micBtn.innerText = '🛑'; // Recording indicator status icon change
            micBtn.style.color = 'red';
        } catch (err) {
            alert("Microphone permission denied.");
        }
    } else {
        // Recording Stop Logic Trigger
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop()); // Turn off hardware mic completely
        mediaRecorder = null;
        micBtn.innerText = '🎙️';
        micBtn.style.color = '';
    }
});

// =========================================================================
// ⚡ 7. LIVE SOCKET INCOMING HOOK LISTENERS
// =========================================================================
socket.on('receive_live_message', (data) => {
    // Sirf tabhi screen par render karein agar usi context ka chat room active hai
    if (activeConversationId && data.conversation_id === activeConversationId) {
        appendMessageBubble(data);
    }
});

// Live Socket deletion receiver hook
socket.on('receive_deleted_message', (data) => {
    if (activeConversationId && data.conversation_id === activeConversationId) {
        const element = document.getElementById(`msg-block-${data.message_id}`);
        if (element) {
            element.remove(); // Samne wale ki screen se instantly vanish!
        }
    }
});

// Run execution mapping block load trigger
loadUsers();
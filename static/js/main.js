const API_URL = ""; 
let currentUser = null;
let token = localStorage.getItem("token");
let activeChatUserId = null;
let socket = null;

// Initialization
document.addEventListener("DOMContentLoaded", () => {
    if (token) {
        // Validate token or just try to load users
        // For MVP, we decode token to get user info
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            currentUser = { id: payload.id, username: payload.sub };
            showScreen("chat");
            loadUsers();
            connectWebSocket();
            document.getElementById("current-user-name").textContent = currentUser.username;
            const avatar = document.getElementById("current-user-avatar");
            avatar.textContent = currentUser.username[0].toUpperCase();
            avatar.className = `avatar ${getAvatarColor(currentUser.username)}`;
        } catch (e) {
            logout();
        }
    } else {
        showScreen("auth");
    }
});

// Auth Logic
function showAuthTab(tab) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));
    
    if (tab === 'login') {
        document.querySelector(".tab-btn:first-child").classList.add("active");
        document.getElementById("login-form").classList.add("active");
    } else {
        document.querySelector(".tab-btn:last-child").classList.add("active");
        document.getElementById("register-form").classList.add("active");
    }
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        
        if (!response.ok) throw new Error("Login failed");
        
        const data = await response.json();
        token = data.access_token;
        localStorage.setItem("token", token);
        currentUser = { id: data.user_id, username: data.username };
        
        showScreen("chat");
        loadUsers();
        connectWebSocket();
        document.getElementById("current-user-name").textContent = currentUser.username;
        const avatar = document.getElementById("current-user-avatar");
        avatar.textContent = currentUser.username[0].toUpperCase();
        avatar.className = `avatar ${getAvatarColor(currentUser.username)}`;
    } catch (err) {
        alert(err.message);
    }
});

document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("register-username").value;
    const password = document.getElementById("register-password").value;
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        
        if (!response.ok) throw new Error("Registration failed");
        
        const data = await response.json();
        token = data.access_token;
        localStorage.setItem("token", token);
        currentUser = { id: data.user_id, username: data.username };
        
        showScreen("chat");
        loadUsers();
        connectWebSocket();
        document.getElementById("current-user-name").textContent = currentUser.username;
        const avatar = document.getElementById("current-user-avatar");
        avatar.textContent = currentUser.username[0].toUpperCase();
        avatar.className = `avatar ${getAvatarColor(currentUser.username)}`;
    } catch (err) {
        alert(err.message);
    }
});

document.getElementById("logout-btn").addEventListener("click", logout);

function logout() {
    localStorage.removeItem("token");
    token = null;
    currentUser = null;
    if (socket) socket.close();
    showScreen("auth");
}

function showScreen(screenName) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById(`${screenName}-screen`).classList.add("active");
}

// User List
async function loadUsers() {
    try {
        const response = await fetch(`${API_URL}/users/`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const users = await response.json();
        const usersList = document.getElementById("users-list");
        usersList.innerHTML = "";
        
        users.forEach(user => {
            // Don't show myself in the list (optional, but good practice)
            if (user.id === currentUser.id) return;

            const el = document.createElement("div");
            el.className = "user-item";
            el.dataset.userId = user.id;
            const colorClass = getAvatarColor(user.username);
            
            el.innerHTML = `
                <div class="avatar ${colorClass}">${user.username[0].toUpperCase()}</div>
                <div class="user-info">
                    <div class="user-name">${user.username}</div>
                    <div class="user-status">online</div>
                </div>
            `;
            el.onclick = () => selectUser(user);
            usersList.appendChild(el);
        });
    } catch (err) {
        console.error("Failed to load users", err);
    }
}

function getAvatarColor(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash % 6) + 1; // 1 to 6
    return `color-${colorIndex}`;
}

// Chat Logic
async function selectUser(user) {
    activeChatUserId = user.id;
    
    // Highlight active user
    document.querySelectorAll(".user-item").forEach(el => el.classList.remove("active"));
    const activeEl = document.querySelector(`.user-item[data-user-id="${user.id}"]`);
    if (activeEl) activeEl.classList.add("active");

    document.getElementById("chat-header").style.display = "flex";
    document.getElementById("input-area").style.display = "flex";
    document.getElementById("chat-user-name").textContent = user.username;
    
    const avatar = document.getElementById("chat-user-avatar");
    avatar.textContent = user.username[0].toUpperCase();
    // Reset classes and add new color
    avatar.className = `avatar ${getAvatarColor(user.username)}`;
    
    // Load history
    const response = await fetch(`${API_URL}/chat/history/${user.id}`, {
        headers: { "Authorization": `Bearer ${token}` }
    });
    const messages = await response.json();
    const container = document.getElementById("messages-container");
    container.innerHTML = "";
    messages.forEach(msg => renderMessage(msg));
    scrollToBottom();
}

function connectWebSocket() {
    if (socket) socket.close();
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/chat/ws/${currentUser.id}?token=${token}`;
    socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
        console.log("WebSocket connected");
    };
    
    socket.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        console.log("Received:", msg);
        // Only show if it belongs to current chat or if I sent it
        if (activeChatUserId && (msg.sender_id === activeChatUserId || (msg.sender_id === currentUser.id && msg.receiver_id === activeChatUserId))) {
            renderMessage(msg);
            scrollToBottom();
        }
    };
    
    socket.onclose = () => {
        console.log("WebSocket disconnected");
    };
}

document.getElementById("send-btn").addEventListener("click", sendMessage);
document.getElementById("message-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
});

function sendMessage() {
    const input = document.getElementById("message-input");
    const content = input.value.trim();
    if (!content) return;
    
    if (socket && socket.readyState === WebSocket.OPEN) {
        const msg = {
            receiver_id: activeChatUserId,
            content: content,
            media_url: null,
            media_type: null
        };
        socket.send(JSON.stringify(msg));
        input.value = "";
    }
}

function renderMessage(msg) {
    const container = document.getElementById("messages-container");
    const div = document.createElement("div");
    const isMine = msg.sender_id === currentUser.id;
    div.className = `message ${isMine ? "sent" : "received"}`;
    
    let contentHtml = "";
    if (msg.media_url) {
        if (msg.media_type.startsWith("image/")) {
            contentHtml += `<div class="media-content"><img src="${msg.media_url}" alt="Image"></div>`;
        } else if (msg.media_type.startsWith("video/")) {
             contentHtml += `<div class="media-content"><video controls src="${msg.media_url}"></video></div>`;
        } else if (msg.media_type.startsWith("audio/")) {
             contentHtml += `<div class="media-content"><audio controls src="${msg.media_url}"></audio></div>`;
        } else {
             contentHtml += `<div class="media-content"><a href="${msg.media_url}" target="_blank">File</a></div>`;
        }
    }
    
    if (msg.content) {
        contentHtml += `<div>${msg.content}</div>`;
    }
    
    const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    contentHtml += `<div class="message-time">${time}</div>`;
    
    div.innerHTML = contentHtml;
    container.appendChild(div);
}

function scrollToBottom() {
    const container = document.getElementById("messages-container");
    container.scrollTop = container.scrollHeight;
}

// File Upload
const fileInput = document.getElementById("file-input");
document.getElementById("attach-btn").addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
        const response = await fetch(`${API_URL}/chat/upload`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
            body: formData
        });
        
        if (!response.ok) throw new Error("Upload failed");
        
        const data = await response.json();
        
        // Send message with attachment via WebSocket
        if (socket && socket.readyState === WebSocket.OPEN) {
            const msg = {
                receiver_id: activeChatUserId,
                content: "", // Optional caption could be added
                media_url: data.url,
                media_type: data.type
            };
            socket.send(JSON.stringify(msg));
        }
    } catch (err) {
        alert("File upload error");
    }
    fileInput.value = ""; // Reset
});

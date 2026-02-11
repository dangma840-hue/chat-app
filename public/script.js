const socket = io();

let username = "";
let room = "";
let typingTimeout = null;

/* ================= JOIN ROOM ================= */
function joinRoom() {
    username = document.getElementById("username").value.trim();
    room = document.getElementById("room").value.trim();

    if (!username || !room) {
        alert("Nhập đầy đủ tên và phòng 😤");
        return;
    }

    document.getElementById("login").classList.add("hidden");
    document.getElementById("chat").classList.remove("hidden");
    document.getElementById("roomTitle").innerText = "📌 Phòng: " + room;

    socket.emit("joinRoom", { username, room });
}

/* ================= SEND MESSAGE ================= */
function sendMessage() {
    const input = document.getElementById("messageInput");
    const message = input.value.trim();
    if (!message) return;

    socket.emit("sendMessage", {
        username,
        room,
        message,
        time: new Date().toLocaleTimeString()
    });

    socket.emit("stopTyping", { room });

    input.value = "";
}

/* ================= ENTER TO SEND ================= */
document.getElementById("messageInput").addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
        sendMessage();
    }
});

/* ================= TYPING ================= */
document.getElementById("messageInput").addEventListener("input", function () {
    socket.emit("typing", { room, username });

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit("stopTyping", { room });
    }, 800);
});

/* ================= RECEIVE ================= */
socket.on("loadMessages", (messages) => {
    messages.forEach(addMessageToChat);
});

socket.on("receiveMessage", (data) => {
    removeTyping();
    addMessageToChat(data);
});

socket.on("typing", (data) => {
    if (data.username !== username) {
        showTyping(data.username);
    }
});

socket.on("stopTyping", () => {
    removeTyping();
});

/* ================= ADD MESSAGE ================= */
function addMessageToChat(data) {
    const messages = document.getElementById("messages");

    const wrap = document.createElement("div");
    wrap.classList.add("message");

    if (data.username === username) {
        wrap.classList.add("me");
    }

    const avatar = document.createElement("div");
    avatar.classList.add("avatar");
    avatar.innerText = data.username[0].toUpperCase();
    avatar.style.background = colorFromName(data.username);

    const content = document.createElement("div");
    content.classList.add("bubble");

    content.innerHTML = `
        <div class="msg-user" style="color:${colorFromName(data.username)}">
            ${data.username}
            <span class="msg-time">${data.time || ""}</span>
        </div>
        <div class="msg-text">${data.message}</div>
    `;

    wrap.appendChild(avatar);
    wrap.appendChild(content);
    messages.appendChild(wrap);

    messages.scrollTop = messages.scrollHeight;
}

/* ================= TYPING UI ================= */
function showTyping(user) {
    const area = document.getElementById("typingArea");
    area.innerHTML = `
        <div class="typing-box">
            ${user} đang gõ
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
        </div>
    `;
}

function removeTyping() {
    document.getElementById("typingArea").innerHTML = "";
}

/* ================= COLOR FIX ================= */
function colorFromName(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${hash % 360}, 70%, 60%)`;
}

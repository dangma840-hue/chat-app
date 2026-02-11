const socket = io();

let username = "";
let room = "";
let typingTimeout;

/* ===== JOIN ===== */
function joinRoom() {
  username = document.getElementById("username").value.trim();
  room = document.getElementById("room").value.trim();

  if (!username || !room) {
    alert("Nhập đủ tên và phòng");
    return;
  }

  document.getElementById("login").classList.add("hidden");
  document.getElementById("chat").classList.remove("hidden");
  document.getElementById("roomTitle").innerText = "📌 Phòng: " + room;

  socket.emit("joinRoom", { room, username });
}

/* ===== SEND ===== */
function sendMessage() {
  const input = document.getElementById("messageInput");
  const text = input.value.trim();
  if (!text) return;

  socket.emit("chatMessage", {
    room,
    user: username,
    text,
    time: new Date().toLocaleTimeString()
  });

  socket.emit("stopTyping", { room });
  input.value = "";
}

/* ===== TYPING ===== */
document.getElementById("messageInput").addEventListener("input", () => {
  socket.emit("typing", { room });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit("stopTyping", { room });
  }, 800);
});

/* ===== RECEIVE ===== */
socket.on("loadMessages", msgs => {
  msgs.forEach(addMessage);
});

socket.on("chatMessage", msg => {
  hideTyping();
  addMessage(msg);
});

socket.on("typing", data => {
  showTyping(data.user);
});

socket.on("stopTyping", hideTyping);

/* ===== UI ===== */
function addMessage(msg) {
  const box = document.getElementById("messages");

  const wrap = document.createElement("div");
  wrap.className = "message";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.innerText = msg.user[0].toUpperCase();
  avatar.style.background = colorFromName(msg.user);

  const content = document.createElement("div");
  content.className = "msg-content";
  content.innerHTML = `
    <div class="msg-user" style="color:${colorFromName(msg.user)}">
      ${msg.user}
      <span class="msg-time">${msg.time}</span>
    </div>
    <div>${msg.text}</div>
  `;

  wrap.appendChild(avatar);
  wrap.appendChild(content);
  box.appendChild(wrap);
  box.scrollTop = box.scrollHeight;
}

function showTyping(user) {
  const area = document.getElementById("typingArea");
  area.innerHTML = `<span>${user} đang gõ</span><span class="typing-dots"></span>`;
}

function hideTyping() {
  document.getElementById("typingArea").innerHTML = "";
}

/* ===== COLOR FIX ===== */
function colorFromName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${hash % 360}, 70%, 60%)`;
}

const socket = io({
  transports: ["websocket"]
});

let username = "";
let room = "";
let typingTimeout;

// ===== JOIN =====
function joinRoom() {
  username = document.getElementById("username").value.trim();
  room = document.getElementById("room").value.trim();

  if (!username || !room) return alert("Nhập đủ 😤");

  document.getElementById("login").classList.add("hidden");
  document.getElementById("chat").classList.remove("hidden");
  document.getElementById("roomTitle").innerText = "📌 " + room;

  socket.emit("joinRoom", { username, room });
}

// ===== SEND =====
function sendMessage() {
  const input = document.getElementById("messageInput");
  const message = input.value.trim();
  if (!message) return;

  socket.emit("sendMessage", { message });
  socket.emit("stopTyping");

  input.value = "";
}

// ===== TYPING =====
document.getElementById("messageInput")
  .addEventListener("input", () => {
    socket.emit("typing");

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("stopTyping");
    }, 800);
  });

// ===== RECEIVE =====
socket.on("loadMessages", msgs => {
  msgs.forEach(addMessage);
});

socket.on("receiveMessage", msg => {
  addMessage(msg);
});

socket.on("typing", user => {
  document.getElementById("typingArea").innerText = user + " đang gõ...";
});

socket.on("stopTyping", () => {
  document.getElementById("typingArea").innerText = "";
});

socket.on("roomUsers", count => {
  document.getElementById("onlineCount").innerText = count;
});

// ===== UI =====
function addMessage(data) {
  const box = document.getElementById("messages");

  const div = document.createElement("div");
  div.classList.add("message");

  div.innerHTML = `
    <div class="msg-user">${data.username}</div>
    <div class="msg-text">${data.message}</div>
  `;

  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// Enter gửi
document.getElementById("messageInput")
  .addEventListener("keypress", e => {
    if (e.key === "Enter") sendMessage();
  });

const socket = io();

let username = "";
let room = "";

function joinRoom() {
  username = document.getElementById("username").value.trim();
  room = document.getElementById("room").value.trim();

  if (!username || !room) {
    alert("Nhập đầy đủ 😤");
    return;
  }

  document.getElementById("login").classList.add("hidden");
  document.getElementById("chat").classList.remove("hidden");
  document.getElementById("roomTitle").innerText = "📌 " + room;

  socket.emit("joinRoom", { username, room });
}

function sendMessage() {
  const input = document.getElementById("messageInput");
  const message = input.value.trim();
  if (!message) return;

  socket.emit("sendMessage", { message });
  input.value = "";
}

socket.on("loadMessages", (messages) => {
  const container = document.getElementById("messages");
  container.innerHTML = "";
  messages.forEach(addMessage);
});

socket.on("receiveMessage", (data) => {
  addMessage(data);
});

function addMessage(data) {
  const container = document.getElementById("messages");

  const div = document.createElement("div");
  div.classList.add("message");
  div.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

document.getElementById("messageInput")
  .addEventListener("keypress", e => {
    if (e.key === "Enter") sendMessage();
  });

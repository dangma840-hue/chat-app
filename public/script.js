const socket = io({ transports: ["websocket"] });

let username = "";
let room = "";

function joinRoom() {
  username = document.getElementById("username").value.trim();
  room = document.getElementById("room").value.trim();

  if (!username || !room) return alert("Nhập đầy đủ 😤");

  document.getElementById("login").classList.add("hidden");
  document.getElementById("chat").classList.remove("hidden");
  document.getElementById("roomTitle").innerText = "📌 " + room;

  socket.emit("joinRoom", { username, room });
}

function sendMessage() {
  const input = document.getElementById("messageInput");
  const message = input.value.trim();
  if (!message) return;

  socket.emit("sendMessage", { username, message });
  input.value = "";
}

socket.on("loadMessages", (messages) => {
  document.getElementById("messages").innerHTML = "";
  messages.forEach(addMessage);
});

socket.on("receiveMessage", (data) => {
  addMessage(data);
});

socket.on("roomUsers", (count) => {
  document.getElementById("onlineCount").innerText = count;
});

function addMessage(data) {
  if (!data.username || !data.message) return;

  const messages = document.getElementById("messages");

  const div = document.createElement("div");
  div.classList.add("message");
  div.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

document.getElementById("messageInput")
  .addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });

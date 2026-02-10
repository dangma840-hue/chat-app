const socket = io("http://localhost:3000"); // ⭐ chỉ định rõ

let username = "";
let room = "";

function joinRoom() {
  username = document.getElementById("username").value.trim();
  room = document.getElementById("room").value.trim();

  if (!username || !room) {
    alert("Nhập đủ tên và phòng");
    return;
  }

  socket.emit("joinRoom", { room, username });

  document.getElementById("login").style.display = "none";
  document.getElementById("chat").style.display = "block";
  document.getElementById("roomName").innerText = "Phòng: " + room;
}

function sendMessage() {
  const input = document.getElementById("messageInput");
  const text = input.value.trim();
  if (!text) return;

  const data = {
    room,
    user: username,
    text,
    time: new Date().toLocaleTimeString()
  };

  console.log("➡️ Gửi:", data); // ⭐ debug

  socket.emit("chatMessage", data);
  input.value = "";
}

socket.on("loadMessages", (messages) => {
  messages.forEach(addMessage);
});

socket.on("chatMessage", (msg) => {
  addMessage(msg);
});

function addMessage(msg) {
  const div = document.createElement("div");
  div.className = "message";
  div.innerText = `[${msg.time}] ${msg.user}: ${msg.text}`;
  document.getElementById("messages").appendChild(div);
}

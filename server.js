require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

// ===== Socket.io =====
const io = new Server(server, {
  transports: ["websocket"],
  cors: { origin: "*" }
});

// ===== Static Folder =====
app.use(express.static(path.join(__dirname, "public")));

// ===== MongoDB =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ Mongo Error:", err));

// ===== Schema =====
const MessageSchema = new mongoose.Schema({
  room: String,
  username: String,
  message: String,
  time: { type: Date, default: Date.now }
});

const Message = mongoose.model("Message", MessageSchema);

// ===== Socket Logic =====
io.on("connection", (socket) => {
  console.log("🟢 User connected");

  socket.on("joinRoom", async ({ username, room }) => {
    socket.join(room);
    socket.username = username;
    socket.room = room;

    console.log(`👤 ${username} joined ${room}`);

    // Load tin nhắn cũ theo room
    const oldMessages = await Message.find({ room }).sort({ time: 1 });
    socket.emit("loadMessages", oldMessages);

    updateOnline(room);
  });

  socket.on("sendMessage", async ({ message }) => {
    if (!socket.room || !socket.username) return;

    const newMsg = new Message({
      room: socket.room,
      username: socket.username,
      message
    });

    await newMsg.save();

    io.to(socket.room).emit("receiveMessage", newMsg);
  });

  socket.on("typing", () => {
    socket.to(socket.room).emit("typing", socket.username);
  });

  socket.on("stopTyping", () => {
    socket.to(socket.room).emit("stopTyping");
  });

  socket.on("disconnect", () => {
    if (socket.room) updateOnline(socket.room);
    console.log("🔴 User disconnected");
  });

  function updateOnline(room) {
    const count = io.sockets.adapter.rooms.get(room)?.size || 0;
    io.to(room).emit("roomUsers", count);
  }
});

// ===== Start =====
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});

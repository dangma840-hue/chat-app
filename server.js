// ====== LOAD ENV ======
require("dotenv").config();

// ====== IMPORT ======
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const cors = require("cors");
const compression = require("compression");

// ====== APP ======
const app = express();
app.use(cors());
app.use(express.json());
app.use(compression());

// Phục vụ file tĩnh
app.use(express.static("public", {
  maxAge: "7d"
}));

// ====== HTTP SERVER ======
const server = http.createServer(app);

// ====== SOCKET.IO ======
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ====== CONNECT MONGODB ======
if (!process.env.MONGO_URI) {
  console.log("❌ MONGO_URI chưa được cấu hình");
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  });

// ====== SCHEMA ======
const MessageSchema = new mongoose.Schema({
  room: String,
  username: String,
  message: String,
  time: { type: Date, default: Date.now }
});

const Message = mongoose.model("Message", MessageSchema);

// ====== ROUTE TEST ======
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// ====== SOCKET EVENTS ======
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // Join phòng
  socket.on("joinRoom", async ({ username, room }) => {
    socket.join(room);
    socket.username = username;
    socket.room = room;

    console.log(`👤 ${username} joined room ${room}`);

    // Load tin nhắn cũ
    const oldMessages = await Message.find({ room }).sort({ time: 1 });
    socket.emit("loadMessages", oldMessages);
  });

  // Gửi tin nhắn
  socket.on("sendMessage", async ({ username, message }) => {
    if (!socket.room) return;

    const newMessage = new Message({
      room: socket.room,
      username,
      message
    });

    await newMessage.save();

    io.to(socket.room).emit("receiveMessage", newMessage);
  });

  // Typing
  socket.on("typing", () => {
    socket.to(socket.room).emit("typing", {
      username: socket.username
    });
  });

  socket.on("stopTyping", () => {
    socket.to(socket.room).emit("stopTyping");
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

// ====== START SERVER ======
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});

require("dotenv").config();
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

// ===== PORT (QUAN TRỌNG CHO RENDER) =====
const PORT = process.env.PORT || 10000;

// ===== STATIC FILE =====
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// ===== SOCKET.IO =====
const io = new Server(server, {
  cors: {
    origin: "*",
  },
  transports: ["websocket"], // ⚡ ép websocket
});

// ===== MONGODB =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ Mongo Error:", err));

// ===== SCHEMA =====
const MessageSchema = new mongoose.Schema({
  username: String,
  room: String,
  message: String,
  time: { type: Date, default: Date.now }
});

const Message = mongoose.model("Message", MessageSchema);

// ===== SOCKET EVENTS =====
io.on("connection", (socket) => {
  console.log("🟢 User connected");

  socket.on("joinRoom", async ({ username, room }) => {
    socket.join(room);
    socket.username = username;
    socket.room = room;

    console.log(`👤 ${username} joined ${room}`);

    // load tin nhắn cũ
    const messages = await Message.find({ room }).sort({ time: 1 });
    socket.emit("loadMessages", messages);

    // cập nhật online
    const clients = await io.in(room).fetchSockets();
    io.to(room).emit("roomUsers", clients.length);
  });

  socket.on("sendMessage", async (data) => {
    if (!data.message || !data.username) return;

    const newMessage = new Message({
      username: data.username,
      room: socket.room,
      message: data.message
    });

    await newMessage.save();

    io.to(socket.room).emit("receiveMessage", newMessage);
  });

  socket.on("disconnect", async () => {
    if (socket.room) {
      const clients = await io.in(socket.room).fetchSockets();
      io.to(socket.room).emit("roomUsers", clients.length);
    }
    console.log("🔴 User disconnected");
  });
});

// ===== START =====
server.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});

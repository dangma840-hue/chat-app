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

// Serve static files
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

// ====== CONNECT MONGODB (GIỮ NGUYÊN - QUAN TRỌNG) ======
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
  roomType: {
    type: String,
    enum: ["temporary", "permanent"],
    default: "temporary"
  },
  time: { type: Date, default: Date.now },
  expireAt: Date
});

// TTL index (tự xoá khi đến expireAt)
MessageSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const Message = mongoose.model("Message", MessageSchema);

// ====== ROUTE TEST ======
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// ====== SOCKET EVENTS ======
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // Join phòng
  socket.on("joinRoom", async ({ username, room, roomType }) => {
    socket.join(room);
    socket.username = username;
    socket.room = room;
    socket.roomType = roomType || "temporary";

    console.log(`👤 ${username} joined room ${room} (${socket.roomType})`);

    try {
      const oldMessages = await Message.find({ room }).sort({ time: 1 });
      socket.emit("loadMessages", oldMessages);
    } catch (err) {
      console.error("Load message error:", err.message);
    }
  });

  // Gửi tin nhắn
  socket.on("sendMessage", async ({ message }) => {
    if (!socket.room || !socket.username) return;

    try {
      let expireTime = null;

      // Nếu phòng temporary → tự xoá sau 24h
      if (socket.roomType === "temporary") {
        expireTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }

      const newMessage = new Message({
        room: socket.room,
        username: socket.username,
        message,
        roomType: socket.roomType,
        expireAt: expireTime
      });

      await newMessage.save();

      io.to(socket.room).emit("receiveMessage", newMessage);

    } catch (err) {
      console.error("Save message error:", err.message);
    }
  });

  // Typing
  socket.on("typing", () => {
    if (!socket.room) return;
    socket.to(socket.room).emit("typing", {
      username: socket.username
    });
  });

  socket.on("stopTyping", () => {
    if (!socket.room) return;
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

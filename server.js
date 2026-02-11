require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

/* ===============================
   1️⃣ TẠO SERVER
================================= */

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(express.static("public"));

/* ===============================
   2️⃣ KẾT NỐI MONGODB
================================= */

if (!process.env.MONGO_URI) {
  console.error("❌ Thiếu MONGO_URI trong .env hoặc Environment Variables");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  })
  .then(() => {
    console.log("✅ MongoDB connected");
  })
  .catch((err) => {
    console.error("❌ MongoDB error:", err.message);
  });

/* ===============================
   3️⃣ SCHEMA
================================= */

const MessageSchema = new mongoose.Schema({
  room: String,
  user: String,
  text: String,
  time: String,
});

const Message = mongoose.model("Message", MessageSchema);

/* ===============================
   4️⃣ SOCKET LOGIC
================================= */

const onlineUsers = {}; // { room: [user1, user2] }

io.on("connection", (socket) => {
  console.log("👤 Connected:", socket.id);

  /* ===== JOIN ROOM ===== */
  socket.on("joinRoom", async ({ room, username }) => {
    socket.join(room);
    socket.username = username;
    socket.room = room;

    // Lưu online user
    if (!onlineUsers[room]) onlineUsers[room] = [];
    if (!onlineUsers[room].includes(username)) {
      onlineUsers[room].push(username);
    }

    io.to(room).emit("onlineUsers", onlineUsers[room]);

    // Load tin nhắn cũ
    try {
      const messages = await Message.find({ room }).sort({ _id: 1 });
      socket.emit("loadMessages", messages);
    } catch (err) {
      console.error("❌ Load messages error:", err.message);
    }
  });

  /* ===== CHAT MESSAGE ===== */
  socket.on("chatMessage", async (data) => {
    try {
      const msg = new Message(data);
      await msg.save();
      io.to(data.room).emit("chatMessage", data);
    } catch (err) {
      console.error("❌ Save message error:", err.message);
    }
  });

  /* ===== TYPING ===== */
  socket.on("typing", () => {
    socket.to(socket.room).emit("typing", socket.username);
  });

  socket.on("stopTyping", () => {
    socket.to(socket.room).emit("stopTyping");
  });

  /* ===== DISCONNECT ===== */
  socket.on("disconnect", () => {
    const { room, username } = socket;

    if (room && onlineUsers[room]) {
      onlineUsers[room] = onlineUsers[room].filter(
        (user) => user !== username
      );
      io.to(room).emit("onlineUsers", onlineUsers[room]);
    }

    console.log("❌ Disconnected:", socket.id);
  });
});

/* ===============================
   5️⃣ START SERVER
================================= */

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});


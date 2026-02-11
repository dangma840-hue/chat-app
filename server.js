require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  transports: ["websocket"],
  cors: {
    origin: "*"
  }
});

// ===== Serve static files =====
app.use(express.static(path.join(__dirname, "public")));

// ===== MongoDB Connect =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ Mongo Error:", err));

// ===== Schema =====
const MessageSchema = new mongoose.Schema({
  username: String,
  message: String,
  room: String,
  time: { type: Date, default: Date.now }
});

const Message = mongoose.model("Message", MessageSchema);

// ===== Socket =====
io.on("connection", (socket) => {

  socket.on("joinRoom", async ({ username, room }) => {
    socket.join(room);
    socket.username = username;
    socket.room = room;

    console.log(`👤 ${username} joined ${room}`);

    // Load tin cũ theo room
    const oldMessages = await Message.find({ room }).sort({ time: 1 });
    socket.emit("loadMessages", oldMessages);

    const count = io.sockets.adapter.rooms.get(room)?.size || 0;
    io.to(room).emit("roomUsers", count);
  });

  socket.on("sendMessage", async ({ username, message }) => {
    if (!username || !message) return;

    const newMessage = new Message({
      username,
      message,
      room: socket.room
    });

    await newMessage.save();

    io.to(socket.room).emit("receiveMessage", newMessage);
  });

  socket.on("disconnect", () => {
    if (socket.room) {
      const count = io.sockets.adapter.rooms.get(socket.room)?.size || 0;
      io.to(socket.room).emit("roomUsers", count);
    }
  });
});

// ===== Start =====
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

// ===== STATIC FILES =====
app.use(express.static(path.join(__dirname, "public")));

// ===== MONGO =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Mongo Connected"))
  .catch(err => console.log("❌ Mongo Error:", err));

// ===== SCHEMA =====
const Message = mongoose.model("Message", {
  username: String,
  room: String,
  message: String,
  time: { type: Date, default: Date.now }
});

// ===== SOCKET =====
io.on("connection", (socket) => {

  socket.on("joinRoom", async ({ username, room }) => {
    socket.join(room);

    const oldMessages = await Message.find({ room }).sort({ time: 1 });
    socket.emit("loadMessages", oldMessages);
  });

  socket.on("sendMessage", async ({ username, room, message }) => {
    const newMessage = new Message({ username, room, message });
    await newMessage.save();

    io.to(room).emit("receiveMessage", newMessage);
  });
});

// ===== START =====
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log("🔥 Server running on port", PORT);
});

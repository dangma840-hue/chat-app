require("dotenv").config();

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const cors = require("cors");
const compression = require("compression");

const app = express();
app.use(cors());
app.use(express.json());
app.use(compression());
app.use(express.static("public", { maxAge: "7d" }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// ===== USERS =====
const USERS = {
  admin: { password: "admin123", role: "admin" },
  "Emi Fukada": { password: "Tumotdensau", role: "member" },
  BCM: { password: "Minh7709", role: "member" },
  Henri: { password: "thh1604#", role: "member" }
};

// ===== ROOM PASSWORDS =====
const ROOM_PASSWORDS = {
  LFD: "LFD123",
  LKFD: "LKFD123"
};

let adminSocketId = null;

// ===== ROOM USER TRACKING =====
let roomUsers = {
  LFD: new Set(),
  LKFD: new Set()
};

// ===== MONGODB =====
if (!process.env.MONGO_URI) {
  console.log("❌ MONGO_URI chưa cấu hình");
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
    console.error("❌ Mongo Error:", err.message);
    process.exit(1);
  });

// ===== SCHEMA =====
const MessageSchema = new mongoose.Schema({
  room: String,
  username: String,
  message: String,
  roomType: { type: String, enum: ["temporary", "permanent"] },
  time: { type: Date, default: Date.now },
  expireAt: Date
});

MessageSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const Message = mongoose.model("Message", MessageSchema);

// ===== SOCKET =====
io.on("connection", (socket) => {

  console.log("🟢 Connected:", socket.id);

  // ===== LOGIN =====
  socket.on("login", async ({ username, password, roomPassword }) => {

    if (!USERS[username])
      return socket.emit("loginError", "❌ User không tồn tại");

    if (USERS[username].password !== password)
      return socket.emit("loginError", "❌ Sai mật khẩu");

    let room = null;

    if (roomPassword === ROOM_PASSWORDS.LFD) room = "LFD";
    else if (roomPassword === ROOM_PASSWORDS.LKFD) room = "LKFD";
    else return socket.emit("loginError", "❌ Sai mật khẩu phòng");

    // ===== ADMIN =====
    if (USERS[username].role === "admin") {

      socket.username = username;
      socket.role = "admin";
      socket.room = room;
      socket.join(room);

      adminSocketId = socket.id;

      // track online
      roomUsers[room].add(socket.id);
      io.to(room).emit("roomUsers", roomUsers[room].size);

      socket.emit("loginSuccess", room);

      const oldMessages = await Message.find({ room }).sort({ time: 1 });
      socket.emit("loadMessages", oldMessages);

      console.log(`👑 Admin vào ${room}`);
      return;
    }

    // ===== MEMBER LFD =====
    if (room === "LFD") {

      socket.username = username;
      socket.role = "member";
      socket.room = room;
      socket.join(room);

      roomUsers[room].add(socket.id);
      io.to(room).emit("roomUsers", roomUsers[room].size);

      socket.emit("loginSuccess", room);

      const oldMessages = await Message.find({ room }).sort({ time: 1 });
      socket.emit("loadMessages", oldMessages);

      console.log(`👤 ${username} vào LFD`);
      return;
    }

    // ===== MEMBER LKFD (WAIT APPROVAL) =====
    if (room === "LKFD") {

      if (!adminSocketId)
        return socket.emit("loginError", "❌ Admin chưa online");

      socket.username = username;
      socket.role = "member";
      socket.pendingRoom = "LKFD";

      io.to(adminSocketId).emit("approvalRequest", {
        username,
        socketId: socket.id
      });

      socket.emit("waitingApproval");
    }

  });

  // ===== APPROVE USER =====
  socket.on("approveUser", async ({ socketId }) => {

    if (socket.role !== "admin") return;

    const targetSocket = io.sockets.sockets.get(socketId);
    if (!targetSocket) return;

    targetSocket.room = "LKFD";
    targetSocket.join("LKFD");

    roomUsers["LKFD"].add(socketId);
    io.to("LKFD").emit("roomUsers", roomUsers["LKFD"].size);

    targetSocket.emit("loginSuccess", "LKFD");

    const oldMessages = await Message.find({ room: "LKFD" }).sort({ time: 1 });
    targetSocket.emit("loadMessages", oldMessages);

    io.to(adminSocketId).emit("removeRequest", socketId);

    console.log(`✅ Duyệt ${targetSocket.username} vào LKFD`);
  });

  // ===== REJECT USER =====
  socket.on("rejectUser", ({ socketId }) => {

    if (socket.role !== "admin") return;

    const targetSocket = io.sockets.sockets.get(socketId);
    if (!targetSocket) return;

    targetSocket.emit("loginError", "❌ Yêu cầu bị từ chối");
    targetSocket.disconnect();

    io.to(adminSocketId).emit("removeRequest", socketId);
  });

  // ===== SEND MESSAGE =====
  socket.on("sendMessage", async ({ message }) => {

    if (!socket.room) return;

    let expireTime = null;

    if (socket.room === "LFD")
      expireTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const newMessage = new Message({
      room: socket.room,
      username: socket.username,
      message,
      roomType: socket.room === "LFD" ? "temporary" : "permanent",
      expireAt: expireTime
    });

    await newMessage.save();

    io.to(socket.room).emit("receiveMessage", newMessage);

    // Clone LFD → LKFD
    if (socket.room === "LFD") {
      const cloned = new Message({
        room: "LKFD",
        username: socket.username,
        message,
        roomType: "permanent"
      });
      await cloned.save();
    }

  });

  // ===== DISCONNECT =====
  socket.on("disconnect", () => {

    if (socket.room && roomUsers[socket.room]) {
      roomUsers[socket.room].delete(socket.id);
      io.to(socket.room).emit("roomUsers", roomUsers[socket.room].size);
    }

    if (socket.role === "admin") {
      adminSocketId = null;
      console.log("⚠ Admin offline");
    }

    console.log("🔴 Disconnected:", socket.id);
  });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});

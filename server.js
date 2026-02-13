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

app.use(express.static("public", { maxAge: "7d" }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ====== USERS (4 USER CỐ ĐỊNH) ======
const USERS = {
  admin: { password: "admin123", role: "admin" },
  user1: { password: "1111", role: "member" },
  user2: { password: "2222", role: "member" },
  user3: { password: "3333", role: "member" }
};

// ====== ROOM PASSWORD ======
const ROOM_PASSWORDS = {
  LFD: "LFD123",
  LKFD: "LKFD123"
};

// Lưu admin socket để gửi yêu cầu duyệt
let adminSocketId = null;

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
  roomType: {
    type: String,
    enum: ["temporary", "permanent"],
    default: "temporary"
  },
  time: { type: Date, default: Date.now },
  expireAt: Date
});

MessageSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const Message = mongoose.model("Message", MessageSchema);

// ====== ROUTE ======
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// ====== SOCKET ======
io.on("connection", (socket) => {

  console.log("🟢 Connected:", socket.id);

  // ===== LOGIN =====
  socket.on("login", async ({ username, password, roomPassword }) => {

    // 1️⃣ Check user tồn tại
    if (!USERS[username]) {
      return socket.emit("loginError", "❌ User không tồn tại");
    }

    // 2️⃣ Check password
    if (USERS[username].password !== password) {
      return socket.emit("loginError", "❌ Sai mật khẩu tài khoản");
    }

    // 3️⃣ Xác định phòng theo mật khẩu phòng
    let room = null;

    if (roomPassword === ROOM_PASSWORDS.LFD) {
      room = "LFD";
    } else if (roomPassword === ROOM_PASSWORDS.LKFD) {
      room = "LKFD";
    } else {
      return socket.emit("loginError", "❌ Sai mật khẩu phòng");
    }

    // ===== ADMIN =====
    if (USERS[username].role === "admin") {
      socket.username = username;
      socket.role = "admin";
      socket.room = room;
      socket.join(room);

      adminSocketId = socket.id;

      socket.emit("loginSuccess", room);

      const oldMessages = await Message.find({ room }).sort({ time: 1 });
      socket.emit("loadMessages", oldMessages);

      console.log(`👑 Admin vào ${room}`);
      return;
    }

    // ===== MEMBER =====

    // Nếu vào LFD → vào luôn
    if (room === "LFD") {

      socket.username = username;
      socket.role = "member";
      socket.room = room;
      socket.join(room);

      socket.emit("loginSuccess", room);

      const oldMessages = await Message.find({ room }).sort({ time: 1 });
      socket.emit("loadMessages", oldMessages);

      console.log(`👤 ${username} vào LFD`);
      return;
    }

    // Nếu vào LKFD → cần admin duyệt
    if (room === "LKFD") {

      if (!adminSocketId) {
        return socket.emit("loginError", "❌ Admin chưa online");
      }

      socket.pendingRoom = "LKFD";
      socket.username = username;
      socket.role = "member";

      io.to(adminSocketId).emit("approvalRequest", {
        username,
        socketId: socket.id
      });

      socket.emit("waitingApproval");
      return;
    }

  });

  // ===== ADMIN DUYỆT =====
  socket.on("approveUser", async ({ socketId }) => {

    if (socket.role !== "admin") return;

    const targetSocket = io.sockets.sockets.get(socketId);
    if (!targetSocket) return;

    targetSocket.room = "LKFD";
    targetSocket.join("LKFD");

    targetSocket.emit("loginSuccess", "LKFD");

    const oldMessages = await Message.find({ room: "LKFD" }).sort({ time: 1 });
    targetSocket.emit("loadMessages", oldMessages);

    console.log(`✅ Admin duyệt ${targetSocket.username} vào LKFD`);
  });

  // ===== SEND MESSAGE =====
  socket.on("sendMessage", async ({ message }) => {

    if (!socket.room || !socket.username) return;

    try {

      let expireTime = null;

      if (socket.room === "LFD") {
        expireTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }

      const newMessage = new Message({
        room: socket.room,
        username: socket.username,
        message,
        roomType: socket.room === "LFD" ? "temporary" : "permanent",
        expireAt: expireTime
      });

      await newMessage.save();

      io.to(socket.room).emit("receiveMessage", newMessage);

      // ===== CLONE LFD → LKFD =====
      if (socket.room === "LFD") {

        const cloned = new Message({
          room: "LKFD",
          username: socket.username,
          message,
          roomType: "permanent"
        });

        await cloned.save();

        console.log("📦 Cloned LFD → LKFD");
      }

    } catch (err) {
      console.error("Save error:", err.message);
    }
  });

  socket.on("disconnect", () => {
    if (socket.role === "admin") {
      adminSocketId = null;
    }
    console.log("🔴 Disconnected:", socket.id);
  });

});

// ====== START SERVER ======
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});

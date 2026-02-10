require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

/* ===== MongoDB ===== */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err.message));

const MessageSchema = new mongoose.Schema({
  room: String,
  user: String,
  text: String,
  time: String
});

const Message = mongoose.model("Message", MessageSchema);

/* ===== Socket ===== */
io.on("connection", socket => {
  console.log("👤 Connected:", socket.id);

  socket.on("joinRoom", async ({ room }) => {
    socket.join(room);

    const messages = await Message.find({ room }).sort({ _id: 1 });
    socket.emit("loadMessages", messages);
  });

  socket.on("chatMessage", async data => {
    const msg = new Message(data);
    await msg.save();

    io.to(data.room).emit("chatMessage", data);
  });
});

/* ===== Start ===== */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

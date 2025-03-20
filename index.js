const express = require("express");
const dotenv = require("dotenv").config();
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
const passport = require("passport");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

// Import models
const { User } = require("./models/User");
const { Message } = require("./models/Message");

const { notfound, errorHandler } = require("./middlewares/errors");
const ConnectToDB = require("./config/db");

const port = process.env.PORT || 4000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cors());
app.use(bodyParser.json());

app.get("/login.html", (req, res) => res.sendFile("login.html", { root: "views" }));

const MessageSchema = new mongoose.Schema({
  sender: String, // Will use email now
  receiver: String, // Will use email now
  message: String,
  timestamp: { type: Date, default: Date.now },
});

const MMessage = mongoose.model("Message", MessageSchema);

// Connect to DB and start server
(async () => {
  try {
    await ConnectToDB();
    console.log("✅ Database connected successfully");

    server.listen(port, () => {
      console.log(`🚀 Server running on http://localhost:${port}`);
    });
  } catch (err) {
    console.error("❌ Failed to connect to the database:", err);
    process.exit(1);
  }
})();

const users = {}; // Store online users by email

io.on("connection", (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  socket.on("register", async (email) => {
    if (!email) return console.error("❌ Empty email received.");
    users[email] = socket.id;
    console.log(`✅ ${email} registered with socket ID: ${socket.id}`);
    try {
      await User.findOneAndUpdate(
        { email },
        { $set: { email, name: email.split("@")[0], phone: "01234567890", password: "defaultPass123!" } },
        { upsert: true, new: true }
      );
      broadcastUserList(email);
    } catch (err) {
      console.error(`❌ Error registering user ${email}:`, err);
    }
  });

  socket.on("sendConnectionRequest", async ({ from, to }) => {
    try {
      await User.findOneAndUpdate(
        { email: to },
        { $addToSet: { pendingRequests: from } }
      );
      if (users[to]) {
        io.to(users[to]).emit("connectionRequest", { from });
      }
      broadcastUserList(to); // Update recipient's UI
      broadcastUserList(from); // Update sender's UI
    } catch (err) {
      console.error("❌ Error sending connection request:", err);
    }
  });

  socket.on("acceptConnection", async ({ from, to }) => {
    try {
      await User.findOneAndUpdate(
        { email: from },
        { $addToSet: { connections: to } }
      );
      await User.findOneAndUpdate(
        { email: to },
        { $addToSet: { connections: from }, $pull: { pendingRequests: from } }
      );
      broadcastUserList(from);
      broadcastUserList(to);
    } catch (err) {
      console.error("❌ Error accepting connection:", err);
    }
  });

  socket.on("loadMessages", async ({ sender, receiver }) => {
    console.log("Loading messages for:", { sender, receiver });
    try {
      if (!MMessage) {
        throw new Error("Message model is not defined");
      }
      const messages = await MMessage.find({
        $or: [
          { sender, receiver },
          { sender: receiver, receiver: sender },
        ],
      }).sort({ timestamp: 1 });
      console.log("Found messages:", messages);
      socket.emit("previousMessages", messages);
    } catch (err) {
      console.error("❌ Error loading messages:", err.message);
      socket.emit("error", "Failed to load messages");
    }
  });

  socket.on("sendMessage", async (data) => {
    const { sender, receiver, message } = data;
    console.log("Sending message:", { sender, receiver, message });

    // Check if sender and receiver are connected
    const senderUser = await User.findOne({ email: sender });
    if (!senderUser || !senderUser.connections.includes(receiver)) {
      console.log(`❌ ${sender} not connected to ${receiver}`);
      socket.emit("error", "You must be connected to send messages.");
      return;
    }

    // Save the message to the database
    const newMessage = new MMessage({ sender, receiver, message });
    await newMessage.save();
    console.log("Message saved:", newMessage);

    // Emit the message to the receiver if online
    if (users[receiver]) {
      io.to(users[receiver]).emit("receiveMessage", newMessage);
      console.log(`Emitted to ${receiver}:`, users[receiver]);
    }

    // Emit the message back to the sender
    socket.emit("receiveMessage", newMessage);
  });

  socket.on("deleteMessage", async ({ messageId }) => {
    console.log("Deleting message:", messageId);
    await MMessage.findByIdAndDelete(messageId);
    io.emit("messageDeleted", { messageId });
  });

  socket.on("messageRead", async ({ messageId, sender }) => {
    const message = await Message.findOne({ _id: messageId, receiver: socket.email });
    if (message && message.status !== "read") {
      message.status = "read";
      await message.save();
      io.to(sender).emit("messageStatus", { messageId, status: "read" });
    }
  });

  socket.on("editMessage", async ({ messageId, newMessage, sender, receiver }) => {
    const message = await Message.findOne({ _id: messageId, sender });
    if (message) {
      message.message = newMessage;
      message.edited = true;
      await message.save();
      io.to(receiver).emit("messageEdited", { messageId, newMessage });
      socket.emit("messageEdited", { messageId, newMessage });
    }
  });

  socket.on("searchUsers", async ({ query, email }) => {
    const allUsers = await User.find({
      email: { $regex: query, $options: "i" },
    }).distinct("email");
    const user = await User.findOne({ email });
    if (!user) return;
    const connectedUsers = user.connections || [];
    const pendingRequests = user.pendingRequests || [];
    const searchResults = allUsers
      .filter((u) => u !== email)
      .map((u) => ({
        email: u,
        connected: connectedUsers.includes(u),
        pending: pendingRequests.includes(u),
      }));
    socket.emit("searchResults", searchResults);
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);
    let disconnectedUser = null;
    for (let user in users) {
      if (users[user] === socket.id) {
        disconnectedUser = user;
        delete users[user];
        break;
      }
    }
    if (disconnectedUser) {
      broadcastUserList(disconnectedUser);
    }
  });
});

async function broadcastUserList(email) {
  if (!email || !users[email]) {
    console.log(`❌ No socket found for email: ${email}`);
    return;
  }
  const user = await User.findOne({ email });
  if (!user) {
    console.log(`❌ User not found in database: ${email}`);
    return;
  }
  const onlineUsers = Object.keys(users);
  const userStatus = (user.connections || []).map((conn) => ({
    email: conn,
    online: onlineUsers.includes(conn),
  }));
  console.log("Broadcasting to:", email, "Pending:", user.pendingRequests);
  io.to(users[email]).emit("updateUsers", {
    connections: userStatus,
    pendingRequests: user.pendingRequests || [],
  });
}

app.use("/auth", require("./routes/Google&LinkedInAuth"));
app.use("/auth", require("./routes/auth"));
app.use("/users", require("./routes/users"));
app.use("/api/appointments", require("./routes/appointmentRoutes"));

app.get("/", (req, res) => res.sendFile(__dirname + "/views/index.html"));
app.get("/chat", (req, res) => res.sendFile(__dirname + "/views/chat.html"));
app.get("/login", (req, res) => res.sendFile(__dirname + "/views/login.html"));
app.get("/profile", (req, res) =>
  res.sendFile(__dirname + "/views/Profile.html")
);

app.use(require("./middlewares/logger"));
app.use(notfound);
app.use(errorHandler);
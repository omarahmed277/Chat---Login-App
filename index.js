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

// Assuming these files exist in your project structure
const { User } = require("./models/User");
const { Message } = require("./models/Message");
const { notfound, errorHandler } = require("./middlewares/errors");
const ConnectToDB = require("./config/db");

const port = process.env.PORT || 4000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cors());
app.use(bodyParser.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Message Schema
const MessageSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  message: String,
  timestamp: { type: Date, default: Date.now },
  status: { type: String, default: "sent" },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
    default: null,
  },
});
const MMessage = mongoose.model("Message", MessageSchema);

// Assuming User Schema exists in ./models/User.js
// Example: const UserSchema = new mongoose.Schema({ email: String, connections: [String], pendingRequests: [String], ... });

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

// Store online users
const users = {};

io.on("connection", (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  socket.on("register", async (email) => {
    if (!email) {
      console.error("❌ Empty email received.");
      socket.emit("error", "Email is required");
      return;
    }
    users[email] = socket.id;
    console.log(`✅ ${email} registered with socket ID: ${socket.id}`);
    try {
      const user = await User.findOneAndUpdate(
        { email },
        {
          $setOnInsert: {
            name: email.split("@")[0],
            phone: "",
            password: "",
            profileCompleted: false,
            connections: [],
            pendingRequests: [],
          },
        },
        { upsert: true, new: true }
      );
      broadcastUserList(email);
    } catch (err) {
      console.error(`❌ Error registering user ${email}:`, err);
      socket.emit("error", "Failed to register user");
    }
  });

  socket.on("sendConnectionRequest", async ({ from, to }) => {
    try {
      const receiver = await User.findOneAndUpdate(
        { email: to },
        { $addToSet: { pendingRequests: from } }
      );
      if (!receiver) {
        socket.emit("error", "Receiver not found");
        return;
      }
      if (users[to]) {
        io.to(users[to]).emit("connectionRequest", { from });
      }
      broadcastUserList(to);
      broadcastUserList(from);
    } catch (err) {
      console.error("❌ Error sending connection request:", err);
      socket.emit("error", "Failed to send connection request");
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
      socket.emit("error", "Failed to accept connection");
    }
  });

  socket.on("loadMessages", async ({ sender, receiver }) => {
    console.log("Loading messages for:", { sender, receiver });
    try {
      const messages = await MMessage.find({
        $or: [
          { sender, receiver },
          { sender: receiver, receiver: sender },
        ],
      })
        .populate("replyTo", "message")
        .sort({ timestamp: 1 });
      const formattedMessages = messages.map((msg) => ({
        _id: msg._id,
        sender: msg.sender,
        receiver: msg.receiver,
        message: msg.message,
        timestamp: msg.timestamp,
        status: msg.status,
        replyTo: msg.replyTo?._id || null,
        replyMessage: msg.replyTo?.message || null,
      }));
      socket.emit("previousMessages", formattedMessages);
    } catch (err) {
      console.error("❌ Error loading messages:", err.message);
      socket.emit("error", "Failed to load messages");
    }
  });

  socket.on("sendMessage", async (data) => {
    const { sender, receiver, message, replyTo } = data;
    console.log("Sending message:", { sender, receiver, message, replyTo });
    try {
      const senderUser = await User.findOne({ email: sender });
      if (!senderUser || !senderUser.connections.includes(receiver)) {
        console.log(`❌ ${sender} not connected to ${receiver}`);
        socket.emit("error", "You must be connected to send messages.");
        return;
      }
      const newMessage = new MMessage({ sender, receiver, message, replyTo });
      await newMessage.save();
      const formattedMessage = {
        _id: newMessage._id,
        sender,
        receiver,
        message,
        timestamp: newMessage.timestamp,
        status: newMessage.status,
        replyTo: newMessage.replyTo || null,
        replyMessage: replyTo
          ? (await MMessage.findById(replyTo))?.message
          : null,
      };
      if (users[receiver]) {
        io.to(users[receiver]).emit("receiveMessage", formattedMessage);
      }
      socket.emit("receiveMessage", formattedMessage);
    } catch (err) {
      console.error("❌ Error sending message:", err);
      socket.emit("error", "Failed to send message");
    }
  });

  socket.on("deleteMessage", async ({ messageId, sender, receiver }) => {
    console.log("Deleting message:", messageId);
    try {
      await MMessage.findByIdAndDelete(messageId);
      io.to(users[receiver]).emit("messageDeleted", { messageId });
      io.to(users[sender]).emit("messageDeleted", { messageId });
    } catch (err) {
      console.error("❌ Error deleting message:", err);
      socket.emit("error", "Failed to delete message");
    }
  });

  // Fixed search users functionality
  socket.on("searchUsers", async ({ query, email }) => {
    try {
      console.log(`🔍 Searching users for query: '${query}' by ${email}`);
      const user = await User.findOne({ email });
      if (!user) {
        console.log(`❌ User ${email} not found in DB`);
        socket.emit("error", "User not found");
        return;
      }
      // Use RegExp for case-insensitive partial matching
      const allUsers = await User.find({
        email: { $regex: new RegExp(query, "i"), $ne: email },
      }).select("email connections pendingRequests");
      console.log(`🔍 Found ${allUsers.length} users matching '${query}'`);
      const connectedUsers = user.connections || [];
      const pendingRequests = user.pendingRequests || [];
      const searchResults = allUsers.map((u) => ({
        email: u.email,
        connected: connectedUsers.includes(u.email),
        pending: pendingRequests.includes(u.email),
      }));
      console.log("🔍 Search results:", searchResults);
      socket.emit("searchResults", searchResults);
    } catch (err) {
      console.error("❌ Error searching users:", err);
      socket.emit("error", "Failed to search users");
    }
  });

  socket.on("typing", ({ sender, receiver }) => {
    if (users[receiver]) {
      io.to(users[receiver]).emit("typing", { sender });
    }
  });

  socket.on("stopTyping", ({ sender, receiver }) => {
    if (users[receiver]) {
      io.to(users[receiver]).emit("stopTyping", { sender });
    }
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
  try {
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
  } catch (err) {
    console.error("❌ Error broadcasting user list:", err);
  }
}

// Routes (assuming these files exist)
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

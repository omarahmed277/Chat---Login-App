const express = require("express");
const dotenv = require("dotenv").config();
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
const passport = require("passport");
const http = require("http");
const { Server } = require("socket.io");

// Import the User model
const { User } = require("./models/User");

const { notfound, errorHandler } = require("./middlewares/errors");
const { connect } = require("http2");
const ConnectToDB = require("./config/db");

const port = process.env.PORT || 4000; // Updated to match your logs
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cors());
app.use(bodyParser.json());

// connect DB
ConnectToDB();

app.use(
  session({
    secret: process.env.SESSION_SECRET || "your_secret_key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);
app.use(passport.initialize());
app.use(passport.session());


const users = {}; // Store online users by email

io.on("connection", (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  socket.on("register", async (email) => {
    if (!email) {
      console.error("❌ Received an empty email from client.");
      return;
    }
    users[email] = socket.id;
    console.log(`✅ ${email} registered with socket ID: ${socket.id}`);

    try {
      // Since the new User schema requires name, phone, email, and password,
      // we'll need to provide dummy values for now or adjust the frontend to send them
      await User.findOneAndUpdate(
        { email },
        { $set: { email, name: email.split("@")[0], phone: "01234567890", password: "defaultPass123!" } }, // Dummy values
        { upsert: true, new: true }
      );
      broadcastUserList(email);
    } catch (err) {
      console.error(`❌ Error registering user ${email}:`, err);
    }
  });

  socket.on("sendConnectionRequest", async ({ from, to }) => {
    await User.findOneAndUpdate(
      { email: to },
      { $addToSet: { pendingRequests: from } }
    );
    if (users[to]) {
      io.to(users[to]).emit("connectionRequest", { from });
    }
  });

  socket.on("acceptConnection", async ({ from, to }) => {
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
  });

  socket.on("loadMessages", async ({ sender, receiver }) => {
    const messages = await Message.find({
      $or: [
        { sender, receiver },
        { sender: receiver, receiver: sender },
      ],
    }).sort({ timestamp: 1 });
    socket.emit("previousMessages", messages);
  });

  socket.on("sendMessage", async (data) => {
    const { sender, receiver, message } = data;
    const senderUser = await User.findOne({ email: sender });
    if (!senderUser || !senderUser.connections.includes(receiver)) {
      socket.emit("error", "You must be connected to send messages.");
      return;
    }
    const newMessage = new Message({ sender, receiver, message });
    await newMessage.save();
    if (users[receiver]) {
      io.to(users[receiver]).emit("receiveMessage", newMessage);
    }
    socket.emit("receiveMessage", newMessage);
  });

  socket.on("deleteMessage", async ({ messageId }) => {
    await Message.findByIdAndDelete(messageId);
    io.emit("messageDeleted", { messageId });
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

server.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
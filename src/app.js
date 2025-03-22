const express = require("express");
const dotenv = require("dotenv").config();
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
const http = require("http");
const { Server } = require("socket.io");

const connectToDB = require("./config/db");
const initializePassport = require("./config/passport");
const socketService = require("./services/socketService");
const routes = require("./routes");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const port = process.env.PORT || 4000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));
app.use(cors());
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" },
  })
);
initializePassport(app);

// Routes
app.use("/auth", routes.authRoutes);
app.use("/users", routes.userRoutes);
app.use("/api/appointments", routes.appointmentRoutes);

// View Routes
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "views/index.html"))
);
app.get("/chat", (req, res) =>
  res.sendFile(path.join(__dirname, "views/chat.html"))
);
app.get("/login", (req, res) =>
  res.sendFile(path.join(__dirname, "views/login.html"))
);
app.get("/profile", (req, res) =>
  res.sendFile(path.join(__dirname, "views/profile.html"))
);
app.get("/login.html", (req, res) =>
  res.sendFile(path.join(__dirname, "views/login.html"))
);

// Error Handling
app.use(require("./middleware/logger"));
app.use(require("./middleware/errorHandler").notFound);
app.use(require("./middleware/errorHandler").errorHandler);

// Initialize Server
(async () => {
  try {
    await connectToDB();
    console.log("✅ Database connected successfully");

    socketService.initialize(io);

    server.listen(port, () => {
      console.log(`🚀 Server running on http://localhost:${port}`);
    });
  } catch (err) {
    console.error("❌ Failed to connect to database:", err);
    process.exit(1);
  }
})();

module.exports = app;

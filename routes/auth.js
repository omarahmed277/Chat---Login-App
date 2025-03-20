const express = require("express");
const router = express.Router();
const joi = require("joi");
const bcrypt = require("bcrypt");
const asynchandler = require("express-async-handler");


const {
  User,
  validateSignupUser,
  validateLoginUser,
} = require("../models/User");

router.post("/signup", async (req, res) => {
  console.log("Incoming request:", req.body);

  const { error } = validateSignupUser(req.body);
  if (error) {
    console.log("Validation Errors:", error.details);
    return res.status(400).json({
      errors: error.details.map((err) => ({
        path: err.path[0],
        msg: err.message,
      })),
    });
  }

  try {
    const user = new User({
      name: req.body.name,
      phone: req.body.phone,
      email: req.body.email,
      password: req.body.password,
      age: req.body.age,
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);

    await user.save();
    const token = user.generateToken();
    const { password, ...data } = user._doc;

    console.log("User saved successfully");
    res.status(200).json({ ...data, token, message: "SignUp Successful" });
  } catch (err) {
    if (err.code === 11000) {
      console.log("Duplicate Email Error");
      return res
        .status(400)
        .json({ errors: [{ path: "email", msg: "Email already exists" }] });
    }
    console.error("Error saving user:", err.message);
    res.status(500).json({ error: "An error occurred while saving the user." });
  }
});

// In your auth router
router.get("/check", (req, res) => {
  if (req.isAuthenticated()) {
    console.log("✅ Auth check passed for:", req.user.email);
    res.json({ authenticated: true, email: req.user.email });
  } else {
    console.log("⚠️ Auth check failed: User not authenticated");
    res.status(401).json({ authenticated: false });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log("⚠️ Login failed: User not found for email:", email);
      return res.status(400).json({ errors: [{ path: "email", msg: "User not found" }] });
    }

    if (!user.password) {
      console.log("⚠️ Login failed: No password set for:", email);
      return res.status(400).json({ errors: [{ path: "password", msg: "No password set. Use Google/LinkedIn or set a password." }] });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("⚠️ Login failed: Incorrect password for:", email);
      return res.status(400).json({ errors: [{ path: "password", msg: "Incorrect password" }] });
    }

    req.login(user, (err) => {
      if (err) {
        console.error("❌ Error logging in user:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
      console.log("✅ Local login successful for:", email);
      if (user.profileCompleted) {
        return res.json({ success: true, redirect: "/profile" });
      } else {
        return res.json({ success: true, redirect: "/auth/complete-profile" });
      }
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
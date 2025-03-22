const express = require("express");
const router = express.Router();
const passport = require("passport");
const bcrypt = require("bcrypt");
const {
  User,
  validateSignupUser,
  validateLoginUser,
} = require("../models/User");

router.post("/signup", async (req, res) => {
  const { error } = validateSignupUser(req.body);
  if (error) {
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

    res.status(200).json({ ...data, token, message: "SignUp Successful" });
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ errors: [{ path: "email", msg: "Email already exists" }] });
    }
    res.status(500).json({ error: "An error occurred while saving the user." });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ errors: [{ path: "email", msg: "User not found" }] });
    }

    if (!user.password) {
      return res.status(400).json({
        errors: [
          {
            path: "password",
            msg: "No password set. Use Google/LinkedIn or set a password.",
          },
        ],
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ errors: [{ path: "password", msg: "Incorrect password" }] });
    }

    req.login(user, (err) => {
      if (err)
        return res.status(500).json({ message: "Internal server error" });
      if (user.profileCompleted) {
        return res.json({ success: true, redirect: "/profile" });
      } else {
        return res.json({ success: true, redirect: "/auth/complete-profile" });
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/check", (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ authenticated: true, email: req.user.email });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  (req, res) => {
    if (req.user.profileCompleted) {
      res.redirect("/profile");
    } else {
      res.redirect("/auth/complete-profile");
    }
  }
);

router.get("/linkedin", passport.authenticate("openidconnect"));

router.get(
  "/linkedin/callback",
  passport.authenticate("openidconnect", { failureRedirect: "/login.html" }),
  (req, res) => {
    if (req.user.profileCompleted) {
      res.redirect("/profile");
    } else {
      res.redirect("/auth/complete-profile");
    }
  }
);

router.get("/complete-profile", (req, res) => {
  if (!req.isAuthenticated()) return res.redirect("/login.html");
  if (!req.user.googleId && !req.user.linkedinId)
    return res.redirect("/profile");
  if (req.user.profileCompleted) return res.redirect("/profile");
  res.sendFile("complete-profile.html", { root: "views" });
});

router.post("/complete-profile", async (req, res) => {
  if (!req.isAuthenticated())
    return res.status(401).json({ message: "Not authenticated" });
  if (!req.user.googleId && !req.user.linkedinId)
    return res.status(403).json({ message: "Profile completion not required" });

  const { phone, password } = req.body;
  if (!phone || !password)
    return res.status(400).json({ message: "Phone and password are required" });
  if (phone.length !== 11 || !/^\d{11}$/.test(phone))
    return res.status(400).json({ message: "Phone must be 11 digits" });
  if (password.length < 8)
    return res
      .status(400)
      .json({ message: "Password must be at least 8 characters" });

  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.phone = phone;
    user.password = await bcrypt.hash(password, 10);
    user.profileCompleted = true;
    await user.save();

    res.json({ success: true, redirect: "/profile" });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error: " + err.message });
  }
});

router.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) console.error("❌ Logout error:", err);
    res.redirect("/login.html");
  });
});

module.exports = router;

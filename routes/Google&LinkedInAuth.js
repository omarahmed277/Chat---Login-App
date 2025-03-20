const express = require("express");
const dotenv = require("dotenv").config();
const router = express.Router();
const passport = require("passport");
const session = require("express-session");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const OpenIDConnectStrategy = require("passport-openidconnect").Strategy;
const { User } = require("../models/User");
const bcrypt = require("bcrypt");

// Session Middleware
router.use(
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

router.use(passport.initialize());
router.use(passport.session());

// Google Authentication Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:4000/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({
          $or: [{ googleId: profile.id }, { email: profile.emails[0].value }],
        });

        if (!user) {
          user = new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id,
            connections: [],
            pendingRequests: [],
            profileCompleted: false, // Google users start incomplete
          });
          await user.save();
          console.log("🆕 New Google user saved:", user.email);
        } else if (!user.googleId) {
          user.googleId = profile.id;
          await user.save();
          console.log("🔗 Linked Google ID to existing user:", user.email);
        } else {
          console.log("👤 Existing Google user logged in:", user.email);
        }

        return done(null, {
          _id: user._id,
          email: user.email,
          name: user.name,
          googleId: user.googleId,
          profileCompleted: user.profileCompleted,
        });
      } catch (err) {
        console.error("❌ Google Strategy Error:", err);
        return done(err, null);
      }
    }
  )
);

// LinkedIn Authentication Strategy
passport.use(
  new OpenIDConnectStrategy(
    {
      issuer: "https://www.linkedin.com",
      authorizationURL: "https://www.linkedin.com/oauth/v2/authorization",
      tokenURL: "https://www.linkedin.com/oauth/v2/accessToken",
      userInfoURL: "https://api.linkedin.com/v2/userinfo",
      clientID: process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
      callbackURL: "http://localhost:4000/auth/linkedin/callback",
      scope: ["openid", "profile", "email"],
    },
    async (issuer, sub, profile, jwtClaims, accessToken, refreshToken, params, done) => {
      try {
        let user = await User.findOne({
          $or: [{ linkedinId: profile.id }, { email: profile.emails[0].value }],
        });

        if (!user) {
          user = new User({
            name: profile.displayName || `${profile.name.givenName} ${profile.name.familyName}`,
            email: profile.emails[0].value,
            linkedinId: profile.id,
            connections: [],
            pendingRequests: [],
            profileCompleted: false, // LinkedIn users start incomplete
          });
          await user.save();
          console.log("🆕 New LinkedIn user saved:", user.email);
        } else if (!user.linkedinId) {
          user.linkedinId = profile.id;
          await user.save();
          console.log("🔗 Linked LinkedIn ID to existing user:", user.email);
        } else {
          console.log("👤 Existing LinkedIn user logged in:", user.email);
        }

        return done(null, {
          _id: user._id,
          email: user.email,
          name: user.name,
          linkedinId: user.linkedinId,
          profileCompleted: user.profileCompleted,
          id_token: params.id_token,
        });
      } catch (err) {
        console.error("❌ LinkedIn Strategy Error:", err);
        return done(err, null);
      }
    }
  )
);

// Serialize and Deserialize User
passport.serializeUser((user, done) => {
  console.log("🔒 Serializing user:", user.email);
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    if (!user) {
      console.warn("⚠️ User not found during deserialization:", id);
      return done(null, false);
    }
    console.log("🔓 Deserialized user:", user.email);
    done(null, {
      _id: user._id,
      email: user.email,
      name: user.name,
      googleId: user.googleId,
      linkedinId: user.linkedinId,
      profileCompleted: user.profileCompleted,
    });
  } catch (err) {
    console.error("❌ Deserialization error:", err);
    done(err, null);
  }
});

// Middleware to check profile completion (only for Google/LinkedIn)
const ensureProfileCompleted = (req, res, next) => {
  if (!req.isAuthenticated()) {
    console.log("⚠️ Unauthenticated request to protected route");
    return res.redirect("/login.html");
  }

  // Only enforce profile completion for Google or LinkedIn users
  if ((req.user.googleId || req.user.linkedinId) && !req.user.profileCompleted) {
    console.log("🔍 Redirecting Google/LinkedIn user to complete profile:", req.user.email);
    return res.redirect("/auth/complete-profile");
  }

  console.log("✅ User authenticated, proceeding:", req.user.email);
  next();
};

// Local Login Route
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
      return res.json({ success: true, redirect: "/profile" }); // Local users go straight to profile
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Routes
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  (req, res) => {
    console.log("✅ Google callback successful for:", req.user.email);
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
    console.log("✅ LinkedIn callback successful for:", req.user.email);
    if (req.user.profileCompleted) {
      res.redirect("/profile");
    } else {
      res.redirect("/auth/complete-profile");
    }
  }
);

router.get("/complete-profile", (req, res) => {
  if (!req.isAuthenticated()) {
    console.log("⚠️ Unauthenticated access to complete-profile");
    return res.redirect("/login.html");
  }

  // Only Google or LinkedIn users with incomplete profiles should see this
  if (!req.user.googleId && !req.user.linkedinId) {
    console.log("✅ Local user, skipping complete-profile:", req.user.email);
    return res.redirect("/profile");
  }

  if (req.user.profileCompleted) {
    console.log("✅ Profile already completed, redirecting to profile:", req.user.email);
    return res.redirect("/profile");
  }

  console.log("📝 Serving complete-profile page for Google/LinkedIn user:", req.user.email);
  res.sendFile("complete-profile.html", { root: "views" });
});

router.post("/complete-profile", async (req, res) => {
  if (!req.isAuthenticated()) {
    console.log("⚠️ Unauthenticated POST to complete-profile");
    return res.status(401).json({ message: "Not authenticated" });
  }

  // Only allow Google/LinkedIn users to complete profile
  if (!req.user.googleId && !req.user.linkedinId) {
    console.log("⚠️ Local user attempted POST to complete-profile:", req.user.email);
    return res.status(403).json({ message: "Profile completion not required for local users" });
  }

  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ message: "Phone and password are required" });
  }

  if (phone.length !== 11 || !/^\d{11}$/.test(phone)) {
    return res.status(400).json({ message: "Phone must be 11 digits" });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      console.warn("⚠️ User not found:", req.user._id);
      return res.status(404).json({ message: "User not found" });
    }

    user.phone = phone;
    user.password = await bcrypt.hash(password, 10);
    user.profileCompleted = true;
    await user.save();

    console.log("✅ User profile completed:", user.email);
    res.json({ success: true, redirect: "/profile" });
  } catch (err) {
    console.error("❌ Error updating user profile:", err);
    res.status(500).json({ message: "Internal Server Error: " + err.message });
  }
});

router.get("/profile", ensureProfileCompleted, (req, res) => {
  console.log("✅ Serving profile page for:", req.user.email);
  res.sendFile("profile.html", { root: "views" });
});

router.get("/check", (req, res) => {
  if (req.isAuthenticated()) {
    console.log("✅ Auth check passed for:", req.user.email);
    res.json({ authenticated: true, email: req.user.email });
  } else {
    console.log("⚠️ Auth check failed: User not authenticated");
    res.status(401).json({ authenticated: false });
  }
});

router.get("/profile/data", ensureProfileCompleted, (req, res) => {
  console.log("✅ Serving profile data for:", req.user.email);
  res.json({
    name: req.user.name,
    email: req.user.email,
    phone: req.user.phone,
    createdAt: req.user.createdAt,
    photoUrl: req.user.photoUrl || null,
  });
});

router.get("/logout", (req, res) => {
  console.log("🔒 Logging out user:", req.user?.email || "unknown");
  req.logout((err) => {
    if (err) console.error("❌ Logout error:", err);
    res.redirect("/login.html");
  });
});

module.exports = router;
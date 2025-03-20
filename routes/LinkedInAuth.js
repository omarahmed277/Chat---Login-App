const express = require("express");
const dotenv = require("dotenv").config();
const router = express.Router();
const session = require("express-session");
const passport = require("passport");
const OpenIDConnectStrategy = require("passport-openidconnect").Strategy;

// Linked in Authentication
router.use(
  session({
    secret: process.env.LINKEDIN_CLIENT_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
router.use(passport.initialize());
router.use(passport.session());

passport.use(
  new OpenIDConnectStrategy(
    {
      issuer: "https://www.linkedin.com",
      authorizationURL: "https://www.linkedin.com/oauth/v2/authorization",
      tokenURL: "https://www.linkedin.com/oauth/v2/accessToken",
      userInfoURL: "https://api.linkedin.com/v2/userinfo",
      clientID: process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
      callbackURL: process.env.LINKEDIN_CALLBACK_URL,
      scope: ["openid", "profile", "email"],
    },
    async (issuer, sub, profile, jwtClaims, accessToken, refreshToken, params, done) => {
      try {
        // Check if user exists by LinkedIn ID or email
        let user = await User.findOne({
          $or: [{ linkedinId: profile.id }, { email: profile.emails[0].value }],
        });

        if (!user) {
          // Create a new user for LinkedIn login
          user = new User({
            name: profile.displayName || `${profile.name.givenName} ${profile.name.familyName}`,
            email: profile.emails[0].value,
            linkedinId: profile.id,
            // Phone and password are not provided by LinkedIn, so left unset
            connections: [],
            pendingRequests: [],
          });
          await user.save();
          console.log("🆕 New LinkedIn user saved to database:", user.email);
        } else {
          // Update existing user if LinkedIn ID is missing
          if (!user.linkedinId) {
            user.linkedinId = profile.id;
            await user.save();
            console.log("🔗 Linked LinkedIn ID to existing user:", user.email);
          } else {
            console.log("👤 Existing LinkedIn user logged in:", user.email);
          }
        }

        return done(null, user);
      } catch (err) {
        console.error("❌ Error saving user to database:", err);
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

router.get("/linkedin", passport.authenticate("openidconnect"));

router.get(
  "/linkedin/callback",
  (req, res, next) => {
    console.log("🔄 LinkedIn Callback Triggered");
    next();
  },
  (req, res, next) => {
    passport.authenticate("openidconnect", (err, user, info) => {
      console.log("🔍 Inside Passport Authenticate");

      if (err) {
        console.error("❌ Authentication Error:", err);
        return res.status(500).send("Authentication failed: " + err.message);
      }

      if (!user) {
        console.warn("⚠️ No user data received. Info:", info);
        return res.redirect("/failure");
      }

      console.log("✅ Authentication Successful. Logging in user...");

      req.logIn(user, (err) => {
        if (err) {
          console.error("❌ Login Error:", err);
          return res.status(500).send("Login error.");
        }
        console.log(
          "🔑 User Logged In Successfully. Redirecting to Profile..."
        );
        return res.redirect("/profile");
      });
    })(req, res, next); // ✅ Pass req, res, next manually
  }
);

router.get("/logout", (req, res) => {
  req.logout(() => res.redirect("/"));
});

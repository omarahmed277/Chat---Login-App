const express = require("express");
const dotenv = require("dotenv").config();
const router = express.Router();

// Passport and session middleware
const passport = require("passport");
const session = require("express-session");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const OpenIDConnectStrategy = require("passport-openidconnect").Strategy;

// using session
router.use(
  session({ secret: "secret", resave: false, saveUninitialized: true })
);
router.use(passport.initialize()); //initialize passport
router.use(passport.session()); //use passport session

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.CALLBACK_URL,
    },
    function (accessToken, refreshToken, profile, done) {
      return done(null, profile);
    }
  )
);

passport.serializeUser(function (user, done) {
  done(null, user);
}); //serialize user

passport.deserializeUser(function (obj, done) {
  done(null, obj);
}); //deserialize user

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect("/profile");
  }
);
// --------------------------------------------------------------------------------------------------------//
// Linked in Authentication
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
    (
      issuer,
      sub,
      profile,
      jwtClaims,
      accessToken,
      refreshToken,
      params,
      done
    ) => {
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

router.get("/linkedin", passport.authenticate("openidconnect"));

router.get(
  "/linkedin/callback",
  passport.authenticate("openidconnect", { failureRedirect: "/" }),
  (req, res) => {
    console.log("ID Token:", req.user.id_token); // Log the received ID Token
    res.redirect("/profile");
  }
);

router.get("/logout", (req, res) => {
  req.logout(() => res.redirect("/"));
});

module.exports = router;
// router.get(
//   "/linkedin/callback",
//   (req, res, next) => {
//     console.log("🔄 LinkedIn Callback Triggered");
//     next();
//   },
//   (req, res, next) => {
//     passport.authenticate("openidconnect", (err, user, info) => {
//       console.log("🔍 Inside Passport Authenticate");

//       if (err) {
//         console.error("❌ Authentication Error:", err);
//         return res.status(500).send("Authentication failed: " + err.message);
//       }

//       if (!user) {
//         console.warn("⚠️ No user data received. Info:", info);
//         return res.redirect("/failure");
//       }

//       console.log("✅ Authentication Successful. Logging in user...");

//       req.logIn(user, (err) => {
//         if (err) {
//           console.error("❌ Login Error:", err);
//           return res.status(500).send("Login error.");
//         }
//         console.log(
//           "🔑 User Logged In Successfully. Redirecting to Profile..."
//         );
//         return res.redirect("/profile");
//       });
//     })(req, res, next); // ✅ Pass req, res, next manually
//   }
// );

// router.get("/profile", (req, res) => {
//   if (!req.isAuthenticated()) return res.redirect("/");
//   res.json(req.user);
// });

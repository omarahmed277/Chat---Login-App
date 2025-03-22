const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const OpenIDConnectStrategy = require("passport-openidconnect").Strategy;
const { User } = require("../models/User");

module.exports = (app) => {
  app.use(passport.initialize());
  app.use(passport.session());

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
              profileCompleted: false,
            });
            await user.save();
          } else if (!user.googleId) {
            user.googleId = profile.id;
            await user.save();
          }

          return done(null, {
            _id: user._id,
            email: user.email,
            name: user.name,
            googleId: user.googleId,
            profileCompleted: user.profileCompleted,
          });
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );

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
      async (
        issuer,
        sub,
        profile,
        jwtClaims,
        accessToken,
        refreshToken,
        params,
        done
      ) => {
        try {
          let user = await User.findOne({
            $or: [
              { linkedinId: profile.id },
              { email: profile.emails[0].value },
            ],
          });

          if (!user) {
            user = new User({
              name:
                profile.displayName ||
                `${profile.name.givenName} ${profile.name.familyName}`,
              email: profile.emails[0].value,
              linkedinId: profile.id,
              connections: [],
              pendingRequests: [],
              profileCompleted: false,
            });
            await user.save();
          } else if (!user.linkedinId) {
            user.linkedinId = profile.id;
            await user.save();
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
          return done(err, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      if (!user) return done(null, false);
      done(null, {
        _id: user._id,
        email: user.email,
        name: user.name,
        googleId: user.googleId,
        linkedinId: user.linkedinId,
        profileCompleted: user.profileCompleted,
      });
    } catch (err) {
      done(err, null);
    }
  });
};

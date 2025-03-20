const express = require("express");
const router = express.Router();
const joi = require("joi");
const { models } = require("mongoose");
const path = require("path");

// get request for signup
router.get("/SignUp", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/index.html"));
});

//get request for signin
router.get("/Login", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/login.html"));
});

router.get("/Profile", (req, res) => {
  if (!req.isAuthenticated()) return res.redirect("/");
  res.sendFile(path.join(__dirname, "../views/profile.html"));
  res.json(req.user);
});

module.exports = router;

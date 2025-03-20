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

router.post(
  "/login",
  asynchandler(async (req, res) => {
    console.log("Incoming request:", req.body);

    const { error } = validateLoginUser(req.body);
    const { email, password } = req.body;

    if (error) {
      console.log("Validation Errors:", error.details);
      return res.status(400).json({
        errors: error.details.map((err) => ({
          path: err.path[0],
          msg: err.message,
        })),
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found");
      return res.status(400).json({
        errors: [{ path: "email", msg: "Invalid Email" }],
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.log("Invalid password");
      return res.status(400).json({
        errors: [{ path: "password", msg: "Invalid Password" }],
      });
    }

    const token = user.generateToken()
    console.log("User Logged successfully");

    const { password: pwd, ...data } = user._doc;
    res.status(200).json({ ...data, token, message: "Login Successful" });
  })
);

module.exports = router;
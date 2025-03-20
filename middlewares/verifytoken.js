const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  console.log("Full Authorization Header:", authHeader); // Log the entire header
  const token = authHeader && authHeader.split(" ")[1]; // Extract token after "Bearer"
  console.log("Extracted Token:", token); // Log the extracted token

  if (!token) {
    return res.status(401).json({ message: "No Token Provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.user = decoded; // { _id, name, email, isAdmin }
    console.log("Decoded User:", req.user);
    next();
  } catch (error) {
    console.error("JWT Verification Error:", error.message);
    res.status(401).json({ message: "Invalid Token" });
  }
}

function verifyTokenAndAuthorization(req, res, next) {
  verifyToken(req, res, () => {
    console.log("User ID:", req.user._id, "Param ID:", req.params.id);
    if (req.user._id == req.params.id || req.user.isAdmin) {
      next();
    } else {
      return res
        .status(403)
        .json({ message: "You are not allowed to do this action" });
    }
  });
}

function verifyTokenAndAdmin(req, res, next) {
  verifyToken(req, res, () => {
    console.log("User:", req.user);
    if (!req.user) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    if (req.user.isAdmin) {
      next();
    } else {
      return res
        .status(403)
        .json({ message: "Only admins can perform this action" });
    }
  });
}

module.exports = {
  verifyToken,
  verifyTokenAndAuthorization,
  verifyTokenAndAdmin,
};
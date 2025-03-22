const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { User, validateUpdateUser } = require("../models/User");
const {
  verifyTokenAndAuthorization,
  verifyTokenAndAdmin,
} = require("../middleware/verifyToken");

router.put("/:id", verifyTokenAndAuthorization, async (req, res) => {
  if (req.user._id !== req.params.id) {
    return res.status(403).json({ message: "You cannot update this profile" });
  }

  const { error } = validateUpdateUser(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  if (req.body.password) {
    const salt = await bcrypt.genSalt(10);
    req.body.password = await bcrypt.hash(req.body.password, salt);
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        name: req.body.name,
        phone: req.body.phone,
        email: req.body.email,
        password: req.body.password,
        age: req.body.age,
      },
    },
    { new: true }
  ).select("-password");
  res
    .status(200)
    .json({ message: "User updated successfully", data: updatedUser });
});

router.get("/", verifyTokenAndAdmin, async (req, res) => {
  const users = await User.find().select("-password");
  res.status(200).json({ message: "Users fetched successfully", data: users });
});

router.get("/:id", verifyTokenAndAuthorization, async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");
  if (user) {
    res.status(200).json({ message: "User fetched successfully", data: user });
  } else {
    res.status(404).json({ message: "User Not Found" });
  }
});

router.delete("/:id", verifyTokenAndAuthorization, async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");
  if (user) {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "User deleted successfully" });
  } else {
    res.status(404).json({ message: "User Not Found" });
  }
});

module.exports = router;

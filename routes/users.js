const express = require("express");
const router = express.Router();
const asynchandler = require("express-async-handler");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User, validateUpdateUser } = require("../models/User");
const {
  verifyTokenAndAuthorization,
  verifyTokenAndAdmin,
} = require("../middlewares/verifytoken");

/**
 * @desc Update user
 * @route /users/:id
 * @method put
 * @access private
 */
router.put(
  "/:id",
  verifyTokenAndAuthorization,
  asynchandler(async (req, res) => {
    if (req.user._id !== req.params.id) {
      return res
        .status(403) //forbidden
        .json({ message: "You cannot update this profile" });
    }

    const { error } = validateUpdateUser(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      req.body.password = await bcrypt.hash(req.body.password, salt);
    }

    const updateduser = await User.findByIdAndUpdate(
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
      .json({ message: "User updated successfully", data: updateduser });
  })
);

/**
 * @desc Get all users
 * @route /users/
 * @method get
 * @access private
 */
router.get(
  "/",
  verifyTokenAndAdmin,
  asynchandler(async (req, res) => {
    const users = await User.find().select("-password");
    res
      .status(200)
      .json({ message: "Users fetched successfully", data: users });
  })
);

/**
 * @desc Get user by id
 * @route /users/:id
 * @method get
 * @access private (only admin and user himself)
 */
router.get(
  "/:id",
  verifyTokenAndAuthorization,
  asynchandler(async (req, res) => {
    const user = await User.findById(req.params.id).select("-password");
    if (user) {
      res
        .status(200)
        .json({ message: "User fetched successfully", data: user });
    } else {
      res.status(404).json({ message: "user Not Found" });
    }
  })
);


/**
 * @desc delete user by id
 * @route /users/:id
 * @method delete
 * @access private (only admin and user himself)
 */
router.delete(
  "/:id",
  verifyTokenAndAuthorization,
  asynchandler(async (req, res) => {
    const user = await User.findById(req.params.id).select("-password");
    if (user) {
      await User.findByIdAndDelete(req.params.id);
      res
        .status(200)
        .json({ message: "User deleted successfully"});
    } else {
      res.status(404).json({ message: "user Not Found" });
    }
  })
);

module.exports = router;

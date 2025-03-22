// User model
const mongoose = require("mongoose");
const joi = require("joi");
const jwt = require("jsonwebtoken");

const Schema = mongoose.Schema;
const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      minlength: 3,
      maxlength: 30,
      trim: true,
    },
    phone: {
      type: String,
      required: false,
      minlength: 11,
      maxlength: 11,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      email: true,
      unique: true,
    },
    password: {
      type: String,
      minlength: 8,
      trim: true,
      required: false,
    },
    age: {
      type: Number,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    connections: [{ type: String }],
    pendingRequests: [{ type: String }],
    linkedinId: {
      // Added for LinkedIn users
      type: String,
      unique: true,
      sparse: true, // Allows null values while maintaining uniqueness
    },
    googleId: {
      // Added for Google users
      type: String,
      unique: true,
      sparse: true, // Allows null values while maintaining uniqueness
    },
    profileCompleted: {
      type: Boolean,
      default: false,
    },
  },

  { timestamps: true }
);

// generate Token
userSchema.methods.generateToken = function (params) {
  return jwt.sign(
    { _id: this._id, name: this.name, isAdmin: this.isAdmin },
    process.env.JWT_SECRET_KEY,
    { expiresIn: "1h" }
  );
};

const User = mongoose.model("User", userSchema);

// validate signup data
function validateSignupUser(User) {
  const schema = joi.object({
    name: joi.string().min(3).max(30).required().messages({
      "string.base": `name should be a type of 'text'`,
      "string.empty": `name cannot be an empty field`,
      "string.min": `name should have a minimum length of {#limit}`,
      "string.max": `name should have a maximum length of {#limit}`,
      "any.required": `name is a required field`,
    }),
    phone: joi.string().min(11).max(11).required().messages({
      "string.base": `phone should be a type of 'text'`,
      "string.empty": `phone cannot be an empty field`,
      "string.min": `phone should have a minimum length of {#limit}`,
      "string.max": `phone should have a maximum length of {#limit}`,
      "any.required": `phone is a required field`,
    }),
    email: joi.string().email().required().messages({
      "string.empty": `email cannot be an empty field`,
      "string.email": `email should be a valid email`,
      "any.required": `email is a required field`,
    }),
    password: joi.string().min(8).required().messages({
      "string.empty": `password cannot be an empty field`,
      "string.min": `password should have a minimum length of {#limit}`,
      "any.required": `password is a required field`,
    }),
    confirm_password: joi
      .string()
      .valid(joi.ref("password"))
      .required()
      .messages({
        "string.empty": `confirm_password cannot be an empty field`,
        "any.only": `confirm_password should match password`,
        "any.required": `confirm_password is a required field`,
      }),
    age: joi.number().min(18).required().messages({
      "number.base": `age should be a type of 'number'`,
      "number.empty": `age cannot be an empty field`,
      "number.min": `age should be greater than 18`,
      "any.required": `age is a required field`,
    }),
  });

  return schema.validate(User, { abortEarly: false });
}

//validate login data
function validateLoginUser(User) {
  const schema = joi.object({
    email: joi.string().email().required().messages({
      "string.empty": `email cannot be an empty field`,
    }),
    password: joi.string().required().messages({
      "string.empty": `password cannot be an empty field`,
    }),
  });

  return schema.validate(User, { abortEarly: false });
}

//validate update data
function validateUpdateUser(User) {
  const schema = joi.object({
    name: joi.string().min(3).max(30).messages({
      "string.base": `name should be a type of 'text'`,
      "string.empty": `name cannot be an empty field`,
      "string.min": `name should have a minimum length of {#limit}`,
      "string.max": `name should have a maximum length of {#limit}`,
    }),
    email: joi.string().email().messages({
      "string.empty": `email cannot be an empty field`,
      "string.email": `email should be a valid email`,
    }),
    password: joi.string().min(8).messages({
      "string.empty": `password cannot be an empty field`,
      "string.min": `password should have a minimum length of {#limit}`,
    }),
    phone: joi.string().min(11).max(11).messages({
      "string.base": `phone should be a type of 'text'`,
      "string.empty": `phone cannot be an empty field`,
      "string.min": `phone should have a minimum length of {#limit}`,
      "string.max": `phone should have a maximum length of {#limit}`,
    }),
    age: joi.number().min(18).messages({
      "number.base": `age should be a type of 'number'`,
      "number.empty": `age cannot be an empty field`,
      "number.min": `age should be greater than 18`,
    }),
  });

  return schema.validate(User, { abortEarly: false });
}
module.exports = {
  User,
  validateSignupUser,
  validateLoginUser,
  validateUpdateUser,
};

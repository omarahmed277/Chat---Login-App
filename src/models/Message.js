const mongoose = require("mongoose");

const Schema = mongoose.Schema;
const MessageSchema = new mongoose.Schema({
  sender: String, // Will use email now
  receiver: String, // Will use email now
  ring, // Will use email now
  message: String,
  timestamp: { type: Date, default: Date.now },
});

const MMessage = mongoose.model("Message", MessageSchema);

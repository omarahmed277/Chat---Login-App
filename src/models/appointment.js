const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  menteeEmail: { type: String, required: true },
  appointmentTime: { type: String, required: true },
  meetLink: { type: String, required: true },
});

module.exports = mongoose.model("Appointment", appointmentSchema);

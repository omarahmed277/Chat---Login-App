const express = require("express");
const { bookAppointment } = require("../controllers/appointmentController");

const router = express.Router();

router.post("/book", async (req, res) => {
  const { menteeEmail, time } = req.body;

  try {
    const meetLink = await bookAppointment(menteeEmail, time);
    res.json({ success: true, meetLink });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// router.get("/", getAppointments);

module.exports = router;

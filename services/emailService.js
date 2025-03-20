const nodemailer = require("nodemailer");

exports.sendEmail = async (menteeEmail, meetLink, time) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL,
    to: menteeEmail,
    subject: "Appointment Confirmation",
    html: `<p>Your appointment is scheduled.</p>
           <p><strong>Date:</strong> ${time}</p>
           <p><strong>Google Meet Link:</strong> <a href="${meetLink}">${meetLink}</a></p>`,
  };

  await transporter.sendMail(mailOptions);
};

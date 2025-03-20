const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

async function bookAppointment(menteeEmail, appointmentTime) {
  try {
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // إنشاء حدث في Google Calendar
    const event = {
      summary: " Mentoring Session",
      description: "One-on-one mentorship session",
      start: { dateTime: appointmentTime, timeZone: "Africa/Cairo" },
      end: {
        dateTime: new Date(
          new Date(appointmentTime).getTime() + 60 * 60 * 1000
        ).toISOString(),
        timeZone: "Africa/Cairo",
      },
      attendees: [{ email: menteeEmail }],
      conferenceData: {
        createRequest: {
          requestId: "meet-" + Date.now(),
        },
      },
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
      conferenceDataVersion: 1,
    });

    const meetLink = response.data.hangoutLink;

    // إرسال إيميل تأكيد
    await sendEmail(menteeEmail, appointmentTime, meetLink);

    console.log("Appointment booked successfully:", meetLink);
    return meetLink;
  } catch (error) {
    console.error("Error booking appointment:", error);
    throw new Error("Failed to book appointment.");
  }
}

async function sendEmail(email, appointmentTime, meetLink) {
  try {
    const formattedTime = new Date(appointmentTime).toLocaleTimeString(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }
    );

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Use App Password here if needed
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Appointment Confirmation",
      html: `<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9f9f9; margin: 0; padding: 0;">
    <div style="max-width: 600px; margin: 20px auto; padding: 20px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #2c3e50; font-size: 24px; margin-bottom: 10px;">Your Appointment is Confirmed!</h1>
            <p style="font-size: 16px; color: #555; margin: 0;">We’re excited to have you join us for your session.</p>
        </div>

        <!-- Appointment Details -->
        <div style="background-color: #f5f7fa; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <p style="font-size: 16px; margin: 0 0 10px;"><strong>Appointment Time:</strong> ${formattedTime}</p>
            <p style="font-size: 16px; margin: 0;"><strong>Join Google Meet:</strong> <a href="${meetLink}" style="color: #3498db; text-decoration: none;">${meetLink}</a></p>
        </div>

        <!-- Call-to-Action Button -->
        <div style="text-align: center; margin-bottom: 20px;">
            <a href="${meetLink}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #3498db, #2980b9); color: #ffffff !important; text-decoration: none; border-radius: 4px; font-size: 16px; font-weight: bold;">Join Meeting</a>
        </div>

        <!-- Preparation Tips -->
        <div style="margin-bottom: 20px;">
            <p style="font-size: 16px; margin-bottom: 10px;"><strong>To make the most of your session:</strong></p>
            <ul style="font-size: 16px; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 8px;">Test your camera, microphone, and internet connection.</li>
                <li style="margin-bottom: 8px;">Join the meeting a few minutes early to avoid delays.</li>
                <li style="margin-bottom: 8px;">Prepare any questions or topics you’d like to discuss.</li>
            </ul>
        </div>

        <!-- Support Information -->
        <div style="background-color: #f5f7fa; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <p style="font-size: 16px; margin: 0;">Need help? Reach out to us at <a href="mailto:[support email]" style="color: #3498db; text-decoration: none;">[support email]</a> or call us at [contact number].</p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; font-size: 14px; color: #777;">
            <p style="margin: 0;">Best regards,</p>
            <p style="margin: 0;"><strong>[Omar Ahmed Abdelwareth]</strong><br>[CEO]</p>
        </div>
    </div>
</body>
`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.response);
  } catch (error) {
    console.error("❌ Error sending email:", error);
  }
}

module.exports = { bookAppointment };
/// -------------------------------------

// const { google } = require("googleapis");
// const nodemailer = require("nodemailer");
// const dotenv = require("dotenv");
// dotenv.config();

// const CLIENT_ID = process.env.CLIENT_ID;
// const CLIENT_SECRET = process.env.CLIENT_SECRET;
// const REDIRECT_URI = process.env.REDIRECT_URI;
// const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

// const oauth2Client = new google.auth.OAuth2(
//   CLIENT_ID,
//   CLIENT_SECRET,
//   REDIRECT_URI
// );

// oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

// async function bookAppointment(menteeEmail, appointmentTime) {
//   try {
//     const calendar = google.calendar({ version: "v3", auth: oauth2Client });

//     // إنشاء حدث في Google Calendar
//     const event = {
//       summary: "Mentorship Session",
//       description: "One-on-one mentorship session",
//       start: { dateTime: appointmentTime, timeZone: "Africa/Cairo" },
//       end: {
//         dateTime: new Date(
//           new Date(appointmentTime).getTime() + 60 * 60 * 1000
//         ).toISOString(),
//         timeZone: "Africa/Cairo",
//       },
//       attendees: [{ email: menteeEmail }],
//       conferenceData: {
//         createRequest: {
//           requestId: "meet-" + Date.now(),
//         },
//       },
//     };

//     const response = await calendar.events.insert({
//       calendarId: "primary",
//       resource: event,
//       conferenceDataVersion: 1,
//     });

//     const meetLink = response.data.hangoutLink;

//     // إرسال إيميل تأكيد
//     await sendEmail(menteeEmail, appointmentTime, meetLink);

//     console.log("Appointment booked successfully:", meetLink);
//     return meetLink;
//   } catch (error) {
//     console.error("Error booking appointment:", error);
//     throw new Error("Failed to book appointment.");
//   }
// }

// async function sendEmail(email, appointmentTime, meetLink) {
//   const transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//       user: process.env.EMAIL_USER,
//       pass: process.env.EMAIL_PASS,
//     },
//   });

//   const mailOptions = {
//     from: process.env.EMAIL_USER,
//     to: email,
//     subject: "Appointment Confirmation",
//     html: `<p>Your appointment is confirmed for ${appointmentTime}.</p>
//            <p>Join the Google Meet: <a href="${meetLink}">${meetLink}</a></p>`,
//   };

//   await transporter.sendMail(mailOptions);
//   console.log("Email sent successfully.");
// }

// module.exports = { bookAppointment };

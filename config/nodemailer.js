import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
dotenv.config();

// ==========================================
// SendGrid API Setup (Preferred for Vercel/Serverless)
// ==========================================
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log('✅ SendGrid API initialized');
}

// ==========================================
// Gmail SMTP Configuration (Fallback)
// ==========================================
const gmailConfig = {
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 15000,
};

let gmailTransporter = null;
if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
  gmailTransporter = nodemailer.createTransport(gmailConfig);
  console.log('✅ Gmail SMTP transporter created');
}

// Track which provider is working
let activeProvider = 'sendgrid-api';
let sendgridAvailable = !!SENDGRID_API_KEY;
let gmailAvailable = !!gmailTransporter;

// ==========================================
// Send Email Function with Automatic Fallback
// ==========================================
export const sendEmail = async (mailOptions) => {
  const senderEmail = process.env.SENDER_EMAIL || process.env.GMAIL_USER;
  const appName = process.env.APP_NAME || 'BinWise';

  console.log('📧 Starting email send...');
  console.log('   To:', mailOptions.to);
  console.log('   Subject:', mailOptions.subject);

  // ==========================================
  // Method 1: Try SendGrid API First (Best for Vercel)
  // ==========================================
  if (sendgridAvailable) {
    try {
      console.log('🚀 Trying SendGrid API...');
      
      const msg = {
        to: mailOptions.to,
        from: {
          email: senderEmail,
          name: appName
        },
        subject: mailOptions.subject,
        html: mailOptions.html,
      };

      const result = await sgMail.send(msg);
      
      console.log('✅ Email sent successfully via SendGrid API');
      console.log('   Message ID:', result[0]?.headers?.['x-message-id']);
      
      return { 
        success: true, 
        messageId: result[0]?.headers?.['x-message-id'],
        provider: 'SendGrid API' 
      };
    } catch (error) {
      console.error('❌ SendGrid API failed:', error.message);
      
      // Log detailed error for debugging
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Body:', error.response.body);
      }
      
      // If SendGrid fails, try Gmail as fallback
      console.log('🔄 Falling back to Gmail SMTP...');
    }
  }

  // ==========================================
  // Method 2: Try Gmail SMTP as Fallback
  // ==========================================
  if (gmailAvailable) {
    try {
      console.log('📤 Trying Gmail SMTP...');
      
      const info = await gmailTransporter.sendMail({
        from: `"${appName}" <${senderEmail}>`,
        ...mailOptions,
      });
      
      console.log('✅ Email sent via Gmail SMTP (fallback)');
      console.log('   Message ID:', info.messageId);
      
      activeProvider = 'gmail-smtp';
      return { 
        success: true, 
        messageId: info.messageId, 
        provider: 'Gmail SMTP' 
      };
    } catch (error) {
      console.error('❌ Gmail SMTP also failed:', error.message);
    }
  }

  // ==========================================
  // Both Methods Failed
  // ==========================================
  console.error('❌ All email providers failed');
  return { 
    success: false, 
    error: 'All email providers failed. Please check your configuration.' 
  };
};

// Helper to replace placeholders in email templates
export const prepareEmailTemplate = (template, replacements) => {
  let result = template;
  Object.keys(replacements).forEach(key => {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder, 'g'), replacements[key]);
  });
  return result;
};

// Verify configuration on startup
const verifyConfiguration = () => {
  console.log('\n🔧 Email Configuration Check:');
  console.log('   SendGrid API Key:', SENDGRID_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('   Gmail User:', process.env.GMAIL_USER ? '✅ Set' : '❌ Missing');
  console.log('   Gmail App Password:', process.env.GMAIL_APP_PASSWORD ? '✅ Set' : '❌ Missing');
  console.log('   Sender Email:', senderEmail ? '✅ Set' : '❌ Missing');
  
  if (!SENDGRID_API_KEY && !gmailTransporter) {
    console.error('\n⚠️  WARNING: No email providers configured!');
    console.error('   Please set either SendGrid API key or Gmail credentials.\n');
  } else {
    console.log('\n✅ Email system ready\n');
  }
};

verifyConfiguration();

export default { sendEmail, prepareEmailTemplate };
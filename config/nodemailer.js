import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// ==========================================
// Dual SMTP Configuration (Gmail + SendGrid)
// ==========================================
// Priority: Try Gmail first, fallback to SendGrid if Gmail fails

const SMTP_PROVIDER = process.env.SMTP_PROVIDER || 'auto'; // 'gmail', 'sendgrid', or 'auto'

// Gmail Configuration
const gmailConfig = {
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
};

// SendGrid Configuration
const sendgridConfig = {
  host: 'smtp.sendgrid.net',
  port: 587,
  secure: false,
  auth: {
    user: 'apikey', // SendGrid always uses 'apikey' as username
    pass: process.env.SENDGRID_API_KEY,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
};

// Choose configuration based on SMTP_PROVIDER
let primaryConfig, fallbackConfig, primaryName, fallbackName;

if (SMTP_PROVIDER === 'sendgrid') {
  primaryConfig = sendgridConfig;
  fallbackConfig = gmailConfig;
  primaryName = 'SendGrid';
  fallbackName = 'Gmail';
} else {
  // Default: Gmail primary, SendGrid fallback
  primaryConfig = gmailConfig;
  fallbackConfig = sendgridConfig;
  primaryName = 'Gmail';
  fallbackName = 'SendGrid';
}

// Create transporters
const primaryTransporter = nodemailer.createTransport(primaryConfig);
const fallbackTransporter = nodemailer.createTransport(fallbackConfig);

// Track which transporter is working
let activeTransporter = primaryTransporter;
let activeProvider = primaryName;

// Verify connections (non-blocking)
const verifyTransporters = async () => {
  try {
    await primaryTransporter.verify();
    console.log(`✅ ${primaryName} SMTP ready (PRIMARY)`);
    activeTransporter = primaryTransporter;
    activeProvider = primaryName;
  } catch (error) {
    console.warn(`⚠️  ${primaryName} SMTP failed:`, error.message);
    console.log(`🔄 Trying ${fallbackName} as fallback...`);
    
    try {
      await fallbackTransporter.verify();
      console.log(`✅ ${fallbackName} SMTP ready (FALLBACK)`);
      activeTransporter = fallbackTransporter;
      activeProvider = fallbackName;
    } catch (fallbackError) {
      console.error(`❌ Both ${primaryName} and ${fallbackName} SMTP failed!`);
      console.log("📧 Email functionality will be limited");
      console.log("💡 Check your credentials:");
      console.log("   - GMAIL_USER and GMAIL_APP_PASSWORD");
      console.log("   - SENDGRID_API_KEY");
    }
  }
};

// Run verification
verifyTransporters();

// Helper function to send emails with automatic fallback
export const sendEmail = async (mailOptions) => {
  const senderEmail = process.env.SENDER_EMAIL || process.env.GMAIL_USER;
  const appName = process.env.APP_NAME || 'BinWise';

  try {
    // Try primary transporter first
    const info = await activeTransporter.sendMail({
      from: `"${appName}" <${senderEmail}>`,
      ...mailOptions,
    });
    
    console.log(`📧 Email sent via ${activeProvider}:`, info.messageId);
    console.log("   To:", mailOptions.to);
    console.log("   Subject:", mailOptions.subject);
    
    return { success: true, messageId: info.messageId, provider: activeProvider };
  } catch (error) {
    console.error(`❌ ${activeProvider} failed:`, error.message);
    
    // Try fallback transporter
    if (activeTransporter === primaryTransporter) {
      console.log(`🔄 Retrying with ${fallbackName}...`);
      
      try {
        const fallbackInfo = await fallbackTransporter.sendMail({
          from: `"${appName}" <${senderEmail}>`,
          ...mailOptions,
        });
        
        console.log(`✅ Email sent via ${fallbackName} (fallback):`, fallbackInfo.messageId);
        
        // Switch to fallback for future emails
        activeTransporter = fallbackTransporter;
        activeProvider = fallbackName;
        
        return { success: true, messageId: fallbackInfo.messageId, provider: fallbackName };
      } catch (fallbackError) {
        console.error(`❌ ${fallbackName} also failed:`, fallbackError.message);
        return { success: false, error: `Both providers failed: ${error.message}` };
      }
    }
    
    return { success: false, error: error.message };
  }
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

export default activeTransporter;
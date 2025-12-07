import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// ==========================================
// Gmail SMTP Configuration
// ==========================================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
});

// Verify connection without crashing server
transporter.verify()
  .then(() => {
    console.log("✅ Gmail SMTP ready to send emails");
    console.log("📧 Sender:", process.env.GMAIL_USER);
  })
  .catch((error) => {
    console.warn("⚠️  Gmail SMTP connection failed:", error.message);
    console.log("📧 Server will continue running, but email functionality may be limited");
  });

// ✅ Helper function to send emails with error handling
export const sendEmail = async (mailOptions) => {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.APP_NAME || 'BinWise'}" <${process.env.GMAIL_USER}>`,
      ...mailOptions,
    });
    console.log("📧 Email sent successfully:", info.messageId);
    console.log("   To:", mailOptions.to);
    console.log("   Subject:", mailOptions.subject);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Email send failed:", error.message);
    
    if (error.code === 'EAUTH') {
      console.error("🔑 Authentication failed - Check your App Password");
    } else if (error.code === 'ESOCKET') {
      console.error("🌐 Network error - Check Railway network settings");
    } else if (error.code === 'ETIMEDOUT') {
      console.error("⏱️  Connection timeout - Gmail SMTP may be blocked");
    }
    
    return { success: false, error: error.message };
  }
};

// ✅ Helper to replace placeholders in email templates
export const prepareEmailTemplate = (template, replacements) => {
  let result = template;
  Object.keys(replacements).forEach(key => {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder, 'g'), replacements[key]);
  });
  return result;
};

// ✅ Default export
export default transporter;

// import nodemailer from 'nodemailer';
// import dotenv from 'dotenv';
// dotenv.config();

// const transporter = nodemailer.createTransport({
//   host: 'smtp-relay.brevo.com',
//   port: 587,
//   secure: false, // Use TLS
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASSWORD,
//   },
//   // Add timeout configurations to prevent hanging
//   connectionTimeout: 10000, // 10 seconds
//   greetingTimeout: 10000,
//   socketTimeout: 10000,
//   // Additional options for better reliability
//   pool: true, // Use pooled connections
//   maxConnections: 5,
//   maxMessages: 100,
// });

// // Make verification non-blocking - don't crash server if SMTP fails
// transporter.verify()
//   .then(() => {
//     console.log("✅ SMTP ready to send emails (Brevo)");
//   })
//   .catch((error) => {
//     console.warn("⚠️  SMTP connection failed:", error.message);
//     console.log("📧 Server will continue running, but email functionality may be limited");
//     console.log("💡 Check your Railway firewall settings or Brevo credentials");
//   });

// // Helper function to send emails with error handling
// export const sendEmail = async (mailOptions) => {
//   try {
//     const info = await transporter.sendMail({
//       from: process.env.SENDER_EMAIL,
//       ...mailOptions,
//     });
//     console.log("📧 Email sent successfully:", info.messageId);
//     return { success: true, messageId: info.messageId };
//   } catch (error) {
//     console.error("❌ Email send failed:", error.message);
//     return { success: false, error: error.message };
//   }
// };

// export default transporter;
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false, // Use TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  // Add timeout configurations to prevent hanging
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000,
  socketTimeout: 10000,
  // Additional options for better reliability
  pool: true, // Use pooled connections
  maxConnections: 5,
  maxMessages: 100,
});

// Make verification non-blocking - don't crash server if SMTP fails
transporter.verify()
  .then(() => {
    console.log("✅ SMTP ready to send emails (Brevo)");
  })
  .catch((error) => {
    console.warn("⚠️  SMTP connection failed:", error.message);
    console.log("📧 Server will continue running, but email functionality may be limited");
    console.log("💡 Check your Railway firewall settings or Brevo credentials");
  });

// Helper function to send emails with error handling
export const sendEmail = async (mailOptions) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      ...mailOptions,
    });
    console.log("📧 Email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Email send failed:", error.message);
    return { success: false, error: error.message };
  }
};

export default transporter;
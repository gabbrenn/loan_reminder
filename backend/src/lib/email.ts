import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT || '587');
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

let transporter: nodemailer.Transporter;

if (smtpHost && smtpUser && smtpPass) {
  // Production SMTP transport
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
} else {
  // Fallback to JSON transport for testing/local development (saves emails as JSON files/objects)
  transporter = nodemailer.createTransport({
    jsonTransport: true,
  });
}

export default transporter;

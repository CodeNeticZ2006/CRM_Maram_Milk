const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOTPEmail = async (toEmail, otp, adminName) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Maram Milk CRM <noreply@marammilk.com>',
    to: toEmail,
    subject: '🔐 Maram Milk CRM — Password Reset OTP',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #f9f9f9; padding: 30px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #1a1a2e; font-size: 22px; margin: 0;">🥛 Maram Milk CRM</h2>
          <p style="color: #666; font-size: 13px; margin: 4px 0;">Super Admin Portal</p>
        </div>
        <div style="background: white; border-radius: 10px; padding: 28px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">
          <p style="color: #333; font-size: 15px;">Hi <strong>${adminName}</strong>,</p>
          <p style="color: #555; font-size: 14px;">Your One-Time Password (OTP) for password reset:</p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="display: inline-block; background: #1a1a2e; color: #fff; font-size: 36px; letter-spacing: 14px; padding: 16px 28px; border-radius: 10px; font-weight: bold; font-family: monospace;">${otp}</span>
          </div>
          <p style="color: #888; font-size: 13px; text-align: center;">⏱ This OTP expires in <strong>10 minutes</strong></p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #aaa; font-size: 12px;">If you did not request this, please ignore this email. Your account is secure.</p>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

const sendInvoiceEmail = async (toEmail, customerName, invoiceNumber, pdfUrl, amount) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject: `🧾 Invoice ${invoiceNumber} — Maram Milk`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #f9f9f9; padding: 30px; border-radius: 12px;">
        <h2 style="color: #1a1a2e;">🥛 Maram Milk — Monthly Invoice</h2>
        <p>Dear <strong>${customerName}</strong>,</p>
        <p>Your invoice <strong>${invoiceNumber}</strong> for <strong>₹${amount}</strong> is ready.</p>
        <a href="${pdfUrl}" style="display: inline-block; background: #1a1a2e; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">📄 Download Invoice</a>
        <p style="margin-top: 20px; color: #888; font-size: 12px;">Please make payment at your earliest convenience. Thank you!</p>
      </div>
    `,
  };
  await transporter.sendMail(mailOptions);
};

module.exports = { sendOTPEmail, sendInvoiceEmail };

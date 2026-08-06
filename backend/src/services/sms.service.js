const twilio = require('twilio');
require('dotenv').config();

let client;
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
} catch (e) {
  console.warn('⚠️  Twilio not configured. SMS will be logged only.');
}

const sendOTPSMS = async (phoneNumber, otp) => {
  const message = `🔐 Maram Milk CRM OTP: ${otp}\nValid for 10 minutes. Do not share with anyone.`;

  if (!client) {
    console.log(`📱 [DEV SMS] To: ${phoneNumber} | OTP: ${otp}`);
    return;
  }

  await client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE,
    to: phoneNumber,
  });
};

const sendWhatsAppMessage = async (phoneNumber, message) => {
  if (!client) {
    console.log(`📲 [DEV WA] To: ${phoneNumber} | ${message}`);
    return;
  }

  await client.messages.create({
    body: message,
    from: `whatsapp:${process.env.TWILIO_PHONE}`,
    to: `whatsapp:${phoneNumber}`,
  });
};

module.exports = { sendOTPSMS, sendWhatsAppMessage };

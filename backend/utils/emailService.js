const nodemailer = require('nodemailer');
const crypto = require('crypto');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');

const getSmtpConfig = () => {
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (process.env.SMTP_SERVICE) {
    return {
      service: process.env.SMTP_SERVICE,
      auth: { user, pass }
    };
  }

  return {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: { user, pass }
  };
};

const getFromAddress = () => ({
  name: process.env.SMTP_FROM_NAME || 'SerbisyoToledo',
  address: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || process.env.EMAIL_USER
});

const resolveSmtpHost = async () => {
  if (process.env.SMTP_SERVICE) {
    return null;
  }

  const configuredHost = process.env.SMTP_HOST || 'smtp.gmail.com';

  if (/^\d+\.\d+\.\d+\.\d+$/.test(configuredHost)) {
    return configuredHost;
  }

  const addresses = await dns.promises.resolve4(configuredHost);
  return addresses[0] || 'smtp.gmail.com';
};

// Create reusable transporter
const createTransporter = async () => {
  const resolvedHost = await resolveSmtpHost();

  return nodemailer.createTransport({
    ...(resolvedHost ? { ...getSmtpConfig(), host: resolvedHost } : getSmtpConfig()),
    family: 4,
    tls: {
      servername: 'smtp.gmail.com'
    },
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 10000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 10000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 10000),
  });
};

// Generate a random verification token
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Send verification email
const sendVerificationEmail = async (toEmail, fullName, verificationToken) => {
  const transporter = await createTransporter();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verifyUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

  console.log('Sending verification email to:', toEmail);
  console.log('Verification URL:', verifyUrl);
  console.log('Token in URL:', verificationToken.substring(0, 10) + '...');

  const mailOptions = {
    from: getFromAddress(),
    to: toEmail,
    subject: 'Verify Your SerbisyoToledo Account',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 0;
            padding: 0;
            background-color: #f4f7fb;
          }
          .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            padding: 40px 20px;
          }
          .email-card {
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
          }
          .email-header {
            background: linear-gradient(135deg, #4A9FF5 0%, #2d7dd2 100%);
            padding: 40px 32px;
            text-align: center;
          }
          .email-header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.5px;
          }
          .email-header p {
            color: rgba(255, 255, 255, 0.85);
            margin: 8px 0 0;
            font-size: 14px;
          }
          .email-body {
            padding: 40px 32px;
          }
          .greeting {
            font-size: 18px;
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 16px;
          }
          .email-body p {
            color: #555555;
            font-size: 15px;
            margin-bottom: 16px;
          }
          .verify-btn-wrapper {
            text-align: center;
            margin: 32px 0;
          }
          .verify-btn {
            display: inline-block;
            background: linear-gradient(135deg, #4A9FF5 0%, #2d7dd2 100%);
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 40px;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            letter-spacing: 0.3px;
            box-shadow: 0 4px 14px rgba(74, 159, 245, 0.4);
          }
          .note {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 16px 20px;
            font-size: 13px;
            color: #777777;
            margin-top: 24px;
          }
          .email-footer {
            border-top: 1px solid #eef2f6;
            padding: 24px 32px;
            text-align: center;
          }
          .email-footer p {
            color: #999999;
            font-size: 13px;
            margin: 0;
          }
          .brand {
            color: #4A9FF5;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-card">
            <div class="email-header">
              <h1>SerbisyoToledo</h1>
              <p>Your trusted local services platform</p>
            </div>
            <div class="email-body">
              <p class="greeting">Hello${fullName ? ` ${fullName}` : ''},</p>
              <p>Thank you for signing up for <strong>SerbisyoToledo</strong>!</p>
              <p>To complete your registration and secure your account, please verify your email address by clicking the button below:</p>
              
              <div class="verify-btn-wrapper">
                <a href="${verifyUrl}" class="verify-btn">Verify My Account</a>
              </div>
              
              <p>If you did not create an account with SerbisyoToledo, you may safely ignore this email.</p>
              <p>Once verified, you'll be able to explore local services, manage your profile, and start using all the features of the platform.</p>
              <p>If you encounter any issues or have questions, feel free to contact our support team.</p>
              <p>Welcome to <strong>SerbisyoToledo</strong> — we're glad to have you with us!</p>
              <p>Best regards,<br><strong>The SerbisyoToledo Team</strong></p>
              
              <div class="note">
                <strong>Can't click the button?</strong> Copy and paste this link into your browser:<br>
                <a href="${verifyUrl}" style="color: #4A9FF5; word-break: break-all;">${verifyUrl}</a>
              </div>
            </div>
            <div class="email-footer">
              <p>&copy; ${new Date().getFullYear()} <span class="brand">SerbisyoToledo</span>. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending verification email:', error.message);
    return { success: false, error: error.message };
  }
};

const sendWelcomeEmail = async (toEmail, fullName, userType) => {
  const transporter = await createTransporter();
  const roleLabel = userType === 'tradesperson' ? 'Service Provider' : 'Client';

  const mailOptions = {
    from: getFromAddress(),
    to: toEmail,
    subject: 'Welcome to SerbisyoToledo',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2d7dd2;">Welcome to SerbisyoToledo</h2>
        <p>Hello${fullName ? ` ${fullName}` : ''},</p>
        <p>Thank you for signing up. Your account was created successfully.</p>
        <p>You registered as: <strong>${roleLabel}</strong>.</p>
        <p>You can now log in and start using SerbisyoToledo.</p>
        <p style="margin-top: 24px;">Best regards,<br/>SerbisyoToledo Team</p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending welcome email:', error.message);
    return { success: false, error: error.message };
  }
};

const sendPasswordResetEmail = async (toEmail, fullName, resetUrl, expiryMinutes) => {
  const transporter = await createTransporter();

  const mailOptions = {
    from: getFromAddress(),
    to: toEmail,
    subject: 'Reset Your SerbisyoToledo Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2d7dd2;">Reset Your SerbisyoToledo Password</h2>
        <p>Hello${fullName ? ` ${fullName}` : ''},</p>
        <p>We received a request to reset your password.</p>
        <p>
          Click this link to set a new password:<br/>
          <a href="${resetUrl}" style="color: #2d7dd2; word-break: break-all;">${resetUrl}</a>
        </p>
        <p>This link will expire in ${expiryMinutes} minutes.</p>
        <p>If you did not request a password reset, you can ignore this email.</p>
        <p style="margin-top: 24px;">Best regards,<br/>SerbisyoToledo Team</p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  generateVerificationToken,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
};

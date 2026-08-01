require('dotenv').config();

const { sendEmail, getEmailProvider, validateEmailConfiguration } = require('../utils/emailService');

const maskEmail = (email) => {
  if (!email || !email.includes('@')) {
    return 'unknown-recipient';
  }

  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
};

const resolveRecipient = () => {
  const cliArg = process.argv[2];
  if (cliArg) return cliArg;
  if (process.env.EMAIL_TEST_RECIPIENT) return process.env.EMAIL_TEST_RECIPIENT;
  return process.env.MAILJET_SENDER_EMAIL;
};

const run = async () => {
  const provider = getEmailProvider();
  const recipient = resolveRecipient();

  if (!recipient) {
    console.error('Email test failed: missing recipient. Pass one as an argument or set EMAIL_TEST_RECIPIENT/MAILJET_SENDER_EMAIL.');
    process.exit(1);
  }

  const validation = validateEmailConfiguration();
  if (!validation.valid) {
    console.error(`Email test failed: ${validation.message}`);
    process.exit(1);
  }

  const maskedRecipient = maskEmail(recipient);

  const result = await sendEmail({
    to: recipient,
    subject: 'SerbisyoToledo Mailjet Configuration Test',
    text: 'This is a backend email configuration test for SerbisyoToledo.',
    html: '<p>This is a backend email configuration test for <strong>SerbisyoToledo</strong>.</p>',
    emailType: 'configuration_test'
  });

  if (!result.success) {
    console.error(`Email test failed. Provider: ${provider}. Recipient: ${maskedRecipient}. Code: ${result.errorCode || 'unknown'}.`);
    process.exit(1);
  }

  console.log(`Email test succeeded. Provider: ${provider}. Recipient: ${maskedRecipient}. Status: ${result.status || 'accepted'}. Message ID: ${result.messageId}`);
  process.exit(0);
};

run().catch((error) => {
  console.error(`Email test crashed: ${error.message}`);
  process.exit(1);
});

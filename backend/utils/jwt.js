const isProduction = process.env.NODE_ENV === 'production';

const resolveJwtSecret = () => {
  const secret = String(process.env.JWT_SECRET || '').trim();

  if (!secret) {
    if (isProduction) {
      throw new Error('JWT_SECRET is required in production.');
    }

    return 'dev-secret-change-me';
  }

  return secret;
};

const getJwtSecret = () => resolveJwtSecret();

const assertJwtConfiguration = () => {
  resolveJwtSecret();
  return true;
};

const getJwtSignOptions = () => ({
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
});

module.exports = {
  getJwtSecret,
  assertJwtConfiguration,
  getJwtSignOptions,
};

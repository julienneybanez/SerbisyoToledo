const rateLimit = require('express-rate-limit');

const defaultHandler = (message) => (req, res) => {
  res.status(429).json({
    success: false,
    message,
  });
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler('Too many login attempts. Please try again later.'),
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler('Too many registration attempts. Please try again later.'),
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler('Too many password reset requests. Please try again later.'),
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler('Too many password reset attempts. Please try again later.'),
});

const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler('Too many verification email requests. Please try again later.'),
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler('Too many upload requests. Please slow down and try again later.'),
});

const publicSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 90,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler('Too many search requests. Please try again shortly.'),
});

const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler('Too many assistant messages. Please try again shortly.'),
});

module.exports = {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  resendVerificationLimiter,
  uploadLimiter,
  publicSearchLimiter,
  assistantLimiter,
};

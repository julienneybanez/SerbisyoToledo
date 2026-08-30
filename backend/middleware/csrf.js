const crypto = require('crypto');
const { getSessionTokenFromRequest, getCsrfTokenFromRequest } = require('../utils/sessionCookies');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const timingSafeEqualText = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (leftBuffer.length !== rightBuffer.length || leftBuffer.length === 0) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

// Double-submit CSRF protection is required for authenticated cookie mutations.
// Bearer-token clients are retained only as a transitional/API compatibility path.
exports.requireCsrfForCookieAuth = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const cookieSession = getSessionTokenFromRequest(req);
  if (!cookieSession) {
    return next();
  }

  const cookieToken = getCsrfTokenFromRequest(req);
  const headerToken = req.get('x-csrf-token');

  if (!cookieToken || !headerToken || !timingSafeEqualText(cookieToken, headerToken)) {
    return res.status(403).json({
      success: false,
      code: 'CSRF_TOKEN_INVALID',
      message: 'Your security token is missing or expired. Refresh the page and try again.',
    });
  }

  return next();
};

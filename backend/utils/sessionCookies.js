const crypto = require('crypto');

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'serbisyo_session';
const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'serbisyo_csrf';
const SESSION_MAX_AGE_MS = Number(process.env.SESSION_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000);

const isProduction = () => process.env.NODE_ENV === 'production';

const parseCookies = (cookieHeader = '') => String(cookieHeader)
  .split(';')
  .map((entry) => entry.trim())
  .filter(Boolean)
  .reduce((accumulator, entry) => {
    const separatorIndex = entry.indexOf('=');
    if (separatorIndex <= 0) return accumulator;
    const key = decodeURIComponent(entry.slice(0, separatorIndex).trim());
    const value = decodeURIComponent(entry.slice(separatorIndex + 1).trim());
    accumulator[key] = value;
    return accumulator;
  }, {});

const baseCookieOptions = () => ({
  secure: isProduction(),
  sameSite: isProduction() ? 'none' : 'lax',
  path: '/',
});

const getSessionTokenFromRequest = (req) => {
  const cookies = parseCookies(req.headers?.cookie || '');
  return cookies[AUTH_COOKIE_NAME] || null;
};

const getCsrfTokenFromRequest = (req) => {
  const cookies = parseCookies(req.headers?.cookie || '');
  return cookies[CSRF_COOKIE_NAME] || null;
};

const issueCsrfToken = (res) => {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE_NAME, token, {
    ...baseCookieOptions(),
    httpOnly: false,
    maxAge: SESSION_MAX_AGE_MS,
  });
  return token;
};

const setSessionCookies = (res, jwtToken) => {
  res.cookie(AUTH_COOKIE_NAME, jwtToken, {
    ...baseCookieOptions(),
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_MS,
  });
  return issueCsrfToken(res);
};

const clearSessionCookies = (res) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    ...baseCookieOptions(),
    httpOnly: true,
  });
  res.clearCookie(CSRF_COOKIE_NAME, {
    ...baseCookieOptions(),
    httpOnly: false,
  });
};

module.exports = {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  parseCookies,
  getSessionTokenFromRequest,
  getCsrfTokenFromRequest,
  issueCsrfToken,
  setSessionCookies,
  clearSessionCookies,
};

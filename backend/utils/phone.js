const normalizePhilippinePhone = (value, { allowEmpty = true } = {}) => {
  if (value === null || value === undefined) {
    return allowEmpty ? null : undefined;
  }

  const raw = String(value).trim();
  if (!raw) {
    return allowEmpty ? null : undefined;
  }

  const compact = raw.replace(/[\s().-]/g, '');
  let normalized = compact;

  if (/^09\d{9}$/.test(compact)) {
    normalized = `+63${compact.slice(1)}`;
  } else if (/^639\d{9}$/.test(compact)) {
    normalized = `+${compact}`;
  }

  if (!/^\+639\d{9}$/.test(normalized)) {
    return undefined;
  }

  return normalized;
};

const toLocalPhilippinePhone = (normalized) => {
  if (!normalized) return null;
  const value = String(normalized);
  return /^\+639\d{9}$/.test(value) ? `0${value.slice(3)}` : value;
};

module.exports = {
  normalizePhilippinePhone,
  toLocalPhilippinePhone,
};

function parseJsonValue(value, fallback = null) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  return value;
}

function parseJsonArray(value, fallback = []) {
  const parsed = parseJsonValue(value, fallback);
  return Array.isArray(parsed) ? parsed : fallback;
}

module.exports = {
  parseJsonValue,
  parseJsonArray,
};

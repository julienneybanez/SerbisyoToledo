const path = require('path');

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const PDF_MIME_TYPE = 'application/pdf';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const PDF_EXTENSIONS = new Set(['.pdf']);

const signatures = {
  jpg: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  png: (buffer) =>
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a,
  gif: (buffer) =>
    buffer.length >= 6
    && buffer[0] === 0x47
    && buffer[1] === 0x49
    && buffer[2] === 0x46
    && buffer[3] === 0x38
    && (buffer[4] === 0x39 || buffer[4] === 0x37)
    && buffer[5] === 0x61,
  webp: (buffer) =>
    buffer.length >= 12
    && buffer[0] === 0x52
    && buffer[1] === 0x49
    && buffer[2] === 0x46
    && buffer[3] === 0x46
    && buffer[8] === 0x57
    && buffer[9] === 0x45
    && buffer[10] === 0x42
    && buffer[11] === 0x50,
  pdf: (buffer) =>
    buffer.length >= 4
    && buffer[0] === 0x25
    && buffer[1] === 0x50
    && buffer[2] === 0x44
    && buffer[3] === 0x46,
};

const hasAllowedMime = (mimeType, allowedKinds) => {
  if (!mimeType) return false;

  for (const kind of allowedKinds) {
    if (kind === 'image' && IMAGE_MIME_TYPES.has(mimeType)) return true;
    if (kind === 'pdf' && mimeType === PDF_MIME_TYPE) return true;
  }

  return false;
};

const hasAllowedExtension = (filename, allowedKinds) => {
  const ext = path.extname(String(filename || '')).toLowerCase();
  if (!ext) return false;

  for (const kind of allowedKinds) {
    if (kind === 'image' && IMAGE_EXTENSIONS.has(ext)) return true;
    if (kind === 'pdf' && PDF_EXTENSIONS.has(ext)) return true;
  }

  return false;
};

const hasValidSignature = (buffer, allowedKinds) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return false;

  for (const kind of allowedKinds) {
    if (kind === 'image') {
      if (signatures.jpg(buffer) || signatures.png(buffer) || signatures.gif(buffer) || signatures.webp(buffer)) {
        return true;
      }
    }

    if (kind === 'pdf' && signatures.pdf(buffer)) {
      return true;
    }
  }

  return false;
};

const validateSingleUpload = ({ allowedKinds = ['image'], required = false, fieldName = 'file' } = {}) => {
  return (req, res, next) => {
    const file = req.file;

    if (!file) {
      if (required) {
        return res.status(400).json({
          success: false,
          message: `${fieldName} upload is required.`,
        });
      }

      return next();
    }

    const mimeOk = hasAllowedMime(file.mimetype, allowedKinds);
    const extOk = hasAllowedExtension(file.originalname, allowedKinds);
    const sigOk = hasValidSignature(file.buffer, allowedKinds);

    if (!mimeOk || !extOk || !sigOk) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${fieldName} file type.`,
      });
    }

    return next();
  };
};

const validateMultiFieldUploads = (schema = {}) => {
  return (req, res, next) => {
    const files = req.files || {};

    for (const [fieldName, rules] of Object.entries(schema)) {
      const {
        allowedKinds = ['image'],
        required = false,
        maxCount = 1,
      } = rules || {};

      const fieldFiles = Array.isArray(files[fieldName]) ? files[fieldName] : [];

      if (required && fieldFiles.length === 0) {
        return res.status(400).json({
          success: false,
          message: `${fieldName} upload is required.`,
        });
      }

      if (fieldFiles.length > maxCount) {
        return res.status(400).json({
          success: false,
          message: `${fieldName} accepts up to ${maxCount} file(s).`,
        });
      }

      for (const file of fieldFiles) {
        const mimeOk = hasAllowedMime(file.mimetype, allowedKinds);
        const extOk = hasAllowedExtension(file.originalname, allowedKinds);
        const sigOk = hasValidSignature(file.buffer, allowedKinds);

        if (!mimeOk || !extOk || !sigOk) {
          return res.status(400).json({
            success: false,
            message: `Invalid ${fieldName} file type.`,
          });
        }
      }
    }

    return next();
  };
};

module.exports = {
  validateSingleUpload,
  validateMultiFieldUploads,
};

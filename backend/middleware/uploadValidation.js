const path = require('path');

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const DOC_MIME_TYPES = new Set(['application/pdf']);
const DOC_EXTENSIONS = new Set(['.pdf']);

const isJpeg = (buffer) => buffer?.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
const isPng = (buffer) =>
  buffer?.length >= 8 &&
  buffer[0] === 0x89 &&
  buffer[1] === 0x50 &&
  buffer[2] === 0x4e &&
  buffer[3] === 0x47 &&
  buffer[4] === 0x0d &&
  buffer[5] === 0x0a &&
  buffer[6] === 0x1a &&
  buffer[7] === 0x0a;
const isGif = (buffer) =>
  buffer?.length >= 6 &&
  buffer.toString('ascii', 0, 6) === 'GIF87a' ||
  buffer?.length >= 6 && buffer.toString('ascii', 0, 6) === 'GIF89a';
const isWebp = (buffer) =>
  buffer?.length >= 12 &&
  buffer.toString('ascii', 0, 4) === 'RIFF' &&
  buffer.toString('ascii', 8, 12) === 'WEBP';
const isPdf = (buffer) => buffer?.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF';

const getFileKind = (file) => {
  if (!file || !file.buffer) return null;

  if (isJpeg(file.buffer)) return 'image';
  if (isPng(file.buffer)) return 'image';
  if (isGif(file.buffer)) return 'image';
  if (isWebp(file.buffer)) return 'image';
  if (isPdf(file.buffer)) return 'pdf';

  return null;
};

const validateByTypeAndExtension = (file, allowedKinds) => {
  const extension = path.extname(String(file.originalname || '')).toLowerCase();
  const mimeType = String(file.mimetype || '').toLowerCase();

  if (allowedKinds.includes('image')) {
    if (IMAGE_MIME_TYPES.has(mimeType) && IMAGE_EXTENSIONS.has(extension)) {
      return true;
    }
  }

  if (allowedKinds.includes('pdf')) {
    if (DOC_MIME_TYPES.has(mimeType) && DOC_EXTENSIONS.has(extension)) {
      return true;
    }
  }

  return false;
};

const validateSingleUpload = ({ allowedKinds, required = false, fieldName = 'file' }) => {
  return (req, res, next) => {
    const file = req.file;

    if (!file) {
      if (required) {
        return res.status(400).json({
          success: false,
          message: `${fieldName} is required`,
        });
      }
      return next();
    }

    if (!validateByTypeAndExtension(file, allowedKinds)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid upload type. Only supported file formats are allowed.',
      });
    }

    const kind = getFileKind(file);
    if (!kind || !allowedKinds.includes(kind)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or unsafe file content detected.',
      });
    }

    return next();
  };
};

const validateMultiFieldUploads = (fieldRules) => {
  return (req, res, next) => {
    for (const [fieldName, rule] of Object.entries(fieldRules)) {
      const files = req.files?.[fieldName] || [];

      if (rule.required && files.length === 0) {
        return res.status(400).json({
          success: false,
          message: `${fieldName} is required`,
        });
      }

      if (rule.maxCount && files.length > rule.maxCount) {
        return res.status(400).json({
          success: false,
          message: `Too many files uploaded for ${fieldName}`,
        });
      }

      for (const file of files) {
        if (!validateByTypeAndExtension(file, rule.allowedKinds)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid upload type. Only supported file formats are allowed.',
          });
        }

        const kind = getFileKind(file);
        if (!kind || !rule.allowedKinds.includes(kind)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid or unsafe file content detected.',
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

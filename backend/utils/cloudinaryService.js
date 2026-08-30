const { v2: cloudinary } = require('cloudinary');

const hasCloudinaryConfig = () => (
  Boolean(process.env.CLOUDINARY_CLOUD_NAME)
  && Boolean(process.env.CLOUDINARY_API_KEY)
  && Boolean(process.env.CLOUDINARY_API_SECRET)
);

const ensureCloudinaryConfigured = () => {
  if (!hasCloudinaryConfig()) {
    return false;
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  return true;
};

const uploadImageBuffer = async ({ buffer, mimeType, folder, resourceType = 'image', deliveryType = 'upload' }) => {
  if (!buffer || !mimeType) {
    throw new Error('Image buffer and mime type are required for upload');
  }

  if (!ensureCloudinaryConfigured()) {
    throw new Error('Cloudinary is not configured');
  }

  const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;

  return cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: resourceType,
    type: deliveryType,
  });
};

// Short-lived signed URL for assets stored with deliveryType='authenticated'
// (e.g. provider credential documents, which must never resolve to a
// permanent public URL even if the stored public_id ever leaks).
const getSignedDeliveryUrl = (publicId, { resourceType = 'image', expiresInSeconds = 300 } = {}) => {
  if (!publicId || !ensureCloudinaryConfigured()) {
    return null;
  }

  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

  return cloudinary.utils.private_download_url(publicId, undefined, {
    resource_type: resourceType,
    type: 'authenticated',
    expires_at: expiresAt,
  });
};

const deleteImageByPublicId = async (publicId, resourceType = 'image') => {
  if (!publicId || !ensureCloudinaryConfigured()) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.warn('Failed to delete Cloudinary asset:', error.message);
  }
};

module.exports = {
  hasCloudinaryConfig,
  uploadImageBuffer,
  getSignedDeliveryUrl,
  deleteImageByPublicId,
};

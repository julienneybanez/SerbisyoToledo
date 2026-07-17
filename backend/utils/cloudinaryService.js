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

const uploadImageBuffer = async ({ buffer, mimeType, folder }) => {
  if (!buffer || !mimeType) {
    throw new Error('Image buffer and mime type are required for upload');
  }

  if (!ensureCloudinaryConfigured()) {
    throw new Error('Cloudinary is not configured');
  }

  const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;

  return cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: 'image',
  });
};

const deleteImageByPublicId = async (publicId) => {
  if (!publicId || !ensureCloudinaryConfigured()) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (error) {
    console.warn('Failed to delete Cloudinary asset:', error.message);
  }
};

module.exports = {
  hasCloudinaryConfig,
  uploadImageBuffer,
  deleteImageByPublicId,
};

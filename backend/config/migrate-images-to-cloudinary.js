const db = require('./database');
const {
  hasCloudinaryConfig,
  uploadImageBuffer,
} = require('../utils/cloudinaryService');

async function migrateServiceProfileBanners() {
  const [rows] = await db.query(
    `SELECT id, banner_image
     FROM service_profiles
     WHERE banner_image IS NOT NULL AND banner_image_url IS NULL`
  );

  for (const row of rows) {
    const uploadResult = await uploadImageBuffer({
      buffer: row.banner_image,
      mimeType: 'image/jpeg',
      folder: 'serbisyo-toledo/service-banners',
    });

    await db.query(
      `UPDATE service_profiles
       SET banner_image_url = ?, banner_image_public_id = ?, banner_image = NULL
       WHERE id = ?`,
      [uploadResult.secure_url, uploadResult.public_id, row.id]
    );
  }

  return rows.length;
}

async function migratePortfolioImages() {
  const [rows] = await db.query(
    `SELECT id, image_data
     FROM portfolio_items
     WHERE image_data IS NOT NULL AND image_url IS NULL`
  );

  for (const row of rows) {
    const uploadResult = await uploadImageBuffer({
      buffer: row.image_data,
      mimeType: 'image/jpeg',
      folder: 'serbisyo-toledo/portfolio',
    });

    await db.query(
      `UPDATE portfolio_items
       SET image_url = ?, image_public_id = ?, image_data = NULL
       WHERE id = ?`,
      [uploadResult.secure_url, uploadResult.public_id, row.id]
    );
  }

  return rows.length;
}

async function migrateUserProfilePhotos() {
  const [rows] = await db.query(
    `SELECT id, profile_photo
     FROM users
     WHERE profile_photo IS NOT NULL AND profile_photo_url IS NULL`
  );

  for (const row of rows) {
    const uploadResult = await uploadImageBuffer({
      buffer: row.profile_photo,
      mimeType: 'image/jpeg',
      folder: 'serbisyo-toledo/profile-photos',
    });

    await db.query(
      `UPDATE users
       SET profile_photo_url = ?, profile_photo_public_id = ?, profile_image = ?, profile_photo = NULL
       WHERE id = ?`,
      [uploadResult.secure_url, uploadResult.public_id, uploadResult.secure_url, row.id]
    );
  }

  return rows.length;
}

async function migrateImagesToCloudinary() {
  if (!hasCloudinaryConfig()) {
    console.error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET first.');
    process.exit(1);
  }

  try {
    const migratedBanners = await migrateServiceProfileBanners();
    const migratedPortfolio = await migratePortfolioImages();
    const migratedProfiles = await migrateUserProfilePhotos();

    console.log('Migration complete.');
    console.log(`Service profile banners migrated: ${migratedBanners}`);
    console.log(`Portfolio images migrated: ${migratedPortfolio}`);
    console.log(`User profile photos migrated: ${migratedProfiles}`);
  } catch (error) {
    console.error('Failed to migrate images to Cloudinary:', error.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

migrateImagesToCloudinary();

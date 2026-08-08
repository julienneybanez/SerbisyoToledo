const db = require('../config/database');
const { parseJsonArray } = require('../utils/jsonHelpers');
const {
  hasCloudinaryConfig,
  uploadImageBuffer,
  deleteImageByPublicId,
} = require('../utils/cloudinaryService');
const {
  parseDateOnly,
  formatDateOnly,
  parseTimeInputToSql,
  getAvailableSlotsForDate,
  ensureAvailabilitySettings,
} = require('../utils/bookingAvailability');
const {
  toPublicTaxonomy,
  normalizeCategoryLabels,
  isLegacyCategoryValue,
  validateServiceTypeKeysForCategories,
} = require('../config/serviceTaxonomy');

const SUPPORTED_LANGUAGE_CODES = new Set(['ceb', 'en', 'fil']);
const SUPPORTED_PRICING_UNITS = new Set(['per_job', 'per_hour', 'per_day']);
const SUPPORTED_CREDENTIAL_TYPES = new Set([
  'professional_license',
  'tesda_certification',
  'safety_training',
  'technical_certification',
  'government_accreditation',
  'manufacturer_certification',
  'training_certificate',
  'other',
]);
const PRESENCE_WINDOW_MINUTES = 5;
const REVIEW_STATS_JOIN = `
  LEFT JOIN (
    SELECT
      service_profile_id,
      ROUND(AVG(rating), 1) AS rating,
      COUNT(*) AS reviews_count
    FROM reviews
    GROUP BY service_profile_id
  ) review_stats ON review_stats.service_profile_id = sp.id
`;

const deriveOnlineFromLastSeen = (lastSeenAt) => {
  if (!lastSeenAt) return false;
  const seenTime = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(seenTime)) return false;
  return (Date.now() - seenTime) <= PRESENCE_WINDOW_MINUTES * 60 * 1000;
};

const normalizeLanguageCodes = (payload) => Array.from(
  new Set(
    (Array.isArray(payload) ? payload : [])
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)
  )
);

const applyProviderLanguages = async (serviceProfileId, languageCodes = []) => {
  await db.query('DELETE FROM provider_languages WHERE service_profile_id = ?', [serviceProfileId]);

  for (const languageCode of languageCodes) {
    await db.query(
      'INSERT INTO provider_languages (service_profile_id, language_code) VALUES (?, ?)',
      [serviceProfileId, languageCode]
    );
  }
};

exports.getTaxonomy = async (_req, res) => {
  return res.json({
    success: true,
    data: toPublicTaxonomy(),
  });
};

// Create or update service profile
exports.createOrUpdateProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { fullName, barangayAddress, startingPrice, description } = req.body;
    const pricingUnit = String(req.body.pricingUnit || 'per_day').trim().toLowerCase();
    let serviceCategories = req.body.serviceCategories;
    let serviceTypes = req.body.serviceTypes;
    let languages = req.body.languages;
    let bannerImageUrl = null;
    let bannerImagePublicId = null;

    // Parse serviceCategories if it's a JSON string (from FormData)
    if (typeof serviceCategories === 'string') {
      try {
        serviceCategories = JSON.parse(serviceCategories);
      } catch {
        serviceCategories = [serviceCategories];
      }
    }

    if (typeof languages === 'string') {
      try {
        languages = JSON.parse(languages);
      } catch {
        languages = [languages];
      }
    }

    if (typeof serviceTypes === 'string') {
      try {
        serviceTypes = JSON.parse(serviceTypes);
      } catch {
        serviceTypes = [serviceTypes];
      }
    }

    const requestedCategories = Array.isArray(serviceCategories) ? serviceCategories : [];
    if (requestedCategories.some((value) => isLegacyCategoryValue(value))) {
      return res.status(400).json({
        success: false,
        message: 'Legacy category values are no longer supported. Please select a current category.',
      });
    }

    const normalizedCategories = normalizeCategoryLabels(requestedCategories, { preserveUnknown: false });

    if (normalizedCategories.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one valid service category.',
      });
    }

    const normalizedServiceTypeKeys = Array.from(
      new Set(
        (Array.isArray(serviceTypes) ? serviceTypes : [])
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      )
    );

    const serviceTypeValidation = validateServiceTypeKeysForCategories({
      serviceTypeKeys: normalizedServiceTypeKeys,
      categoryLabels: normalizedCategories,
    });

    if (serviceTypeValidation.invalidKeys.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'One or more selected service types are invalid.',
      });
    }

    if (serviceTypeValidation.categoryMismatchKeys.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Selected service type does not belong to the selected category.',
      });
    }

    const normalizedLanguages = normalizeLanguageCodes(languages);
    if (normalizedLanguages.some((code) => !SUPPORTED_LANGUAGE_CODES.has(code))) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported language code provided',
      });
    }

    if (!SUPPORTED_PRICING_UNITS.has(pricingUnit)) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported pricing unit provided',
      });
    }

    const normalizedStartingPrice = Number(startingPrice);
    if (!Number.isFinite(normalizedStartingPrice) || normalizedStartingPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Starting price must be greater than 0',
      });
    }

    // Validate required fields
    if (!fullName || !barangayAddress || !startingPrice || normalizedCategories.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Handle banner image upload if provided
    if (req.file) {
      if (hasCloudinaryConfig()) {
        const uploadResult = await uploadImageBuffer({
          buffer: req.file.buffer,
          mimeType: req.file.mimetype,
          folder: 'serbisyo-toledo/service-banners',
        });

        bannerImageUrl = uploadResult.secure_url;
        bannerImagePublicId = uploadResult.public_id;
      }
    }

    await db.query('UPDATE users SET full_name = ? WHERE id = ?', [fullName, userId]);

    // Check if profile already exists for this user
    const [existingProfile] = await db.query(
      'SELECT id, banner_image_public_id FROM service_profiles WHERE user_id = ?',
      [userId]
    );

    if (existingProfile.length > 0) {
      // Update existing profile
      const updates = [
        'barangay_address = ?',
        'starting_price = ?',
        'pricing_unit = ?',
        'service_categories = ?',
        'service_types = ?',
        'description = ?',
      ];

      const params = [
        barangayAddress,
        normalizedStartingPrice,
        pricingUnit,
        JSON.stringify(normalizedCategories),
        JSON.stringify(normalizedServiceTypeKeys),
        description || null
      ];

      if (bannerImageUrl) {
        updates.push('banner_image_url = ?');
        params.push(bannerImageUrl);
        updates.push('banner_image_public_id = ?');
        params.push(bannerImagePublicId);
      }

      params.push(userId);

      await db.query(
        `UPDATE service_profiles SET ${updates.join(', ')} WHERE user_id = ?`,
        params
      );

      if (Array.isArray(languages)) {
        await applyProviderLanguages(existingProfile[0].id, normalizedLanguages);
      }

      if (bannerImagePublicId && existingProfile[0].banner_image_public_id) {
        await deleteImageByPublicId(existingProfile[0].banner_image_public_id);
      }

      return res.json({
        success: true,
        message: 'Service profile updated successfully',
        profileId: existingProfile[0].id
      });
    } else {
      // Create new profile
      const [result] = await db.query(
        `INSERT INTO service_profiles 
         (user_id, barangay_address, starting_price, pricing_unit, service_categories, service_types, description, banner_image_url, banner_image_public_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          barangayAddress,
          normalizedStartingPrice,
          pricingUnit,
          JSON.stringify(normalizedCategories),
          JSON.stringify(normalizedServiceTypeKeys),
          description || null,
          bannerImageUrl,
          bannerImagePublicId,
        ]
      );

      let initialLanguages = normalizedLanguages;

      if (!Array.isArray(languages)) {
        const [rows] = await db.query('SELECT registration_languages FROM users WHERE id = ? LIMIT 1', [userId]);
        const persisted = rows[0]?.registration_languages;

        if (persisted) {
          let parsed = [];
          if (typeof persisted === 'string') {
            try {
              parsed = JSON.parse(persisted);
            } catch {
              parsed = [];
            }
          } else if (Array.isArray(persisted)) {
            parsed = persisted;
          }

          initialLanguages = normalizeLanguageCodes(parsed).filter((code) => SUPPORTED_LANGUAGE_CODES.has(code));
        }
      }

      if (initialLanguages.length > 0) {
        await applyProviderLanguages(result.insertId, initialLanguages);
      }

      return res.status(201).json({
        success: true,
        message: 'Service profile created successfully',
        profileId: result.insertId
      });
    }
  } catch (error) {
    console.error('Error creating/updating service profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating/updating service profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all published service profiles
exports.getAllProfiles = async (req, res) => {
  try {
    const { category, location, minPrice, maxPrice, minRating, search } = req.query;

    let query = `
      SELECT 
        sp.id,
        sp.user_id,
        u.full_name AS provider_name,
        u.last_seen_at,
        sp.barangay_address,
        sp.starting_price,
        sp.pricing_unit,
        sp.service_categories,
        sp.description,
        sp.banner_image_url,
        COALESCE(review_stats.rating, 0) AS rating,
        COALESCE(review_stats.reviews_count, 0) AS reviews_count,
        sp.created_at,
        u.profession,
        u.skills,
        u.is_verified
      FROM service_profiles sp
      JOIN users u ON sp.user_id = u.id
      ${REVIEW_STATS_JOIN}
      WHERE sp.is_published = TRUE
        AND u.is_active = TRUE
    `;

    const params = [];

    // Add filters
    if (location) {
      query += ' AND sp.barangay_address LIKE ?';
      params.push(`%${location}%`);
    }

    if (minPrice) {
      query += ' AND sp.starting_price >= ?';
      params.push(parseFloat(minPrice));
    }

    if (maxPrice) {
      query += ' AND sp.starting_price <= ?';
      params.push(parseFloat(maxPrice));
    }

    if (minRating) {
      query += ' AND COALESCE(review_stats.rating, 0) >= ?';
      params.push(parseFloat(minRating));
    }

    if (search) {
      query += ' AND (u.full_name LIKE ? OR u.profession LIKE ? OR u.skills LIKE ? OR sp.barangay_address LIKE ? OR sp.description LIKE ? OR sp.service_categories LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (category && category !== 'All') {
      query += ' AND JSON_CONTAINS(sp.service_categories, ?)';
      params.push(JSON.stringify(category));
    }

    query += ' ORDER BY COALESCE(review_stats.rating, 0) DESC, COALESCE(review_stats.reviews_count, 0) DESC';

    const [profiles] = await db.query(query, params);

    // Format response
    const formattedProfiles = profiles.map(profile => {
      const categories = parseJsonArray(profile.service_categories, []);
      const skills = parseJsonArray(profile.skills, []);

      return {
        id: profile.id,
        userId: profile.user_id,
        name: profile.provider_name,
        location: profile.barangay_address,
        startingPrice: parseFloat(profile.starting_price),
        pricingUnit: profile.pricing_unit || 'per_day',
        description: profile.description,
        image: profile.banner_image_url || null,
        tags: [...skills, ...categories],
        rating: parseFloat(profile.rating),
        reviews: profile.reviews_count,
        online: deriveOnlineFromLastSeen(profile.last_seen_at),
        verified: Boolean(profile.is_verified),
        profession: profile.profession,
        categories,
      };
    });

    res.json({
      success: true,
      data: formattedProfiles,
      count: formattedProfiles.length
    });
  } catch (error) {
    console.error('Error fetching service profiles:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching service profiles',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Recommend providers for chatbot and assisted discovery flows
exports.getRecommendedProviders = async (req, res) => {
  let connection;

  try {
    const {
      category,
      location,
      maxPrice,
      minRating,
      search,
      language,
      availabilityDate,
      duration,
      limit,
    } = req.query;

    const normalizedLanguage = String(language || '').trim().toLowerCase();
    if (normalizedLanguage && !SUPPORTED_LANGUAGE_CODES.has(normalizedLanguage)) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported language code',
      });
    }

    if (availabilityDate) {
      const parsedDate = parseDateOnly(String(availabilityDate));
      if (!parsedDate) {
        return res.status(400).json({
          success: false,
          message: 'Invalid availabilityDate format. Use YYYY-MM-DD.',
        });
      }
    }

    const resultLimit = Math.min(Math.max(Number(limit || 3), 1), 10);
    const durationMinutes = Math.min(Math.max(Number(duration || 120), 30), 1440);

    connection = await db.getConnection();

    let query = `
      SELECT
        sp.id,
        sp.user_id,
        u.full_name AS provider_name,
        u.last_seen_at,
        sp.barangay_address,
        sp.starting_price,
        sp.pricing_unit,
        sp.service_categories,
        sp.description,
        sp.banner_image_url,
        COALESCE(review_stats.rating, 0) AS rating,
        COALESCE(review_stats.reviews_count, 0) AS reviews_count,
        u.profession,
        u.skills,
        u.is_verified
      FROM service_profiles sp
      JOIN users u ON sp.user_id = u.id
      ${REVIEW_STATS_JOIN}
      WHERE sp.is_published = TRUE
        AND u.is_active = TRUE
    `;

    const params = [];

    if (location) {
      query += ' AND sp.barangay_address LIKE ?';
      params.push(`%${String(location).trim()}%`);
    }

    if (maxPrice) {
      query += ' AND sp.starting_price <= ?';
      params.push(parseFloat(maxPrice));
    }

    if (minRating) {
      query += ' AND COALESCE(review_stats.rating, 0) >= ?';
      params.push(parseFloat(minRating));
    }

    if (search) {
      query += ' AND (u.full_name LIKE ? OR u.profession LIKE ? OR u.skills LIKE ? OR sp.description LIKE ? OR sp.service_categories LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (category && category !== 'All') {
      query += ' AND JSON_CONTAINS(sp.service_categories, ?)';
      params.push(JSON.stringify(category));
    }

    if (normalizedLanguage) {
      query += ' AND EXISTS (SELECT 1 FROM provider_languages pl WHERE pl.service_profile_id = sp.id AND pl.language_code = ?)';
      params.push(normalizedLanguage);
    }

    query += ' ORDER BY COALESCE(review_stats.rating, 0) DESC, COALESCE(review_stats.reviews_count, 0) DESC LIMIT 30';

    const [profiles] = await connection.query(query, params);

    const recommended = [];

    for (const profile of profiles) {
      if (recommended.length >= resultLimit) {
        break;
      }

      if (availabilityDate) {
        const slots = await getAvailableSlotsForDate(connection, {
          serviceProfileId: profile.id,
          providerId: profile.user_id,
          date: formatDateOnly(parseDateOnly(String(availabilityDate))),
          durationMinutes,
          slotStepMinutes: 60,
        });

        if (!slots || slots.length === 0) {
          continue;
        }
      }

      const [languageRows] = await connection.query(
        'SELECT language_code FROM provider_languages WHERE service_profile_id = ? ORDER BY language_code ASC',
        [profile.id]
      );

      const categories = parseJsonArray(profile.service_categories, []);
      const skills = parseJsonArray(profile.skills, []);

      recommended.push({
        id: profile.id,
        userId: profile.user_id,
        name: profile.provider_name,
        location: profile.barangay_address,
        startingPrice: parseFloat(profile.starting_price),
        pricingUnit: profile.pricing_unit || 'per_day',
        description: profile.description,
        image: profile.banner_image_url || null,
        tags: [...skills, ...categories],
        rating: parseFloat(profile.rating),
        reviews: profile.reviews_count,
        online: deriveOnlineFromLastSeen(profile.last_seen_at),
        verified: Boolean(profile.is_verified),
        profession: profile.profession,
        categories,
        languages: languageRows.map((row) => row.language_code),
      });
    }

    return res.json({
      success: true,
      data: {
        providers: recommended,
      },
      count: recommended.length,
    });
  } catch (error) {
    console.error('Error fetching provider recommendations:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch provider recommendations',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Get single profile by ID
exports.getProfileById = async (req, res) => {
  try {
    const { id } = req.params;

    const [profiles] = await db.query(
      `SELECT 
        sp.*,
        COALESCE(review_stats.rating, 0) AS rating,
        COALESCE(review_stats.reviews_count, 0) AS reviews_count,
        u.full_name,
        u.last_seen_at,
        u.profession,
        u.skills,
        u.email,
        u.phone,
        u.is_verified
      FROM service_profiles sp
      JOIN users u ON sp.user_id = u.id
      ${REVIEW_STATS_JOIN}
      WHERE sp.id = ?
        AND sp.is_published = TRUE
        AND u.is_active = TRUE`,
      [id]
    );

    if (profiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service profile not found'
      });
    }

    const profile = profiles[0];

    // Fetch portfolio items; fall back for environments where Stage 1 columns are not migrated yet.
    let portfolioItems = [];
    try {
      const [rows] = await db.query(
        `SELECT id, image_url, caption, display_order,
                service_request_id, job_title, job_description, service_category,
                completed_at, is_published, is_featured, completed_through_platform
         FROM portfolio_items
         WHERE service_profile_id = ?
           AND is_published = TRUE
         ORDER BY is_featured DESC, display_order ASC, created_at DESC`,
        [id]
      );
      portfolioItems = rows;
    } catch (portfolioError) {
      if (!['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE'].includes(portfolioError.code)) {
        throw portfolioError;
      }

      const [legacyRows] = await db.query(
        `SELECT id, image_url, caption, display_order,
                NULL AS service_request_id,
                NULL AS job_title,
                NULL AS job_description,
                NULL AS service_category,
                NULL AS completed_at,
                TRUE AS is_published,
                FALSE AS is_featured,
                FALSE AS completed_through_platform
         FROM portfolio_items
         WHERE service_profile_id = ?
         ORDER BY display_order ASC, created_at DESC`,
        [id]
      );
      portfolioItems = legacyRows;
    }

    // Fetch reviews with client names
    const [reviews] = await db.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.full_name as reviewer_name
       FROM reviews r
       JOIN users u ON r.client_id = u.id
       WHERE r.service_profile_id = ?
       ORDER BY r.created_at DESC`,
      [id]
    );

    let languages = [];
    try {
      const [rows] = await db.query(
        `SELECT language_code
         FROM provider_languages
         WHERE service_profile_id = ?
         ORDER BY language_code ASC`,
        [id]
      );
      languages = rows;
    } catch (languageError) {
      if (!['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(languageError.code)) {
        throw languageError;
      }
    }

    let credentialRows = [];
    try {
      const [rows] = await db.query(
        `SELECT id, credential_name, issuing_organization, issue_date, expiration_date, does_not_expire, related_skills, verification_status
         FROM provider_credentials
         WHERE service_profile_id = ?
         ORDER BY created_at DESC`,
        [id]
      );
      credentialRows = rows;
    } catch (credentialError) {
      if (!['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(credentialError.code)) {
        throw credentialError;
      }
    }

    let availabilitySettings = null;
    try {
      const [settingsRows] = await db.query(
        `SELECT allow_same_day_booking, min_advance_notice_minutes, max_advance_booking_days
         FROM provider_availability_settings
         WHERE service_profile_id = ?
         LIMIT 1`,
        [id]
      );
      availabilitySettings = settingsRows[0] || null;
    } catch (availabilityError) {
      if (!['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(availabilityError.code)) {
        throw availabilityError;
      }
    }

    // Format portfolio items
    const formattedPortfolio = portfolioItems.map(item => ({
      id: item.id,
      src: item.image_url || null,
      caption: item.caption,
      jobTitle: item.job_title,
      jobDescription: item.job_description,
      serviceCategory: item.service_category,
      completedAt: item.completed_at,
      isFeatured: Boolean(item.is_featured),
      completedThroughPlatform: Boolean(item.completed_through_platform),
    }));

    // Format reviews
    const formattedReviews = reviews.map(review => ({
      id: review.id,
      reviewer: review.reviewer_name,
      date: new Date(review.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      rating: review.rating,
      comment: review.comment
    }));

    const categories = parseJsonArray(profile.service_categories, []);
    const skills = parseJsonArray(profile.skills, []);

    const formattedProfile = {
      id: profile.id,
      userId: profile.user_id,
      name: profile.full_name,
      location: profile.barangay_address,
      startingPrice: parseFloat(profile.starting_price),
      pricingUnit: profile.pricing_unit || 'per_day',
      allowSameDayBooking: Boolean(availabilitySettings?.allow_same_day_booking),
      minAdvanceNoticeMinutes: Number(availabilitySettings?.min_advance_notice_minutes || 720),
      maxAdvanceBookingDays: Number(availabilitySettings?.max_advance_booking_days || 60),
      description: profile.description,
      aboutMe: profile.about_me,
      responseTime: profile.response_time || 'Within 24 hours',
      jobsCompleted: profile.jobs_completed || 0,
      image: profile.banner_image_url || null,
      tags: [...skills, ...categories],
      rating: parseFloat(profile.rating),
      reviewsCount: profile.reviews_count,
      online: deriveOnlineFromLastSeen(profile.last_seen_at),
      verified: Boolean(profile.is_verified),
      profession: profile.profession,
      categories,
      isPublished: Boolean(profile.is_published),
      languages: languages.map((row) => row.language_code),
      credentials: credentialRows.map((credential) => {
        const issueYear = credential.issue_date ? new Date(credential.issue_date).getUTCFullYear() : null;
        const isExpired = !credential.does_not_expire
          && credential.expiration_date
          && new Date(credential.expiration_date).getTime() < Date.now();

        return {
          id: credential.id,
          credentialName: credential.credential_name,
          issuingOrganization: credential.issuing_organization,
          issueYear,
          expirationState: credential.does_not_expire
            ? 'does_not_expire'
            : isExpired
              ? 'expired'
              : 'active',
          verified: credential.verification_status === 'verified' && !isExpired,
          relatedSkills: parseJsonArray(credential.related_skills, []),
        };
      }),
      createdAt: profile.created_at,
      portfolio: formattedPortfolio,
      reviews: formattedReviews
    };

    res.json({
      success: true,
      data: formattedProfile
    });
  } catch (error) {
    console.error('Error fetching service profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching service profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get current user's profile
exports.getMyProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const [profiles] = await db.query(
      `SELECT 
        sp.*,
        COALESCE(review_stats.rating, 0) AS rating,
        COALESCE(review_stats.reviews_count, 0) AS reviews_count,
        u.full_name,
        u.last_seen_at,
        u.profession,
        u.skills,
        u.email,
        u.phone,
        u.is_verified
      FROM service_profiles sp
      JOIN users u ON sp.user_id = u.id
      ${REVIEW_STATS_JOIN}
      WHERE sp.user_id = ?`,
      [userId]
    );

    if (profiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'You have not created a service profile yet'
      });
    }

    const profile = profiles[0];
    const categories = parseJsonArray(profile.service_categories, []);
    const skills = parseJsonArray(profile.skills, []);
    const [languages] = await db.query(
      'SELECT language_code FROM provider_languages WHERE service_profile_id = ? ORDER BY language_code',
      [profile.id]
    );

    const formattedProfile = {
      id: profile.id,
      userId: profile.user_id,
      name: profile.full_name,
      location: profile.barangay_address,
      startingPrice: parseFloat(profile.starting_price),
      pricingUnit: profile.pricing_unit || 'per_day',
      description: profile.description,
      image: profile.banner_image_url || null,
      tags: [...skills, ...categories],
      rating: parseFloat(profile.rating),
      reviews: profile.reviews_count,
      online: deriveOnlineFromLastSeen(profile.last_seen_at),
      verified: Boolean(profile.is_verified),
      profession: profile.profession,
      categories,
      languages: languages.map((row) => row.language_code),
      isPublished: Boolean(profile.is_published),
      email: profile.email,
      phone: profile.phone,
      createdAt: profile.created_at
    };

    res.json({
      success: true,
      data: formattedProfile
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Publish/unpublish profile
exports.togglePublish = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { isPublished } = req.body;

    const [result] = await db.query(
      'UPDATE service_profiles SET is_published = ? WHERE user_id = ?',
      [isPublished, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service profile not found'
      });
    }

    res.json({
      success: true,
      message: `Profile ${isPublished ? 'published' : 'unpublished'} successfully`
    });
  } catch (error) {
    console.error('Error updating profile publish status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update portfolio details (about me, skills, response time)
exports.updatePortfolioDetails = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { aboutMe, responseTime } = req.body;
    let skills = req.body.skills;

    // Parse skills if it's a string
    if (typeof skills === 'string') {
      try {
        skills = JSON.parse(skills);
      } catch {
        skills = skills.split(',').map(s => s.trim());
      }
    }

    // Check if user has a service profile
    const [profiles] = await db.query(
      'SELECT id FROM service_profiles WHERE user_id = ?',
      [userId]
    );

    if (profiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'You need to create a service profile first'
      });
    }

    // Update the profile
    await db.query(
      `UPDATE service_profiles 
       SET about_me = ?, response_time = ?
       WHERE user_id = ?`,
      [aboutMe || null, responseTime || 'Within 24 hours', userId]
    );

    // Update skills in users table
    if (skills && Array.isArray(skills)) {
      await db.query(
        'UPDATE users SET skills = ? WHERE id = ?',
        [JSON.stringify(skills), userId]
      );
    }

    res.json({
      success: true,
      message: 'Portfolio details updated successfully'
    });
  } catch (error) {
    console.error('Error updating portfolio details:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating portfolio details'
    });
  }
};

// Add portfolio image
exports.addPortfolioImage = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { caption } = req.body;
    let imageUrl = null;
    let imagePublicId = null;

    if (req.file) {
      if (hasCloudinaryConfig()) {
        const uploadResult = await uploadImageBuffer({
          buffer: req.file.buffer,
          mimeType: req.file.mimetype,
          folder: 'serbisyo-toledo/portfolio',
        });

        imageUrl = uploadResult.secure_url;
        imagePublicId = uploadResult.public_id;
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Image file is required'
      });
    }

    // Get service profile id
    const [profiles] = await db.query(
      'SELECT id FROM service_profiles WHERE user_id = ?',
      [userId]
    );

    if (profiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'You need to create a service profile first'
      });
    }

    const serviceProfileId = profiles[0].id;

    // Get display order for new image
    const [orderResult] = await db.query(
      'SELECT COALESCE(MAX(display_order), 0) + 1 as nextOrder FROM portfolio_items WHERE service_profile_id = ?',
      [serviceProfileId]
    );

    const [result] = await db.query(
      `INSERT INTO portfolio_items (service_profile_id, image_url, image_public_id, caption, display_order)
       VALUES (?, ?, ?, ?, ?)`,
      [serviceProfileId, imageUrl, imagePublicId, caption || '', orderResult[0].nextOrder]
    );

    res.status(201).json({
      success: true,
      message: 'Portfolio image added successfully',
      data: {
        id: result.insertId,
        caption: caption || ''
      }
    });
  } catch (error) {
    console.error('Error adding portfolio image:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding portfolio image'
    });
  }
};

// Delete portfolio image
exports.deletePortfolioImage = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { imageId } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Verify ownership
    const [images] = await db.query(
      `SELECT pi.id, pi.image_public_id FROM portfolio_items pi
       JOIN service_profiles sp ON pi.service_profile_id = sp.id
       WHERE pi.id = ? AND sp.user_id = ?`,
      [imageId, userId]
    );

    if (images.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Image not found or not authorized'
      });
    }

    if (images[0].image_public_id) {
      await deleteImageByPublicId(images[0].image_public_id);
    }

    await db.query('DELETE FROM portfolio_items WHERE id = ?', [imageId]);

    res.json({
      success: true,
      message: 'Portfolio image deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting portfolio image:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting portfolio image'
    });
  }
};

// Get full portfolio for editing
exports.getMyPortfolio = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get profile with portfolio items
    const [profiles] = await db.query(
      `SELECT 
        sp.id, sp.about_me, sp.response_time, sp.jobs_completed,
        u.skills
      FROM service_profiles sp
      JOIN users u ON sp.user_id = u.id
      WHERE sp.user_id = ?`,
      [userId]
    );

    if (profiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service profile not found'
      });
    }

    const profile = profiles[0];

    // Get portfolio items
    const [portfolioItems] = await db.query(
      `SELECT id, image_url, caption, display_order,
              service_request_id, job_title, job_description, service_category,
              completed_at, is_published, is_featured, completed_through_platform
       FROM portfolio_items
       WHERE service_profile_id = ?
       ORDER BY display_order`,
      [profile.id]
    );

    const formattedPortfolio = portfolioItems.map(item => ({
      id: item.id,
      src: item.image_url || null,
      caption: item.caption,
      serviceRequestId: item.service_request_id,
      jobTitle: item.job_title,
      jobDescription: item.job_description,
      serviceCategory: item.service_category,
      completedAt: item.completed_at,
      isPublished: Boolean(item.is_published),
      isFeatured: Boolean(item.is_featured),
      completedThroughPlatform: Boolean(item.completed_through_platform),
    }));

    res.json({
      success: true,
      data: {
        aboutMe: profile.about_me || '',
        responseTime: profile.response_time || 'Within 24 hours',
        jobsCompleted: profile.jobs_completed || 0,
        skills: JSON.parse(profile.skills || '[]'),
        portfolio: formattedPortfolio
      }
    });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching portfolio'
    });
  }
};

exports.getAvailableSlots = async (req, res) => {
  let connection;

  try {
    const serviceProfileId = Number(req.params.id);
    const date = String(req.query.date || '').trim();
    const duration = Number(req.query.duration || 120);
    const bookingType = String(req.query.bookingType || 'one_day');
    const multiDayMode = String(req.query.multiDayMode || 'continuous');
    const endDate = String(req.query.endDate || date).trim();
    const selectedDates = Array.from(new Set(
      String(req.query.selectedDates || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    )).sort();

    if (!serviceProfileId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Profile and date are required.'
      });
    }

    const parsedStart = parseDateOnly(date);
    const parsedEnd = parseDateOnly(endDate);
    if (!parsedStart || !parsedEnd || parsedEnd < parsedStart) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date range'
      });
    }

    connection = await db.getConnection();

    const [profiles] = await connection.query(
      `SELECT sp.id, sp.user_id AS provider_id, sp.is_published, u.is_active
       FROM service_profiles sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.id = ?
       LIMIT 1`,
      [serviceProfileId]
    );

    if (profiles.length === 0 || !profiles[0].is_published || !profiles[0].is_active) {
      return res.status(404).json({
        success: false,
        message: 'Service profile not found'
      });
    }

    if (bookingType !== 'multi_day') {
      const baseSlots = await getAvailableSlotsForDate(connection, {
        serviceProfileId,
        providerId: profiles[0].provider_id,
        date: formatDateOnly(parsedStart),
        durationMinutes: duration,
        slotStepMinutes: 60,
      });

      return res.json({
        success: true,
        data: {
          date: formatDateOnly(parsedStart),
          multiDayMode: 'continuous',
          slots: baseSlots,
        }
      });
    }

    let dates = [];
    if (multiDayMode === 'specific_dates') {
      const validated = selectedDates.filter((value) => Boolean(parseDateOnly(value)));
      if (validated.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'selectedDates is required when multiDayMode is specific_dates',
        });
      }
      dates = validated;
    } else {
      for (let cursor = new Date(parsedStart); cursor <= parsedEnd; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        dates.push(formatDateOnly(cursor));
      }
    }

    const anchorDate = dates[0];
    const baseSlots = await getAvailableSlotsForDate(connection, {
      serviceProfileId,
      providerId: profiles[0].provider_id,
      date: anchorDate,
      durationMinutes: duration,
      slotStepMinutes: 60,
    });

    // Load each day once, then intersect by slot time.
    const slotsByDay = new Map();
    for (const day of dates) {
      const daySlots = await getAvailableSlotsForDate(connection, {
        serviceProfileId,
        providerId: profiles[0].provider_id,
        date: day,
        durationMinutes: duration,
        slotStepMinutes: 60,
      });
      slotsByDay.set(day, new Set(daySlots.map((candidate) => candidate.time)));
    }

    const multiDaySlots = baseSlots.filter((slot) => (
      dates.every((day) => slotsByDay.get(day)?.has(slot.time))
    ));

    return res.json({
      success: true,
      data: {
        date: anchorDate,
        endDate: dates[dates.length - 1],
        multiDayMode: multiDayMode === 'specific_dates' ? 'specific_dates' : 'continuous',
        selectedDates: dates,
        slots: multiDaySlots,
      }
    });
  } catch (error) {
    console.error('Error fetching available slots:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch available slots'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

exports.getAvailableDates = async (req, res) => {
  let connection;

  try {
    const serviceProfileId = Number(req.params.id);
    const fromDateRaw = String(req.query.fromDate || '').trim();
    const toDateRaw = String(req.query.toDate || '').trim();
    const duration = Number(req.query.duration || 120);

    if (!serviceProfileId || !fromDateRaw || !toDateRaw) {
      return res.status(400).json({
        success: false,
        message: 'Profile, fromDate, and toDate are required.',
      });
    }

    const fromDate = parseDateOnly(fromDateRaw);
    const toDate = parseDateOnly(toDateRaw);

    if (!fromDate || !toDate || toDate < fromDate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date range',
      });
    }

    const dayWindow = Math.floor((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (dayWindow > 90) {
      return res.status(400).json({
        success: false,
        message: 'Date range too large. Maximum 90 days.',
      });
    }

    connection = await db.getConnection();

    const [profiles] = await connection.query(
      `SELECT sp.id, sp.user_id AS provider_id, sp.is_published, u.is_active
       FROM service_profiles sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.id = ?
       LIMIT 1`,
      [serviceProfileId]
    );

    if (profiles.length === 0 || !profiles[0].is_published || !profiles[0].is_active) {
      return res.status(404).json({
        success: false,
        message: 'Service profile not found',
      });
    }

    const providerId = profiles[0].provider_id;
    const availableDates = [];

    for (const cursor = new Date(fromDate); cursor <= toDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const date = formatDateOnly(cursor);
      const slots = await getAvailableSlotsForDate(connection, {
        serviceProfileId,
        providerId,
        date,
        durationMinutes: duration,
        slotStepMinutes: 60,
      });

      if (slots.length > 0) {
        availableDates.push(date);
      }
    }

    return res.json({
      success: true,
      data: {
        fromDate: formatDateOnly(fromDate),
        toDate: formatDateOnly(toDate),
        dates: availableDates,
      },
    });
  } catch (error) {
    console.error('Error fetching available dates:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch available dates',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

exports.getMyAvailability = async (req, res) => {
  try {
    const userId = req.user?.userId;

    const [profiles] = await db.query(
      'SELECT id FROM service_profiles WHERE user_id = ? LIMIT 1',
      [userId]
    );

    if (profiles.length === 0) {
      return res.status(404).json({ success: false, message: 'Service profile not found' });
    }

    const serviceProfileId = profiles[0].id;

    const connection = await db.getConnection();
    try {
      const settings = await ensureAvailabilitySettings(connection, serviceProfileId);

      const [weeklyBlocks] = await connection.query(
        `SELECT id, day_of_week, start_time, end_time, is_available
         FROM provider_weekly_availability
         WHERE service_profile_id = ?
         ORDER BY day_of_week, start_time`,
        [serviceProfileId]
      );

      const [exceptions] = await connection.query(
        `SELECT id, exception_date, start_time, end_time, exception_type, reason
         FROM provider_availability_exceptions
         WHERE service_profile_id = ?
         ORDER BY exception_date ASC, start_time ASC`,
        [serviceProfileId]
      );

      return res.json({
        success: true,
        data: {
          settings,
          weeklyBlocks,
          exceptions,
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching provider availability:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch availability'
    });
  }
};

exports.saveMyAvailability = async (req, res) => {
  let connection;

  try {
    const userId = req.user?.userId;
    const { settings, weeklyBlocks } = req.body;

    const [profiles] = await db.query(
      'SELECT id FROM service_profiles WHERE user_id = ? LIMIT 1',
      [userId]
    );

    if (profiles.length === 0) {
      return res.status(404).json({ success: false, message: 'Service profile not found' });
    }

    const serviceProfileId = profiles[0].id;

    connection = await db.getConnection();
    await connection.beginTransaction();

    await ensureAvailabilitySettings(connection, serviceProfileId);

    const allowSameDay = Boolean(settings?.allowSameDayBooking);
    const minAdvanceNotice = Number(settings?.minAdvanceNoticeMinutes ?? 720);
    const maxAdvanceDays = Number(settings?.maxAdvanceBookingDays ?? 60);

    if (minAdvanceNotice < 0 || minAdvanceNotice > 14 * 24 * 60) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Invalid minimum advance notice' });
    }

    if (maxAdvanceDays < 1 || maxAdvanceDays > 180) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Invalid maximum advance booking days' });
    }

    await connection.query(
      `UPDATE provider_availability_settings
       SET allow_same_day_booking = ?, min_advance_notice_minutes = ?, max_advance_booking_days = ?
       WHERE service_profile_id = ?`,
      [allowSameDay, minAdvanceNotice, maxAdvanceDays, serviceProfileId]
    );

    await connection.query('DELETE FROM provider_weekly_availability WHERE service_profile_id = ?', [serviceProfileId]);

    const seenKeys = new Set();

    for (const block of Array.isArray(weeklyBlocks) ? weeklyBlocks : []) {
      const dayOfWeek = Number(block.dayOfWeek);
      const start = parseTimeInputToSql(block.startTime);
      const end = parseTimeInputToSql(block.endTime);
      const isAvailable = block.isAvailable !== false;

      if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Invalid day of week in availability block' });
      }

      if (!start || !end || end <= start) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Invalid time range in availability block' });
      }

      const key = `${dayOfWeek}-${start}-${end}`;
      if (seenKeys.has(key)) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Duplicate weekly availability block detected' });
      }
      seenKeys.add(key);

      await connection.query(
        `INSERT INTO provider_weekly_availability
         (service_profile_id, day_of_week, start_time, end_time, is_available)
         VALUES (?, ?, ?, ?, ?)`,
        [serviceProfileId, dayOfWeek, start, end, isAvailable]
      );
    }

    await connection.commit();

    return res.json({
      success: true,
      message: 'Availability updated successfully'
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Error saving provider availability:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save availability'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

exports.addAvailabilityException = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { exceptionDate, startTime, endTime, exceptionType, reason } = req.body;

    const parsedDate = parseDateOnly(exceptionDate);
    if (!parsedDate) {
      return res.status(400).json({ success: false, message: 'Invalid exception date' });
    }

    const today = new Date();
    const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    if (parsedDate < todayUtc) {
      return res.status(400).json({ success: false, message: 'Past dates are not allowed' });
    }

    if (!['available', 'unavailable', 'booked', 'vacation'].includes(exceptionType)) {
      return res.status(400).json({ success: false, message: 'Invalid exception type' });
    }

    const normalizedStart = startTime ? parseTimeInputToSql(startTime) : null;
    const normalizedEnd = endTime ? parseTimeInputToSql(endTime) : null;

    if ((normalizedStart && !normalizedEnd) || (!normalizedStart && normalizedEnd)) {
      return res.status(400).json({ success: false, message: 'Start and end time must both be provided' });
    }

    if (normalizedStart && normalizedEnd && normalizedEnd <= normalizedStart) {
      return res.status(400).json({ success: false, message: 'End time must be after start time' });
    }

    const [profiles] = await db.query('SELECT id FROM service_profiles WHERE user_id = ? LIMIT 1', [userId]);
    if (profiles.length === 0) {
      return res.status(404).json({ success: false, message: 'Service profile not found' });
    }

    await db.query(
      `INSERT INTO provider_availability_exceptions
       (service_profile_id, exception_date, start_time, end_time, exception_type, reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        profiles[0].id,
        formatDateOnly(parsedDate),
        normalizedStart,
        normalizedEnd,
        exceptionType,
        reason ? String(reason).trim().slice(0, 255) : null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Availability exception saved successfully'
    });
  } catch (error) {
    console.error('Error adding availability exception:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save availability exception'
    });
  }
};

exports.deleteAvailabilityException = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const exceptionId = Number(req.params.exceptionId);

    if (!exceptionId) {
      return res.status(400).json({ success: false, message: 'Invalid exception id' });
    }

    const [result] = await db.query(
      `DELETE pae
       FROM provider_availability_exceptions pae
       JOIN service_profiles sp ON sp.id = pae.service_profile_id
       WHERE pae.id = ? AND sp.user_id = ?`,
      [exceptionId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Exception not found' });
    }

    return res.json({ success: true, message: 'Exception removed successfully' });
  } catch (error) {
    console.error('Error deleting availability exception:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete exception' });
  }
};

exports.getMyLanguages = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const [profiles] = await db.query('SELECT id FROM service_profiles WHERE user_id = ? LIMIT 1', [userId]);

    if (profiles.length === 0) {
      return res.status(404).json({ success: false, message: 'Service profile not found' });
    }

    const [rows] = await db.query(
      'SELECT language_code FROM provider_languages WHERE service_profile_id = ? ORDER BY language_code',
      [profiles[0].id]
    );

    return res.json({
      success: true,
      data: {
        languages: rows.map((row) => row.language_code)
      }
    });
  } catch (error) {
    console.error('Error fetching provider languages:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch languages' });
  }
};

exports.updateMyLanguages = async (req, res) => {
  let connection;

  try {
    const userId = req.user?.userId;
    const payload = Array.isArray(req.body.languages) ? req.body.languages : [];
    const normalized = Array.from(new Set(payload.map((value) => String(value || '').trim()).filter(Boolean)));

    if (normalized.some((code) => !SUPPORTED_LANGUAGE_CODES.has(code))) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported language code provided'
      });
    }

    const [profiles] = await db.query('SELECT id FROM service_profiles WHERE user_id = ? LIMIT 1', [userId]);
    if (profiles.length === 0) {
      return res.status(404).json({ success: false, message: 'Service profile not found' });
    }

    const serviceProfileId = profiles[0].id;
    connection = await db.getConnection();
    await connection.beginTransaction();

    await connection.query('DELETE FROM provider_languages WHERE service_profile_id = ?', [serviceProfileId]);

    for (const languageCode of normalized) {
      await connection.query(
        'INSERT INTO provider_languages (service_profile_id, language_code) VALUES (?, ?)',
        [serviceProfileId, languageCode]
      );
    }

    await connection.commit();

    return res.json({
      success: true,
      message: 'Languages updated successfully',
      data: { languages: normalized }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Error updating provider languages:', error);
    return res.status(500).json({ success: false, message: 'Failed to update languages' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

exports.listEligibleCompletedRequests = async (req, res) => {
  try {
    const userId = req.user?.userId;

    const [profiles] = await db.query('SELECT id FROM service_profiles WHERE user_id = ? LIMIT 1', [userId]);
    if (profiles.length === 0) {
      return res.status(404).json({ success: false, message: 'Service profile not found' });
    }

    const serviceProfileId = profiles[0].id;

    const [rows] = await db.query(
      `SELECT sr.id, sr.job_title, sr.job_details, sr.created_at, sr.start_date, sr.end_date
       FROM service_requests sr
       LEFT JOIN portfolio_items pi ON pi.service_request_id = sr.id AND pi.service_profile_id = sr.service_profile_id
       WHERE sr.service_profile_id = ?
         AND sr.provider_id = ?
         AND sr.status = 'completed'
         AND pi.id IS NULL
       ORDER BY sr.created_at DESC`,
      [serviceProfileId, userId]
    );

    return res.json({
      success: true,
      data: {
        requests: rows,
      }
    });
  } catch (error) {
    console.error('Error listing completed requests:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch completed requests' });
  }
};

exports.createPortfolioFromCompletedRequest = async (req, res) => {
  let connection;

  try {
    const userId = req.user?.userId;
    const {
      serviceRequestId,
      caption,
      description,
      serviceCategory,
      isPublished,
      isFeatured,
    } = req.body;

    if (!serviceRequestId) {
      return res.status(400).json({ success: false, message: 'serviceRequestId is required' });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [profiles] = await connection.query('SELECT id FROM service_profiles WHERE user_id = ? LIMIT 1', [userId]);
    if (profiles.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Service profile not found' });
    }

    const serviceProfileId = profiles[0].id;

    const [requests] = await connection.query(
      `SELECT id, job_title, job_details, status, start_date, end_date
       FROM service_requests
       WHERE id = ? AND service_profile_id = ? AND provider_id = ?
       LIMIT 1 FOR UPDATE`,
      [serviceRequestId, serviceProfileId, userId]
    );

    if (requests.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Completed request not found for this provider' });
    }

    if (requests[0].status !== 'completed') {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Only completed requests can be linked to portfolio' });
    }

    const [existing] = await connection.query(
      'SELECT id FROM portfolio_items WHERE service_request_id = ? LIMIT 1',
      [serviceRequestId]
    );

    if (existing.length > 0) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'This completed request is already linked to a portfolio item' });
    }

    const [orderResult] = await connection.query(
      'SELECT COALESCE(MAX(display_order), 0) + 1 AS nextOrder FROM portfolio_items WHERE service_profile_id = ?',
      [serviceProfileId]
    );

    const safeDescription = String(description || '').trim();

    const [insertResult] = await connection.query(
      `INSERT INTO portfolio_items (
         service_profile_id,
         service_request_id,
         image_url,
         image_public_id,
         caption,
         display_order,
         job_title,
         job_description,
         service_category,
         completed_at,
         is_published,
         is_featured,
         completed_through_platform
       )
      VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, NOW(), ?, ?, TRUE)`,
      [
        serviceProfileId,
        serviceRequestId,
        String(caption || '').trim(),
        orderResult[0].nextOrder,
        requests[0].job_title,
        safeDescription,
        String(serviceCategory || '').trim() || null,
        isPublished !== false,
        Boolean(isFeatured),
      ]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Completed job linked to portfolio successfully',
      data: { id: insertResult.insertId }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Error creating portfolio from request:', error);
    return res.status(500).json({ success: false, message: 'Failed to link completed request' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

exports.getMyCredentials = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const [profiles] = await db.query('SELECT id FROM service_profiles WHERE user_id = ? LIMIT 1', [userId]);

    if (profiles.length === 0) {
      return res.status(404).json({ success: false, message: 'Service profile not found' });
    }

    const [credentials] = await db.query(
      `SELECT id, credential_name, credential_type, issuing_organization, credential_id,
              issue_date, expiration_date, does_not_expire, credential_url, related_skills,
              verification_status, verification_notes, created_at, updated_at
       FROM provider_credentials
       WHERE service_profile_id = ?
       ORDER BY created_at DESC`,
      [profiles[0].id]
    );

    return res.json({
      success: true,
      data: {
        credentials: credentials.map((credential) => ({
          ...credential,
          related_skills: parseJsonArray(credential.related_skills, []),
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching provider credentials:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch credentials' });
  }
};

exports.createCredential = async (req, res) => {
  try {
    const userId = req.user?.userId;

    const [profiles] = await db.query('SELECT id FROM service_profiles WHERE user_id = ? LIMIT 1', [userId]);
    if (profiles.length === 0) {
      return res.status(404).json({ success: false, message: 'Service profile not found' });
    }

    const serviceProfileId = profiles[0].id;
    const payload = req.body;
    const credentialName = String(payload.credentialName || '').trim();
    const credentialType = String(payload.credentialType || '').trim();
    const issuingOrganization = String(payload.issuingOrganization || '').trim();
    const credentialUrl = String(payload.credentialUrl || '').trim();
    const doesNotExpire = Boolean(payload.doesNotExpire);
    const relatedSkills = Array.isArray(payload.relatedSkills) ? payload.relatedSkills : [];

    if (!credentialName || !credentialType || !issuingOrganization) {
      return res.status(400).json({ success: false, message: 'Credential name, type, and issuing organization are required' });
    }

    if (!SUPPORTED_CREDENTIAL_TYPES.has(credentialType)) {
      return res.status(400).json({ success: false, message: 'Unsupported credential type' });
    }

    if (credentialUrl) {
      try {
        const parsedUrl = new URL(credentialUrl);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          throw new Error('invalid protocol');
        }
      } catch {
        return res.status(400).json({ success: false, message: 'Credential URL must be a valid http(s) URL' });
      }
    }

    if (payload.issueDate && Number.isNaN(Date.parse(payload.issueDate))) {
      return res.status(400).json({ success: false, message: 'Invalid issue date' });
    }

    if (!doesNotExpire && payload.expirationDate && Number.isNaN(Date.parse(payload.expirationDate))) {
      return res.status(400).json({ success: false, message: 'Invalid expiration date' });
    }

    if (!doesNotExpire && payload.issueDate && payload.expirationDate) {
      const issueDate = new Date(payload.issueDate);
      const expirationDate = new Date(payload.expirationDate);
      if (expirationDate < issueDate) {
        return res.status(400).json({ success: false, message: 'Expiration date cannot be earlier than issue date' });
      }
    }

    let documentUrl = null;
    let documentPublicId = null;
    let documentData = null;
    let documentMime = null;

    if (req.file) {
      if (hasCloudinaryConfig()) {
        const uploadResult = await uploadImageBuffer({
          buffer: req.file.buffer,
          mimeType: req.file.mimetype,
          folder: 'serbisyo-toledo/credentials',
          resourceType: req.file.mimetype === 'application/pdf' ? 'raw' : 'image',
        });

        documentUrl = uploadResult.secure_url;
        documentPublicId = uploadResult.public_id;
      } else {
        documentData = req.file.buffer;
        documentMime = req.file.mimetype;
      }
    }

    const [result] = await db.query(
      `INSERT INTO provider_credentials (
         service_profile_id,
         credential_name,
         credential_type,
         issuing_organization,
         credential_id,
         issue_date,
         expiration_date,
         does_not_expire,
         credential_url,
         related_skills,
         document_url,
         document_public_id,
         document_data,
         document_mime,
         verification_status,
         verification_notes
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unverified', NULL)`,
      [
        serviceProfileId,
        credentialName,
        credentialType,
        issuingOrganization,
        String(payload.credentialId || '').trim() || null,
        payload.issueDate || null,
        doesNotExpire ? null : (payload.expirationDate || null),
        doesNotExpire,
        credentialUrl || null,
        JSON.stringify(relatedSkills),
        documentUrl,
        documentPublicId,
        documentData,
        documentMime,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Credential created successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Error creating credential:', error);
    return res.status(500).json({ success: false, message: 'Failed to create credential' });
  }
};

exports.submitCredentialForReview = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const credentialId = Number(req.params.credentialId);

    if (!credentialId) {
      return res.status(400).json({ success: false, message: 'Invalid credential id' });
    }

    const [result] = await db.query(
      `UPDATE provider_credentials pc
       JOIN service_profiles sp ON sp.id = pc.service_profile_id
       SET pc.verification_status = 'pending', pc.verification_notes = NULL, pc.reviewed_by = NULL, pc.reviewed_at = NULL
       WHERE pc.id = ? AND sp.user_id = ?`,
      [credentialId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Credential not found' });
    }

    return res.json({ success: true, message: 'Credential submitted for review' });
  } catch (error) {
    console.error('Error submitting credential:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit credential' });
  }
};
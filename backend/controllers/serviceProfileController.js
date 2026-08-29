const db = require('../config/database');
const { parseJsonArray } = require('../utils/jsonHelpers');
const {
  SERVICE_TAXONOMY,
  toPublicTaxonomy,
  normalizeCategoryLabels,
  getCategoryFilterLabels,
  getServiceTypesForProfile,
  getServiceTypeByKey,
  isLegacyCategoryValue,
  validateServiceTypeKeysForCategories,
} = require('../config/serviceTaxonomy');
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

const SUPPORTED_LANGUAGE_CODES = new Set(['ceb', 'en', 'fil']);
const SUPPORTED_PRICING_UNITS = new Set(['per_day']);
const SUPPORTED_AVAILABILITY_STATUSES = new Set(['available', 'unavailable']);
const PRESENCE_WINDOW_MINUTES = 5;

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const toCount = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
};

const toDateOnlyString = (value) => {
  if (!value) return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
};
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

// Booking times are stored as Toledo/Philippine local wall-clock values.
// Railway commonly runs in UTC, so derive the current Toledo time explicitly.
const TOLEDO_NOW_SQL = `DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)`;

// A provider is automatically considered busy when they are actively travelling to/doing a job,
// or when the current Toledo time falls inside an accepted booking's daily booked window.
const ACTIVE_BOOKING_EXISTS_SQL = `
  EXISTS (
    SELECT 1
    FROM service_requests sr_busy
    WHERE sr_busy.service_profile_id = sp.id
      AND (
        sr_busy.status IN ('on_the_way', 'in_progress')
        OR (
          sr_busy.status = 'accepted'
          AND sr_busy.start_date IS NOT NULL
          AND sr_busy.end_date IS NOT NULL
          AND sr_busy.start_time IS NOT NULL
          AND sr_busy.estimated_duration_minutes IS NOT NULL
          AND DATE(${TOLEDO_NOW_SQL}) BETWEEN sr_busy.start_date AND sr_busy.end_date
          AND TIME(${TOLEDO_NOW_SQL}) >= sr_busy.start_time
          AND TIME(${TOLEDO_NOW_SQL}) < ADDTIME(
            sr_busy.start_time,
            SEC_TO_TIME(sr_busy.estimated_duration_minutes * 60)
          )
        )
      )
  )
`;

const FUTURE_AVAILABILITY_CONFIGURED_SQL = `
  (
    EXISTS (
      SELECT 1
      FROM provider_availability_exceptions pae_future
      WHERE pae_future.service_profile_id = sp.id
        AND pae_future.exception_type = 'available'
        AND pae_future.exception_date >= DATE(${TOLEDO_NOW_SQL})
    )
    OR EXISTS (
      SELECT 1
      FROM provider_weekly_availability pwa_future
      WHERE pwa_future.service_profile_id = sp.id
        AND pwa_future.is_available = TRUE
    )
  )
`;

const derivePublicAvailabilityStatus = (profile, hasFutureBookableSlot = null) => {
  if (!Boolean(profile.show_availability_status)) {
    return null;
  }

  if (String(profile.availability_status || 'available').toLowerCase() === 'unavailable') {
    return 'unavailable';
  }

  if (Boolean(profile.has_active_booking)) {
    return 'busy';
  }

  if (hasFutureBookableSlot === false) {
    return 'no_slots';
  }

  if (hasFutureBookableSlot === true) {
    return 'available';
  }

  return Boolean(profile.has_future_availability_config)
    ? 'accepting_requests'
    : 'no_slots';
};

const getToledoTodayIso = () => {
  const shifted = new Date(Date.now() + (8 * 60 * 60 * 1000));
  return shifted.toISOString().slice(0, 10);
};

const addDaysIso = (dateString, days) => {
  const parsed = parseDateOnly(dateString);
  if (!parsed) return '';
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return formatDateOnly(parsed);
};

const findNextBookableSlot = async (queryable, profile) => {
  if (String(profile.availability_status || 'available').toLowerCase() === 'unavailable') {
    return null;
  }

  const maxAdvanceDays = Math.min(
    Math.max(Number(profile.max_advance_booking_days || 60), 1),
    365
  );
  const todayIso = getToledoTodayIso();
  const endIso = addDaysIso(todayIso, maxAdvanceDays);
  const candidateDates = new Set();

  try {
    const [specificRows] = await queryable.query(
      `SELECT DISTINCT DATE_FORMAT(exception_date, '%Y-%m-%d') AS service_date
       FROM provider_availability_exceptions
       WHERE service_profile_id = ?
         AND exception_type = 'available'
         AND exception_date BETWEEN ? AND ?
       ORDER BY exception_date ASC`,
      [profile.id, todayIso, endIso]
    );

    for (const row of specificRows) {
      if (row.service_date) candidateDates.add(String(row.service_date));
    }

    const [weeklyRows] = await queryable.query(
      `SELECT DISTINCT day_of_week
       FROM provider_weekly_availability
       WHERE service_profile_id = ?
         AND is_available = TRUE`,
      [profile.id]
    );
    const weeklyDays = new Set(weeklyRows.map((row) => Number(row.day_of_week)));

    if (weeklyDays.size > 0) {
      for (let offset = 0; offset <= maxAdvanceDays; offset += 1) {
        const date = addDaysIso(todayIso, offset);
        const parsed = parseDateOnly(date);
        if (parsed && weeklyDays.has(parsed.getUTCDay())) {
          candidateDates.add(date);
        }
      }
    }

    for (const date of Array.from(candidateDates).sort()) {
      const slots = await getAvailableSlotsForDate(queryable, {
        serviceProfileId: profile.id,
        providerId: profile.user_id,
        date,
        durationMinutes: 30,
        slotStepMinutes: 30,
      });

      if (slots.length > 0) {
        return {
          date,
          time: slots[0].time,
          endTime: slots[0].endTime,
        };
      }
    }
  } catch (error) {
    if (!['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(error.code)) {
      throw error;
    }
  }

  return null;
};

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

const parseMaybeJsonArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [value];
    }
  }

  if (value == null) {
    return [];
  }

  return [value];
};

const applyProviderLanguages = async (serviceProfileId, languageCodes = []) => {
  await db.query('DELETE FROM provider_languages WHERE service_profile_id = ?', [serviceProfileId]);

  for (const languageCode of languageCodes) {
    await db.query(
      'INSERT INTO provider_languages (service_profile_id, language_code) VALUES (?, ?)',
      [serviceProfileId, languageCode]
    );
  }
};

// Canonical: Apply category key assignments to relational table
// Called within a transaction context
const applyProfileCategories = async (connection, serviceProfileId, categoryKeys = []) => {
  // Delete old assignments
  await connection.query(
    'DELETE FROM service_profile_categories WHERE service_profile_id = ?',
    [serviceProfileId]
  );

  // Insert new assignments
  for (const categoryKey of categoryKeys) {
    await connection.query(
      'INSERT INTO service_profile_categories (service_profile_id, category_key) VALUES (?, ?)',
      [serviceProfileId, categoryKey]
    );
  }
};

// Canonical: Apply service type key assignments to relational table
// Called within a transaction context
const applyProfileServiceTypes = async (connection, serviceProfileId, serviceTypeKeys = []) => {
  // Delete old assignments
  await connection.query(
    'DELETE FROM service_profile_types WHERE service_profile_id = ?',
    [serviceProfileId]
  );

  // Insert new assignments
  for (const typeKey of serviceTypeKeys) {
    await connection.query(
      'INSERT INTO service_profile_types (service_profile_id, service_type_key) VALUES (?, ?)',
      [serviceProfileId, typeKey]
    );
  }
};

// Canonical: Read category keys for a profile
const getProfileCategoryKeys = async (connection, serviceProfileId) => {
  const [rows] = await connection.query(
    'SELECT category_key FROM service_profile_categories WHERE service_profile_id = ? ORDER BY category_key',
    [serviceProfileId]
  );
  return rows.map((row) => row.category_key);
};

// Canonical: Read service type keys for a profile
const getProfileServiceTypeKeys = async (connection, serviceProfileId) => {
  const [rows] = await connection.query(
    'SELECT service_type_key FROM service_profile_types WHERE service_profile_id = ? ORDER BY service_type_key',
    [serviceProfileId]
  );
  return rows.map((row) => row.service_type_key);
};

// Canonical: Read full taxonomy assignments for a profile
const getProfileTaxonomyAssignments = async (connection, serviceProfileId) => {
  const categoryKeys = await getProfileCategoryKeys(connection, serviceProfileId);
  const serviceTypeKeys = await getProfileServiceTypeKeys(connection, serviceProfileId);
  return { categoryKeys, serviceTypeKeys };
};

// Create or update service profile (CANONICAL V3.1)
// Persists category/type assignments to relational tables only (NOT JSON columns)
exports.createOrUpdateProfile = async (req, res) => {
  let connection;
  
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check user exists and is tradesperson
    const [providerRows] = await db.query(
      'SELECT user_type, is_verified, is_active FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (providerRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service provider account not found'
      });
    }

    if (providerRows[0].user_type !== 'tradesperson') {
      return res.status(403).json({
        success: false,
        code: 'SERVICE_PROVIDER_REQUIRED',
        message: 'Only service providers can manage a service listing'
      });
    }

    // New profiles require verification
    const [existingProfile] = await db.query(
      'SELECT id, banner_image_public_id FROM service_profiles WHERE user_id = ?',
      [userId]
    );

    if (existingProfile.length === 0 && !providerRows[0].is_verified) {
      return res.status(403).json({
        success: false,
        code: 'PROVIDER_VERIFICATION_REQUIRED',
        message: 'Your service provider account must be verified before you can create a Service Listing.'
      });
    }

    // Extract and normalize input
    const { barangayAddress, startingPrice, description } = req.body;
    let serviceCategories = req.body.serviceCategories || [];
    let serviceTypes = req.body.serviceTypes || [];
    let languages = req.body.languages || [];
    let bannerImageUrl = null;
    let bannerImagePublicId = null;

    // Normalize input arrays
    serviceCategories = parseJsonArray(serviceCategories, []);
    serviceTypes = parseJsonArray(serviceTypes, []);
    if (typeof languages === 'string') {
      try {
        languages = JSON.parse(languages);
      } catch {
        languages = [languages];
      }
    }

    // Validate required fields
    if (!barangayAddress || !startingPrice) {
      return res.status(400).json({
        success: false,
        message: 'barangayAddress and startingPrice are required'
      });
    }

    // Validate and normalize languages
    const normalizedLanguages = normalizeLanguageCodes(languages);
    if (normalizedLanguages.some((code) => !SUPPORTED_LANGUAGE_CODES.has(code))) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported language code provided'
      });
    }

    // Check for legacy categories
    const hasLegacyRepair = serviceCategories.some((category) => isLegacyCategoryValue(category));
    if (hasLegacyRepair) {
      return res.status(400).json({
        success: false,
        message: 'Repair is a legacy category. Please choose a specific service category.'
      });
    }

    // Convert category labels to keys (for transition compatibility)
    const normalizedCategoryLabels = normalizeCategoryLabels(serviceCategories, { preserveUnknown: false });
    
    if (normalizedCategoryLabels.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one valid service category is required'
      });
    }

    // Get category keys from labels
    const categoryKeys = normalizedCategoryLabels.map((label) => {
      const category = SERVICE_TAXONOMY.find((c) => c.label === label);
      return category ? category.key : null;
    }).filter(Boolean);

    if (categoryKeys.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Unable to resolve service category keys'
      });
    }

    // Validate service types belong to selected categories
    const serviceTypeValidation = validateServiceTypeKeysForCategories({
      categoryLabels: normalizedCategoryLabels,
      serviceTypeKeys: serviceTypes,
    });

    if (serviceTypeValidation.invalidKeys.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'One or more selected service types are invalid'
      });
    }

    if (serviceTypeValidation.categoryMismatchKeys.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Selected service type does not belong to the chosen category'
      });
    }

    const validServiceTypeKeys = serviceTypeValidation.validKeys;
    
    if (validServiceTypeKeys.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one service type is required'
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

    // Use transaction for atomic profile + category/type updates
    connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      if (existingProfile.length > 0) {
        // UPDATE existing profile
        const updates = ['barangay_address = ?', 'starting_price = ?', 'description = ?'];
        const params = [barangayAddress, parseFloat(startingPrice), description || null];

        if (bannerImageUrl) {
          updates.push('banner_image_url = ?');
          params.push(bannerImageUrl);
          updates.push('banner_image_public_id = ?');
          params.push(bannerImagePublicId);
        }

        params.push(userId);

        await connection.query(
          `UPDATE service_profiles SET ${updates.join(', ')} WHERE user_id = ?`,
          params
        );

        const profileId = existingProfile[0].id;

        // Update category and type assignments (transactional)
        await applyProfileCategories(connection, profileId, categoryKeys);
        await applyProfileServiceTypes(connection, profileId, validServiceTypeKeys);

        // Update languages (non-transactional, called after transaction succeeds)
        // This is done after commit to keep transaction scope small
      } else {
        // CREATE new profile
        const [result] = await connection.query(
          `INSERT INTO service_profiles 
           (user_id, barangay_address, starting_price, description, banner_image_url, banner_image_public_id, is_published, taxonomy_needs_review) 
           VALUES (?, ?, ?, ?, ?, ?, FALSE, FALSE)`,
          [
            userId,
            barangayAddress,
            parseFloat(startingPrice),
            description || null,
            bannerImageUrl || null,
            bannerImagePublicId || null,
          ]
        );

        const profileId = result.insertId;

        // Create category and type assignments (transactional)
        await applyProfileCategories(connection, profileId, categoryKeys);
        await applyProfileServiceTypes(connection, profileId, validServiceTypeKeys);

        // Store profile ID for response
        existingProfile[0] = { id: profileId };
      }

      await connection.commit();

      // Apply languages after transaction succeeds
      if (normalizedLanguages.length > 0) {
        if (existingProfile[0]?.id) {
          await applyProviderLanguages(existingProfile[0].id, normalizedLanguages);
        }
      }

      // Delete old banner if new one uploaded
      if (bannerImagePublicId && existingProfile.length > 0 && existingProfile[0].banner_image_public_id) {
        await deleteImageByPublicId(existingProfile[0].banner_image_public_id);
      }

      const isUpdate = existingProfile.length > 0;
      return res.status(isUpdate ? 200 : 201).json({
        success: true,
        message: isUpdate ? 'Service profile updated successfully' : 'Service profile created successfully',
        profileId: existingProfile[0]?.id
      });

    } catch (txError) {
      await connection.rollback();
      throw txError;
    }
  } catch (error) {
    console.error('Error creating/updating service profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating/updating service profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Get all published service profiles
exports.getAllProfiles = async (req, res) => {
  try {
    const {
      category,
      serviceType,
      location,
      minPrice,
      maxPrice,
      minRating,
      search,
    } = req.query;

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
        sp.service_types,
        sp.taxonomy_needs_review,
        sp.description,
        sp.about_me,
        sp.banner_image_url,
        COALESCE(review_stats.rating, 0) AS rating,
        COALESCE(review_stats.reviews_count, 0) AS reviews_count,
        sp.created_at,
        u.profession,
        u.skills,
        u.is_verified,
        COALESCE(pas.availability_status, 'available') AS availability_status,
        COALESCE(pas.show_availability_status, TRUE) AS show_availability_status,
        COALESCE(pas.max_advance_booking_days, 60) AS max_advance_booking_days,
        ${ACTIVE_BOOKING_EXISTS_SQL} AS has_active_booking,
        ${FUTURE_AVAILABILITY_CONFIGURED_SQL} AS has_future_availability_config
      FROM service_profiles sp
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN provider_availability_settings pas ON pas.service_profile_id = sp.id
      ${REVIEW_STATS_JOIN}
      WHERE sp.is_published = TRUE
        AND u.is_verified = TRUE
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
      const categoryLabels = getCategoryFilterLabels(category);
      if (categoryLabels.length > 0) {
        query += ` AND (${categoryLabels.map(() => 'JSON_CONTAINS(sp.service_categories, ?)').join(' OR ')})`;
        for (const label of categoryLabels) {
          params.push(JSON.stringify(label));
        }
      }
    }

    if (serviceType) {
      query += ' AND JSON_CONTAINS(sp.service_types, ?)';
      params.push(JSON.stringify(String(serviceType).trim()));
    }

    query += ' ORDER BY COALESCE(review_stats.rating, 0) DESC, COALESCE(review_stats.reviews_count, 0) DESC';

    const [profiles] = await db.query(query, params);

    // Format response
    const formattedProfiles = profiles.map(profile => {
      const categories = normalizeCategoryLabels(parseJsonArray(profile.service_categories, []), { preserveUnknown: true });
      const serviceTypeKeys = parseJsonArray(profile.service_types, []);
      const serviceTypes = getServiceTypesForProfile({
        categoryLabels: categories,
        serviceTypeKeys,
      });
      const skills = parseJsonArray(profile.skills, []);

      return {
        id: profile.id,
        userId: profile.user_id,
        name: profile.provider_name,
        location: profile.barangay_address,
        startingPrice: toNullableNumber(profile.starting_price),
        pricingUnit: profile.pricing_unit || 'per_day',
        description: profile.description,
        aboutMe: profile.about_me || '',
        image: profile.banner_image_url || null,
        tags: [...skills, ...serviceTypes.map((item) => item.label), ...categories],
        skills,
        rating: toNullableNumber(profile.rating),
        reviews: toCount(profile.reviews_count),
        online: deriveOnlineFromLastSeen(profile.last_seen_at),
        verified: Boolean(profile.is_verified),
        profession: profile.profession,
        categories,
        serviceTypes,
        taxonomyNeedsReview: Boolean(profile.taxonomy_needs_review),
        availabilityStatus: derivePublicAvailabilityStatus(profile),
        acceptingRequests: String(profile.availability_status || 'available').toLowerCase() !== 'unavailable',
        hasConfiguredAvailability: Boolean(profile.has_future_availability_config),
        showAvailabilityStatus: Boolean(profile.show_availability_status),
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
        sp.service_types,
        sp.taxonomy_needs_review,
        sp.description,
        sp.about_me,
        sp.banner_image_url,
        COALESCE(review_stats.rating, 0) AS rating,
        COALESCE(review_stats.reviews_count, 0) AS reviews_count,
        u.profession,
        u.skills,
        u.is_verified,
        COALESCE(pas.availability_status, 'available') AS availability_status,
        COALESCE(pas.show_availability_status, TRUE) AS show_availability_status,
        COALESCE(pas.max_advance_booking_days, 60) AS max_advance_booking_days,
        ${ACTIVE_BOOKING_EXISTS_SQL} AS has_active_booking,
        ${FUTURE_AVAILABILITY_CONFIGURED_SQL} AS has_future_availability_config
      FROM service_profiles sp
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN provider_availability_settings pas ON pas.service_profile_id = sp.id
      ${REVIEW_STATS_JOIN}
      WHERE sp.is_published = TRUE
        AND u.is_verified = TRUE
        AND u.is_active = TRUE
        AND COALESCE(pas.availability_status, 'available') <> 'unavailable'
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
      const categoryLabels = getCategoryFilterLabels(category);
      if (categoryLabels.length > 0) {
        query += ` AND (${categoryLabels.map(() => 'JSON_CONTAINS(sp.service_categories, ?)').join(' OR ')})`;
        for (const label of categoryLabels) {
          params.push(JSON.stringify(label));
        }
      }
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

      const categories = normalizeCategoryLabels(parseJsonArray(profile.service_categories, []), { preserveUnknown: true });
      const serviceTypeKeys = parseJsonArray(profile.service_types, []);
      const serviceTypes = getServiceTypesForProfile({
        categoryLabels: categories,
        serviceTypeKeys,
      });
      const skills = parseJsonArray(profile.skills, []);

      recommended.push({
        id: profile.id,
        userId: profile.user_id,
        name: profile.provider_name,
        location: profile.barangay_address,
        startingPrice: toNullableNumber(profile.starting_price),
        pricingUnit: profile.pricing_unit || 'per_day',
        description: profile.description,
        aboutMe: profile.about_me || '',
        image: profile.banner_image_url || null,
        tags: [...skills, ...serviceTypes.map((item) => item.label), ...categories],
        skills,
        rating: toNullableNumber(profile.rating),
        reviews: toCount(profile.reviews_count),
        online: deriveOnlineFromLastSeen(profile.last_seen_at),
        verified: Boolean(profile.is_verified),
        profession: profile.profession,
        categories,
        serviceTypes,
        taxonomyNeedsReview: Boolean(profile.taxonomy_needs_review),
        languages: languageRows.map((row) => row.language_code),
        availabilityStatus: derivePublicAvailabilityStatus(profile),
        acceptingRequests: String(profile.availability_status || 'available').toLowerCase() !== 'unavailable',
        hasConfiguredAvailability: Boolean(profile.has_future_availability_config),
        showAvailabilityStatus: Boolean(profile.show_availability_status),
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
        u.is_verified,
        COALESCE(pas.availability_status, 'available') AS availability_status,
        COALESCE(pas.show_availability_status, TRUE) AS show_availability_status,
        COALESCE(pas.max_advance_booking_days, 60) AS max_advance_booking_days,
        ${ACTIVE_BOOKING_EXISTS_SQL} AS has_active_booking,
        ${FUTURE_AVAILABILITY_CONFIGURED_SQL} AS has_future_availability_config
      FROM service_profiles sp
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN provider_availability_settings pas ON pas.service_profile_id = sp.id
      ${REVIEW_STATS_JOIN}
      WHERE sp.id = ? AND sp.is_published = TRUE AND u.is_verified = TRUE
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
    const nextBookableSlot = await findNextBookableSlot(db, profile);

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
           AND completed_through_platform = TRUE
         ORDER BY is_featured DESC, display_order ASC, created_at DESC`,
        [id]
      );
      portfolioItems = rows;
    } catch (portfolioError) {
      if (!['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE'].includes(portfolioError.code)) {
        throw portfolioError;
      }

      portfolioItems = [];

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
           AND verification_status = 'verified'
           AND (does_not_expire = TRUE OR expiration_date IS NULL OR expiration_date >= CURDATE())
         ORDER BY created_at DESC`,
        [id]
      );
      credentialRows = rows;
    } catch (credentialError) {
      if (!['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(credentialError.code)) {
        throw credentialError;
      }
    }

    // Format portfolio items
    const formattedPortfolio = portfolioItems.map(item => ({
      id: item.id,
      src: item.image_url || null,
      caption: item.caption,
      serviceLabel: item.job_title,
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

    const categories = normalizeCategoryLabels(parseJsonArray(profile.service_categories, []), { preserveUnknown: true });
    const serviceTypeKeys = parseJsonArray(profile.service_types, []);
    const serviceTypes = getServiceTypesForProfile({
      categoryLabels: categories,
      serviceTypeKeys,
    });
    const skills = parseJsonArray(profile.skills, []);

    const formattedProfile = {
      id: profile.id,
      userId: profile.user_id,
      name: profile.full_name,
      location: profile.barangay_address,
      startingPrice: toNullableNumber(profile.starting_price),
      pricingUnit: profile.pricing_unit || 'per_day',
      description: profile.description,
      aboutMe: profile.about_me,
      responseTime: profile.response_time || 'Within 24 hours',
      jobsCompleted: toCount(profile.jobs_completed),
      image: profile.banner_image_url || null,
      tags: [...skills, ...serviceTypes.map((item) => item.label), ...categories],
      skills,
      rating: toNullableNumber(profile.rating),
      reviewsCount: toCount(profile.reviews_count),
      online: deriveOnlineFromLastSeen(profile.last_seen_at),
      verified: Boolean(profile.is_verified),
      profession: profile.profession,
      categories,
      serviceTypes,
      taxonomyNeedsReview: Boolean(profile.taxonomy_needs_review),
      isPublished: Boolean(profile.is_published),
      availabilityStatus: derivePublicAvailabilityStatus(profile, Boolean(nextBookableSlot)),
      acceptingRequests: String(profile.availability_status || 'available').toLowerCase() !== 'unavailable',
      hasConfiguredAvailability: Boolean(profile.has_future_availability_config),
      hasFutureBookableSlot: Boolean(nextBookableSlot),
      nextAvailableDate: nextBookableSlot?.date || null,
      nextAvailableTime: nextBookableSlot?.time || null,
      showAvailabilityStatus: Boolean(profile.show_availability_status),
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
    const categories = normalizeCategoryLabels(parseJsonArray(profile.service_categories, []), { preserveUnknown: true });
    const serviceTypeKeys = parseJsonArray(profile.service_types, []);
    const serviceTypes = getServiceTypesForProfile({
      categoryLabels: categories,
      serviceTypeKeys,
    });
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
      startingPrice: toNullableNumber(profile.starting_price),
      pricingUnit: profile.pricing_unit || 'per_day',
      description: profile.description,
      image: profile.banner_image_url || null,
      tags: [...skills, ...serviceTypes.map((item) => item.label), ...categories],
      skills,
      rating: toNullableNumber(profile.rating),
      reviews: toCount(profile.reviews_count),
      online: deriveOnlineFromLastSeen(profile.last_seen_at),
      verified: Boolean(profile.is_verified),
      profession: profile.profession,
      categories,
      serviceTypes,
      taxonomyNeedsReview: Boolean(profile.taxonomy_needs_review),
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

    if (isPublished) {
      const [providerRows] = await db.query(
        'SELECT is_verified FROM users WHERE id = ? LIMIT 1',
        [userId]
      );

      if (providerRows.length === 0 || !providerRows[0].is_verified) {
        return res.status(403).json({
          success: false,
          code: 'PROVIDER_VERIFICATION_REQUIRED',
          message: 'Your service provider account must be verified before you can publish a Service Listing.'
        });
      }
    }

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

// Manual portfolio uploads are disabled. Public portfolio work must be linked
// to a completed SerbisyoToledo service request so it cannot be mistaken for
// platform-verified work.
exports.addPortfolioImage = async (req, res) => {
  return res.status(409).json({
    success: false,
    code: 'PORTFOLIO_PLATFORM_JOBS_ONLY',
    message: 'Portfolio items must be linked to a completed SerbisyoToledo request.'
  });
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
      serviceLabel: item.job_title,
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
        jobsCompleted: toCount(profile.jobs_completed),
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
    const bookingType = String(req.query.bookingType || 'one_day').trim().toLowerCase();
    const endDate = String(req.query.endDate || date).trim();
    const requestedDates = String(req.query.dates || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const excludeRequestId = Number(req.query.excludeRequestId || 0) || null;

    if (!serviceProfileId || (!date && requestedDates.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Profile and at least one date are required.'
      });
    }

    connection = await db.getConnection();

    const [profiles] = await connection.query(
      `SELECT sp.id, sp.user_id AS provider_id, sp.is_published
       FROM service_profiles sp
       WHERE sp.id = ?
       LIMIT 1`,
      [serviceProfileId]
    );

    if (profiles.length === 0 || !profiles[0].is_published) {
      return res.status(404).json({
        success: false,
        message: 'Service profile not found'
      });
    }

    const dates = normalizeBookingDates({
      bookingType,
      startDate: date,
      endDate,
      dates: requestedDates,
    });

    if (dates.length === 0) {
      return res.status(400).json({
        success: false,
        message: bookingType === 'specific_dates' ? 'Invalid specific dates.' : 'Invalid booking date selection.'
      });
    }

    if (dates.length > 90) {
      return res.status(400).json({ success: false, message: 'Too many booking dates. Maximum 90.' });
    }

    const slots = await getCommonAvailableSlotsForDates(connection, {
      serviceProfileId,
      providerId: profiles[0].provider_id,
      dates,
      durationMinutes: duration,
      slotStepMinutes: 60,
      excludeRequestId,
    });

    return res.json({
      success: true,
      data: {
        dates,
        date: dates[0] || null,
        endDate: dates[dates.length - 1] || null,
        slots,
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
    const excludeRequestId = Number(req.query.excludeRequestId || 0) || null;

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
      `SELECT sp.id, sp.user_id AS provider_id, sp.is_published
       FROM service_profiles sp
       WHERE sp.id = ?
       LIMIT 1`,
      [serviceProfileId]
    );

    if (profiles.length === 0 || !profiles[0].is_published) {
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
        excludeRequestId,
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

      // Weekly rows are returned only for backward compatibility with older
      // provider data. New availability saves use explicit provider-selected dates.
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

      const toledoNow = new Date(Date.now() + (8 * 60 * 60 * 1000));
      const todayToledo = new Date(Date.UTC(
        toledoNow.getUTCFullYear(),
        toledoNow.getUTCMonth(),
        toledoNow.getUTCDate()
      ));
      const todayString = formatDateOnly(todayToledo);

      const availability = exceptions
        .filter((item) => (
          String(item.exception_type || '').toLowerCase() === 'available'
          && item.start_time
          && item.end_time
        ))
        .map((item) => ({
          id: item.id,
          date: toDateOnlyString(item.exception_date),
          startTime: String(item.start_time).slice(0, 5),
          endTime: String(item.end_time).slice(0, 5),
        }))
        .filter((item) => item.date && item.date >= todayString);

      return res.json({
        success: true,
        data: {
          acceptingBookings: String(settings.availability_status || 'available').toLowerCase() !== 'unavailable',
          availability,
          systemRules: {
            allowSameDayBooking: false,
            minAdvanceNoticeMinutes: 720,
            maxAdvanceBookingDays: 60,
          },

          // Compatibility fields for existing dashboard/tests while the old
          // weekly availability model is phased out.
          settings,
          weeklyBlocks,
          exceptions,
          specificAvailability: availability,
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
    const {
      acceptingBookings,
      availability,
      settings,
      weeklyBlocks,
      specificAvailability,
    } = req.body;

    const [profiles] = await db.query(
      'SELECT id FROM service_profiles WHERE user_id = ? LIMIT 1',
      [userId]
    );

    if (profiles.length === 0) {
      return res.status(404).json({ success: false, message: 'Service profile not found' });
    }

    const serviceProfileId = profiles[0].id;
    const usesSimpleContract = (
      typeof acceptingBookings !== 'undefined'
      || Array.isArray(availability)
    );
    const submittedAvailability = Array.isArray(availability)
      ? availability
      : specificAvailability;

    connection = await db.getConnection();
    await connection.beginTransaction();

    await ensureAvailabilitySettings(connection, serviceProfileId);

    // New provider-facing flow uses system defaults. Legacy payloads are still
    // accepted temporarily so old clients/tests do not break during rollout.
    const allowSameDay = usesSimpleContract
      ? false
      : Boolean(settings?.allowSameDayBooking);
    const minAdvanceNotice = usesSimpleContract
      ? 720
      : Number(settings?.minAdvanceNoticeMinutes ?? 720);
    const maxAdvanceDays = usesSimpleContract
      ? 60
      : Number(settings?.maxAdvanceBookingDays ?? 60);
    const availabilityStatus = usesSimpleContract
      ? (acceptingBookings === false ? 'unavailable' : 'available')
      : String(
          settings?.availabilityStatus ?? settings?.availability_status ?? 'available'
        ).trim().toLowerCase();
    const showAvailabilityStatus = usesSimpleContract
      ? true
      : (() => {
          const raw = settings?.showAvailabilityStatus ?? settings?.show_availability_status;
          if (raw == null) return true;
          return (
            raw === true
            || raw === 1
            || raw === '1'
            || String(raw).trim().toLowerCase() === 'true'
          );
        })();

    if (!SUPPORTED_AVAILABILITY_STATUSES.has(availabilityStatus)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Invalid availability status' });
    }

    if (minAdvanceNotice < 0 || minAdvanceNotice > 14 * 24 * 60) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Invalid minimum advance notice' });
    }

    if (maxAdvanceDays < 1 || maxAdvanceDays > 365) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Invalid maximum advance booking days' });
    }

    const hasExplicitAvailability = Array.isArray(submittedAvailability);
    const normalizedAvailability = [];

    if (hasExplicitAvailability) {
      if (submittedAvailability.length > 500) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Too many availability slots' });
      }

      const toledoNow = new Date(Date.now() + (8 * 60 * 60 * 1000));
      const todayToledo = new Date(Date.UTC(
        toledoNow.getUTCFullYear(),
        toledoNow.getUTCMonth(),
        toledoNow.getUTCDate()
      ));
      const earliestAllowedDate = new Date(todayToledo);
      if (usesSimpleContract) {
        earliestAllowedDate.setUTCDate(earliestAllowedDate.getUTCDate() + 1);
      }
      const latestAllowedDate = new Date(todayToledo);
      latestAllowedDate.setUTCDate(
        latestAllowedDate.getUTCDate() + (usesSimpleContract ? 60 : 365)
      );

      const rangesByDate = new Map();

      for (const item of submittedAvailability) {
        const parsedDate = parseDateOnly(item?.date ?? item?.exceptionDate);
        const slotStart = parseTimeInputToSql(item?.startTime);
        const slotEnd = parseTimeInputToSql(item?.endTime);

        if (
          !parsedDate
          || parsedDate < earliestAllowedDate
          || parsedDate > latestAllowedDate
        ) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: usesSimpleContract
              ? 'Availability dates must be from tomorrow up to 60 days ahead'
              : 'Availability dates must be between today and 365 days from today'
          });
        }

        if (!slotStart || !slotEnd || slotEnd <= slotStart) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'Each availability slot must have a valid start and end time'
          });
        }

        const date = formatDateOnly(parsedDate);
        const ranges = rangesByDate.get(date) || [];

        if (ranges.some((range) => slotStart < range.end && slotEnd > range.start)) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `Availability slots overlap on ${date}`
          });
        }

        ranges.push({ start: slotStart, end: slotEnd });
        rangesByDate.set(date, ranges);
        normalizedAvailability.push({ date, start: slotStart, end: slotEnd });
      }
    }

    await connection.query(
      `UPDATE provider_availability_settings
       SET allow_same_day_booking = ?,
           min_advance_notice_minutes = ?,
           max_advance_booking_days = ?,
           availability_status = ?,
           show_availability_status = ?
       WHERE service_profile_id = ?`,
      [
        allowSameDay,
        minAdvanceNotice,
        maxAdvanceDays,
        availabilityStatus,
        showAvailabilityStatus,
        serviceProfileId
      ]
    );

    if (usesSimpleContract || hasExplicitAvailability) {
      // Explicit provider-selected dates are now authoritative. Clear recurring
      // weekly rules and future exceptions so no hidden legacy rule can make a
      // client-facing date appear or disappear unexpectedly.
      await connection.query(
        'DELETE FROM provider_weekly_availability WHERE service_profile_id = ?',
        [serviceProfileId]
      );

      const toledoNow = new Date(Date.now() + (8 * 60 * 60 * 1000));
      const todayToledo = new Date(Date.UTC(
        toledoNow.getUTCFullYear(),
        toledoNow.getUTCMonth(),
        toledoNow.getUTCDate()
      ));
      const todayString = formatDateOnly(todayToledo);

      await connection.query(
        `DELETE FROM provider_availability_exceptions
         WHERE service_profile_id = ? AND exception_date >= ?`,
        [serviceProfileId, todayString]
      );

      for (const slot of normalizedAvailability) {
        await connection.query(
          `INSERT INTO provider_availability_exceptions
           (service_profile_id, exception_date, start_time, end_time, exception_type, reason)
           VALUES (?, ?, ?, ?, 'available', NULL)`,
          [serviceProfileId, slot.date, slot.start, slot.end]
        );
      }
    } else {
      // Legacy recurring-week payload support. New frontend code does not send
      // this shape, but retaining it avoids a breaking API change during rollout.
      await connection.query(
        'DELETE FROM provider_weekly_availability WHERE service_profile_id = ?',
        [serviceProfileId]
      );

      const rangesByDay = new Map();
      for (const block of Array.isArray(weeklyBlocks) ? weeklyBlocks : []) {
        const dayOfWeek = Number(block.dayOfWeek);
        const slotStart = parseTimeInputToSql(block.startTime);
        const slotEnd = parseTimeInputToSql(block.endTime);
        const isAvailable = block.isAvailable !== false;

        if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
          await connection.rollback();
          return res.status(400).json({ success: false, message: 'Invalid day of week in availability block' });
        }

        if (!slotStart || !slotEnd || slotEnd <= slotStart) {
          await connection.rollback();
          return res.status(400).json({ success: false, message: 'Invalid time range in availability block' });
        }

        const ranges = rangesByDay.get(dayOfWeek) || [];
        if (ranges.some((range) => slotStart < range.end && slotEnd > range.start)) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'Overlapping weekly availability blocks are not allowed'
          });
        }

        ranges.push({ start: slotStart, end: slotEnd });
        rangesByDay.set(dayOfWeek, ranges);

        await connection.query(
          `INSERT INTO provider_weekly_availability
           (service_profile_id, day_of_week, start_time, end_time, is_available)
           VALUES (?, ?, ?, ?, ?)`,
          [serviceProfileId, dayOfWeek, slotStart, slotEnd, isAvailable]
        );
      }
    }

    await connection.commit();

    return res.json({
      success: true,
      message: 'Availability saved successfully',
      data: {
        acceptingBookings: availabilityStatus !== 'unavailable',
        availabilityCount: normalizedAvailability.length,
        systemRules: usesSimpleContract
          ? {
              allowSameDayBooking: false,
              minAdvanceNoticeMinutes: 720,
              maxAdvanceBookingDays: 60,
            }
          : null,
      }
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

    if (!['available', 'unavailable', 'vacation'].includes(exceptionType)) {
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
      `SELECT sr.id, sr.service_type_key, sr.service_type_label, sr.created_at, sr.start_date, sr.end_date
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
  let uploadedImagePublicId = null;

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

    const [profiles] = await connection.query(
      'SELECT id FROM service_profiles WHERE user_id = ? LIMIT 1',
      [userId]
    );
    if (profiles.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Service profile not found' });
    }

    const serviceProfileId = profiles[0].id;

    const [requests] = await connection.query(
      `SELECT id, service_type_key, service_type_label, status, start_date, end_date
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

    let imageUrl = null;
    let imagePublicId = null;

    if (req.file) {
      if (!hasCloudinaryConfig()) {
        await connection.rollback();
        return res.status(503).json({
          success: false,
          message: 'Portfolio image storage is temporarily unavailable. You can link the completed job without a photo and add one later.'
        });
      }

      const uploadResult = await uploadImageBuffer({
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        folder: 'serbisyo-toledo/portfolio/completed-jobs',
      });

      imageUrl = uploadResult.secure_url;
      imagePublicId = uploadResult.public_id;
      uploadedImagePublicId = imagePublicId;
    }

    const [orderResult] = await connection.query(
      'SELECT COALESCE(MAX(display_order), 0) + 1 AS nextOrder FROM portfolio_items WHERE service_profile_id = ?',
      [serviceProfileId]
    );

    const completedServiceType = getServiceTypeByKey(requests[0].service_type_key);
    const completedServiceLabel = String(
      requests[0].service_type_label || completedServiceType?.label || 'Completed Service'
    ).trim() || 'Completed Service';

    // Never auto-publish the client's private request details. Providers may
    // provide a separate public description explicitly.
    const safeDescription = String(description || '').trim();
    const publishFlag = isPublished == null
      ? true
      : !['false', '0', 'no'].includes(String(isPublished).trim().toLowerCase());
    const featuredFlag = ['true', '1', 'yes'].includes(
      String(isFeatured ?? false).trim().toLowerCase()
    );

    const [insertResult] = await connection.query(
      `INSERT INTO portfolio_items (
         service_profile_id,
         service_request_id,
         caption,
         display_order,
         job_title,
         job_description,
         service_category,
         completed_at,
         is_published,
         is_featured,
         completed_through_platform,
         image_url,
         image_public_id
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, TRUE, ?, ?)`,
      [
        serviceProfileId,
        serviceRequestId,
        String(caption || '').trim(),
        orderResult[0].nextOrder,
        completedServiceLabel,
        safeDescription,
        String(serviceCategory || '').trim() || null,
        publishFlag,
        featuredFlag,
        imageUrl,
        imagePublicId,
      ]
    );

    await connection.commit();
    uploadedImagePublicId = null;

    return res.status(201).json({
      success: true,
      message: 'Completed job linked to portfolio successfully',
      data: {
        id: insertResult.insertId,
        src: imageUrl,
        hasPhoto: Boolean(imageUrl),
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    if (uploadedImagePublicId) {
      try {
        await deleteImageByPublicId(uploadedImagePublicId);
      } catch (cleanupError) {
        console.error('Failed to clean up completed-job portfolio image:', cleanupError);
      }
    }

    console.error('Error creating portfolio from request:', error);
    return res.status(500).json({ success: false, message: 'Failed to link completed request' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

exports.updateCompletedPortfolioItemImage = async (req, res) => {
  let uploadedImagePublicId = null;

  try {
    const userId = req.user?.userId;
    const portfolioItemId = Number(req.params.itemId);

    if (!portfolioItemId) {
      return res.status(400).json({ success: false, message: 'Invalid portfolio item id' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image file is required' });
    }

    if (!hasCloudinaryConfig()) {
      return res.status(503).json({
        success: false,
        message: 'Portfolio image storage is temporarily unavailable'
      });
    }

    const [items] = await db.query(
      `SELECT pi.id, pi.image_public_id, pi.completed_through_platform
       FROM portfolio_items pi
       JOIN service_profiles sp ON sp.id = pi.service_profile_id
       WHERE pi.id = ? AND sp.user_id = ?
       LIMIT 1`,
      [portfolioItemId, userId]
    );

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio item not found or not authorized'
      });
    }

    if (!Boolean(items[0].completed_through_platform)) {
      return res.status(409).json({
        success: false,
        message: 'This photo action is only for completed-job portfolio entries'
      });
    }

    const uploadResult = await uploadImageBuffer({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      folder: 'serbisyo-toledo/portfolio/completed-jobs',
    });
    uploadedImagePublicId = uploadResult.public_id;

    await db.query(
      `UPDATE portfolio_items
       SET image_url = ?, image_public_id = ?
       WHERE id = ?`,
      [uploadResult.secure_url, uploadResult.public_id, portfolioItemId]
    );

    if (items[0].image_public_id && items[0].image_public_id !== uploadResult.public_id) {
      try {
        await deleteImageByPublicId(items[0].image_public_id);
      } catch (cleanupError) {
        console.error('Failed to remove previous completed-job image:', cleanupError);
      }
    }

    uploadedImagePublicId = null;

    return res.json({
      success: true,
      message: 'Completed job photo updated successfully',
      data: {
        id: portfolioItemId,
        src: uploadResult.secure_url,
      }
    });
  } catch (error) {
    if (uploadedImagePublicId) {
      try {
        await deleteImageByPublicId(uploadedImagePublicId);
      } catch (cleanupError) {
        console.error('Failed to clean up replacement portfolio image:', cleanupError);
      }
    }

    console.error('Error updating completed-job portfolio photo:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update completed job photo'
    });
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
    const relatedSkills = Array.isArray(payload.relatedSkills) ? payload.relatedSkills : [];

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
        String(payload.credentialName || '').trim(),
        String(payload.credentialType || '').trim(),
        String(payload.issuingOrganization || '').trim(),
        String(payload.credentialId || '').trim() || null,
        payload.issueDate || null,
        payload.doesNotExpire ? null : (payload.expirationDate || null),
        Boolean(payload.doesNotExpire),
        String(payload.credentialUrl || '').trim() || null,
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

exports.getTaxonomy = async (_req, res) => {
  return res.json({
    success: true,
    data: toPublicTaxonomy(),
  });
};
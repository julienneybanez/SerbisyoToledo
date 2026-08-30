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
  getCommonAvailableSlotsForDates,
  normalizeBookingDates,
  ensureAvailabilitySettings,
} = require('../utils/bookingAvailability');

const SUPPORTED_LANGUAGE_CODES = new Set(['ceb', 'en', 'fil']);
const SUPPORTED_AVAILABILITY_STATUSES = new Set(['available', 'unavailable']);
const PRESENCE_WINDOW_MINUTES = 5;

const parseMaybeJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [value];
    }
  }
  return value != null ? [value] : [];
};

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const toCount = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
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
  EXISTS (
    SELECT 1
    FROM provider_available_slots pas_future
    WHERE pas_future.service_profile_id = sp.id
      AND pas_future.available_date >= DATE(${TOLEDO_NOW_SQL})
  )
`;

const derivePublicAvailabilityStatus = (profile, hasFutureBookableSlot = null) => {
  if (!profile.show_availability_status) {
    return null;
  }

  if (String(profile.availability_status || 'available').toLowerCase() === 'unavailable') {
    return 'unavailable';
  }

  if (profile.has_active_booking) {
    return 'busy';
  }

  if (hasFutureBookableSlot === false) {
    return 'no_slots';
  }

  if (hasFutureBookableSlot === true) {
    return 'available';
  }

  return profile.has_future_availability_config
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

  try {
    const [slotRows] = await queryable.query(
      `SELECT DISTINCT DATE_FORMAT(available_date, '%Y-%m-%d') AS service_date
       FROM provider_available_slots
       WHERE service_profile_id = ?
         AND available_date BETWEEN ? AND ?
       ORDER BY available_date ASC`,
      [profile.id, todayIso, endIso]
    );

    for (const row of slotRows) {
      if (!row.service_date) continue;
      const slots = await getAvailableSlotsForDate(queryable, {
        serviceProfileId: profile.id,
        providerId: profile.user_id,
        date: row.service_date,
        durationMinutes: 30,
        slotStepMinutes: 30,
      });

      if (slots.length > 0) {
        return {
          date: row.service_date,
          time: slots[0].time,
          endTime: slots[0].endTime,
        };
      }
    }
  } catch {
    return null;
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

const populateCanonicalProfileFields = async (queryable, profile) => {
  const profileId = profile.id;
  const userId = profile.user_id;

  const [catRows] = await queryable.query(
    'SELECT category_key FROM service_profile_categories WHERE service_profile_id = ? ORDER BY category_key',
    [profileId]
  );
  const categoryKeys = catRows.map((r) => r.category_key);
  const categories = normalizeCategoryLabels(categoryKeys, { preserveUnknown: true });

  const [typeRows] = await queryable.query(
    'SELECT service_type_key FROM service_profile_types WHERE service_profile_id = ? ORDER BY service_type_key',
    [profileId]
  );
  const serviceTypeKeys = typeRows.map((r) => r.service_type_key);
  const serviceTypes = getServiceTypesForProfile({
    categoryLabels: categories,
    serviceTypeKeys,
  });

  const languages = await getPersonLanguages(queryable, userId);
  const skills = await getProviderSkills(queryable, userId);

  const [statsRows] = await queryable.query(
    'SELECT rating, reviews_count, jobs_completed FROM service_profile_stats WHERE service_profile_id = ? LIMIT 1',
    [profileId]
  );
  const stats = statsRows[0] || { rating: 0, reviews_count: 0, jobs_completed: 0 };

  return {
    categoryKeys,
    categories,
    serviceTypeKeys,
    serviceTypes,
    languages,
    skills,
    rating: parseFloat(stats.rating || 0).toFixed(1),
    reviewsCount: Number(stats.reviews_count || 0),
    jobsCompleted: Number(stats.jobs_completed || 0),
  };
};

const applyPersonLanguages = async (queryable, userId, languageCodes = []) => {
  await queryable.query('DELETE FROM person_languages WHERE user_id = ?', [userId]);

  for (const languageCode of languageCodes) {
    if (SUPPORTED_LANGUAGE_CODES.has(languageCode)) {
      await queryable.query(
        'INSERT INTO person_languages (user_id, language_code) VALUES (?, ?)',
        [userId, languageCode]
      );
    }
  }
};

const getPersonLanguages = async (queryable, userId) => {
  const [rows] = await queryable.query(
    'SELECT language_code FROM person_languages WHERE user_id = ? ORDER BY language_code',
    [userId]
  );
  return rows.map((row) => row.language_code);
};

const applyProviderSkills = async (queryable, userId, skillLabels = []) => {
  await queryable.query('DELETE FROM provider_skills WHERE user_id = ?', [userId]);

  const uniqueSkills = Array.from(
    new Set(
      (Array.isArray(skillLabels) ? skillLabels : [])
        .map((s) => String(s || '').trim())
        .filter(Boolean)
    )
  );

  for (const skillLabel of uniqueSkills) {
    await queryable.query(
      'INSERT INTO provider_skills (user_id, skill_label) VALUES (?, ?)',
      [userId, skillLabel]
    );
  }
};

const getProviderSkills = async (queryable, userId) => {
  const [rows] = await queryable.query(
    'SELECT skill_label FROM provider_skills WHERE user_id = ? ORDER BY skill_label',
    [userId]
  );
  return rows.map((row) => row.skill_label);
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

// Canonical: Validate publish requirements for a profile
// Returns { canPublish: boolean, reason: string | null }
const validatePublishRequirements = async (connection, userId, profileId) => {
  // Fetch user verification status
  const [userRows] = await connection.query(
    'SELECT is_verified FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  if (userRows.length === 0) {
    return { canPublish: false, reason: 'User not found' };
  }

  if (!userRows[0].is_verified) {
    return { canPublish: false, reason: 'Provider account must be verified before publishing' };
  }

  // Fetch profile with taxonomy
  const [profileRows] = await connection.query(
    'SELECT id, is_active FROM service_profiles WHERE id = ? AND user_id = ? LIMIT 1',
    [profileId, userId]
  );

  if (profileRows.length === 0) {
    return { canPublish: false, reason: 'Service profile not found' };
  }

  if (!profileRows[0].is_active) {
    return { canPublish: false, reason: 'Service profile is deactivated' };
  }

  // Check for at least one category
  const [categoryRows] = await connection.query(
    'SELECT COUNT(*) as count FROM service_profile_categories WHERE service_profile_id = ?',
    [profileId]
  );

  if (categoryRows[0].count === 0) {
    return { canPublish: false, reason: 'At least one service category is required' };
  }

  // Check for at least one service type
  const [typeRows] = await connection.query(
    'SELECT COUNT(*) as count FROM service_profile_types WHERE service_profile_id = ?',
    [profileId]
  );

  if (typeRows[0].count === 0) {
    return { canPublish: false, reason: 'At least one service type is required' };
  }

  return { canPublish: true, reason: null };
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
        await applyPersonLanguages(connection, userId, normalizedLanguages);

        if (req.body.skills) {
          const parsedSkills = parseMaybeJsonArray(req.body.skills);
          await applyProviderSkills(connection, userId, parsedSkills);
        }

        // Store profile ID for response
        existingProfile[0] = { id: profileId };
      }

      await connection.commit();

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
        sp.taxonomy_needs_review,
        sp.description,
        sp.about_me,
        sp.banner_image_url,
        sp.created_at,
        u.profession,
        u.is_verified,
        COALESCE(pas.availability_status, 'available') AS availability_status,
        COALESCE(pas.show_availability_status, TRUE) AS show_availability_status,
        COALESCE(pas.max_advance_booking_days, 60) AS max_advance_booking_days,
        COALESCE(sps.rating, 0) AS rating,
        COALESCE(sps.reviews_count, 0) AS reviews_count,
        ${ACTIVE_BOOKING_EXISTS_SQL} AS has_active_booking,
        ${FUTURE_AVAILABILITY_CONFIGURED_SQL} AS has_future_availability_config
      FROM service_profiles sp
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN provider_availability_settings pas ON pas.service_profile_id = sp.id
      LEFT JOIN service_profile_stats sps ON sps.service_profile_id = sp.id
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
      query += ' AND COALESCE(sps.rating, 0) >= ?';
      params.push(parseFloat(minRating));
    }

    if (search) {
      query += ' AND (u.full_name LIKE ? OR u.profession LIKE ? OR sp.barangay_address LIKE ? OR sp.description LIKE ? OR EXISTS (SELECT 1 FROM provider_skills ps WHERE ps.user_id = u.id AND ps.skill_label LIKE ?))';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (category && category !== 'All') {
      const categoryLabels = getCategoryFilterLabels(category);
      if (categoryLabels.length > 0) {
        const placeholders = categoryLabels.map(() => '?').join(', ');
        query += ` AND EXISTS (SELECT 1 FROM service_profile_categories spc WHERE spc.service_profile_id = sp.id AND spc.category_key IN (${placeholders}))`;
        for (const label of categoryLabels) {
          const catObj = SERVICE_TAXONOMY.find((c) => c.label === label);
          params.push(catObj ? catObj.key : label.toLowerCase());
        }
      }
    }

    if (serviceType) {
      query += ' AND EXISTS (SELECT 1 FROM service_profile_types spt WHERE spt.service_profile_id = sp.id AND spt.service_type_key = ?)';
      params.push(String(serviceType).trim());
    }

    query += ' ORDER BY COALESCE(sps.rating, 0) DESC, COALESCE(sps.reviews_count, 0) DESC';

    const [profiles] = await db.query(query, params);

    // Format response
    const formattedProfiles = [];
    for (const profile of profiles) {
      const fields = await populateCanonicalProfileFields(db, profile);
      formattedProfiles.push({
        id: profile.id,
        userId: profile.user_id,
        name: profile.provider_name,
        location: profile.barangay_address,
        startingPrice: toNullableNumber(profile.starting_price),
        pricingUnit: 'per_day',
        description: profile.description,
        aboutMe: profile.about_me || '',
        image: profile.banner_image_url || null,
        tags: [...fields.skills, ...fields.serviceTypes.map((item) => item.label), ...fields.categories],
        skills: fields.skills,
        languages: fields.languages,
        rating: toNullableNumber(fields.rating),
        reviews: fields.reviewsCount,
        jobsCompleted: fields.jobsCompleted,
        online: deriveOnlineFromLastSeen(profile.last_seen_at),
        verified: Boolean(profile.is_verified),
        profession: profile.profession,
        categories: fields.categories,
        serviceTypes: fields.serviceTypes,
        taxonomyNeedsReview: Boolean(profile.taxonomy_needs_review),
        availabilityStatus: derivePublicAvailabilityStatus(profile),
        acceptingRequests: String(profile.availability_status || 'available').toLowerCase() !== 'unavailable',
        hasConfiguredAvailability: Boolean(profile.has_future_availability_config),
        showAvailabilityStatus: Boolean(profile.show_availability_status),
      });
    }

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
        sp.taxonomy_needs_review,
        sp.description,
        sp.about_me,
        sp.banner_image_url,
        u.profession,
        u.is_verified,
        COALESCE(pas.availability_status, 'available') AS availability_status,
        COALESCE(pas.show_availability_status, TRUE) AS show_availability_status,
        COALESCE(pas.max_advance_booking_days, 60) AS max_advance_booking_days,
        COALESCE(sps.rating, 0) AS rating,
        COALESCE(sps.reviews_count, 0) AS reviews_count,
        ${ACTIVE_BOOKING_EXISTS_SQL} AS has_active_booking,
        ${FUTURE_AVAILABILITY_CONFIGURED_SQL} AS has_future_availability_config
      FROM service_profiles sp
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN provider_availability_settings pas ON pas.service_profile_id = sp.id
      LEFT JOIN service_profile_stats sps ON sps.service_profile_id = sp.id
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
      query += ' AND COALESCE(sps.rating, 0) >= ?';
      params.push(parseFloat(minRating));
    }

    if (search) {
      query += ' AND (u.full_name LIKE ? OR u.profession LIKE ? OR sp.barangay_address LIKE ? OR sp.description LIKE ? OR EXISTS (SELECT 1 FROM provider_skills ps WHERE ps.user_id = u.id AND ps.skill_label LIKE ?))';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (category && category !== 'All') {
      const categoryLabels = getCategoryFilterLabels(category);
      if (categoryLabels.length > 0) {
        const placeholders = categoryLabels.map(() => '?').join(', ');
        query += ` AND EXISTS (SELECT 1 FROM service_profile_categories spc WHERE spc.service_profile_id = sp.id AND spc.category_key IN (${placeholders}))`;
        for (const label of categoryLabels) {
          const catObj = SERVICE_TAXONOMY.find((c) => c.label === label);
          params.push(catObj ? catObj.key : label.toLowerCase());
        }
      }
    }

    if (normalizedLanguage) {
      query += ' AND EXISTS (SELECT 1 FROM person_languages pl WHERE pl.user_id = u.id AND pl.language_code = ?)';
      params.push(normalizedLanguage);
    }

    query += ' ORDER BY COALESCE(sps.rating, 0) DESC, COALESCE(sps.reviews_count, 0) DESC LIMIT 30';

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

      const fields = await populateCanonicalProfileFields(connection, profile);

      recommended.push({
        id: profile.id,
        userId: profile.user_id,
        name: profile.provider_name,
        location: profile.barangay_address,
        startingPrice: toNullableNumber(profile.starting_price),
        pricingUnit: 'per_day',
        description: profile.description,
        aboutMe: profile.about_me || '',
        image: profile.banner_image_url || null,
        tags: [...fields.skills, ...fields.serviceTypes.map((item) => item.label), ...fields.categories],
        skills: fields.skills,
        languages: fields.languages,
        rating: toNullableNumber(fields.rating),
        reviews: fields.reviewsCount,
        jobsCompleted: fields.jobsCompleted,
        online: deriveOnlineFromLastSeen(profile.last_seen_at),
        verified: Boolean(profile.is_verified),
        profession: profile.profession,
        categories: fields.categories,
        serviceTypes: fields.serviceTypes,
        taxonomyNeedsReview: Boolean(profile.taxonomy_needs_review),
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
        u.full_name,
        u.last_seen_at,
        u.profession,
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
    const fields = await populateCanonicalProfileFields(db, profile);
    const nextBookableSlot = await findNextBookableSlot(db, profile);

    // Fetch portfolio items joined on service_requests
    let portfolioItems = [];
    try {
      const [rows] = await db.query(
        `SELECT pi.id, pi.image_url, pi.caption, pi.display_order,
                pi.is_published, pi.is_featured,
                sr.service_type_key, sr.service_type_label, sr.updated_at AS completed_at
         FROM portfolio_items pi
         JOIN service_requests sr ON sr.id = pi.service_request_id
         WHERE sr.service_profile_id = ?
           AND pi.is_published = TRUE
           AND sr.status = 'completed'
         ORDER BY pi.is_featured DESC, pi.display_order ASC, pi.created_at DESC`,
        [id]
      );
      portfolioItems = rows;
    } catch {
      portfolioItems = [];
    }

    // Fetch reviews with client names
    const [reviews] = await db.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.full_name as reviewer_name
       FROM reviews r
       JOIN service_requests sr ON sr.id = r.service_request_id
       JOIN users u ON sr.client_id = u.id
       WHERE sr.service_profile_id = ?
       ORDER BY r.created_at DESC`,
      [id]
    );

    // Fetch verified credentials (public metadata only, omit private document proof)
    const [credentialRows] = await db.query(
      `SELECT id, credential_name, credential_type, issuing_organization, credential_id,
              issue_date, expiration_date, does_not_expire, credential_url, related_skills, verification_status
       FROM provider_credentials
       WHERE service_profile_id = ?
         AND verification_status = 'verified'
         AND (does_not_expire = TRUE OR expiration_date IS NULL OR expiration_date >= CURDATE())
       ORDER BY created_at DESC`,
      [id]
    );

    // Format portfolio items (safe public context)
    const formattedPortfolio = portfolioItems.map((item) => ({
      id: item.id,
      src: item.image_url || null,
      caption: item.caption,
      serviceLabel: item.service_type_label || getServiceTypeByKey(item.service_type_key)?.label || 'Completed Service',
      completedAt: item.completed_at,
      isFeatured: Boolean(item.is_featured),
    }));

    // Format reviews
    const formattedReviews = reviews.map((review) => ({
      id: review.id,
      reviewer: review.reviewer_name,
      date: new Date(review.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      rating: review.rating,
      comment: review.comment
    }));

    const formattedProfile = {
      id: profile.id,
      userId: profile.user_id,
      name: profile.full_name,
      location: profile.barangay_address,
      startingPrice: toNullableNumber(profile.starting_price),
      pricingUnit: 'per_day',
      description: profile.description,
      aboutMe: profile.about_me,
      responseTime: profile.response_time || 'Within 24 hours',
      jobsCompleted: fields.jobsCompleted,
      image: profile.banner_image_url || null,
      tags: [...fields.skills, ...fields.serviceTypes.map((item) => item.label), ...fields.categories],
      skills: fields.skills,
      rating: toNullableNumber(fields.rating),
      reviewsCount: fields.reviewsCount,
      online: deriveOnlineFromLastSeen(profile.last_seen_at),
      verified: Boolean(profile.is_verified),
      profession: profile.profession,
      categories: fields.categories,
      serviceTypes: fields.serviceTypes,
      taxonomyNeedsReview: Boolean(profile.taxonomy_needs_review),
      isPublished: Boolean(profile.is_published),
      availabilityStatus: derivePublicAvailabilityStatus(profile, Boolean(nextBookableSlot)),
      acceptingRequests: String(profile.availability_status || 'available').toLowerCase() !== 'unavailable',
      hasConfiguredAvailability: Boolean(profile.has_future_availability_config),
      hasFutureBookableSlot: Boolean(nextBookableSlot),
      nextAvailableDate: nextBookableSlot?.date || null,
      nextAvailableTime: nextBookableSlot?.time || null,
      showAvailabilityStatus: Boolean(profile.show_availability_status),
      languages: fields.languages,
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
        u.full_name,
        u.last_seen_at,
        u.profession,
        u.email,
        u.phone,
        u.is_verified
      FROM service_profiles sp
      JOIN users u ON sp.user_id = u.id
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
    const fields = await populateCanonicalProfileFields(db, profile);

    const formattedProfile = {
      id: profile.id,
      userId: profile.user_id,
      name: profile.full_name,
      location: profile.barangay_address,
      startingPrice: toNullableNumber(profile.starting_price),
      pricingUnit: 'per_day',
      description: profile.description,
      aboutMe: profile.about_me || '',
      responseTime: profile.response_time || '',
      image: profile.banner_image_url || null,
      tags: [...fields.skills, ...fields.serviceTypes.map((item) => item.label), ...fields.categories],
      skills: fields.skills,
      rating: toNullableNumber(fields.rating),
      reviews: fields.reviewsCount,
      jobsCompleted: fields.jobsCompleted,
      online: deriveOnlineFromLastSeen(profile.last_seen_at),
      verified: Boolean(profile.is_verified),
      profession: profile.profession,
      categories: fields.categories,
      serviceTypes: fields.serviceTypes,
      taxonomyNeedsReview: Boolean(profile.taxonomy_needs_review),
      languages: fields.languages,
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
    });
  }
};

// Publish/unpublish profile (CANONICAL V3.1)
// Publishing now requires: verified provider + active profile + ≥1 category + ≥1 service type
exports.togglePublish = async (req, res) => {
  let connection;

  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { isPublished } = req.body;

    // Unpublish is always allowed
    // Publishing requires validation
    if (isPublished) {
      connection = await db.getConnection();
      await connection.beginTransaction();

      try {
        // Get profile ID and check ownership
        const [profileRows] = await connection.query(
          'SELECT id FROM service_profiles WHERE user_id = ? LIMIT 1',
          [userId]
        );

        if (profileRows.length === 0) {
          await connection.rollback();
          return res.status(404).json({
            success: false,
            message: 'Service profile not found'
          });
        }

        const profileId = profileRows[0].id;

        // Validate publish requirements
        const validation = await validatePublishRequirements(connection, userId, profileId);

        if (!validation.canPublish) {
          await connection.rollback();
          return res.status(403).json({
            success: false,
            code: 'PUBLISH_REQUIREMENTS_NOT_MET',
            message: validation.reason
          });
        }

        // Update published status
        await connection.query(
          'UPDATE service_profiles SET is_published = TRUE WHERE id = ? AND user_id = ?',
          [profileId, userId]
        );

        await connection.commit();

        return res.json({
          success: true,
          message: 'Profile published successfully'
        });

      } catch (txError) {
        await connection.rollback();
        throw txError;
      }
    } else {
      // Unpublish without transaction (simple update)
      const [result] = await db.query(
        'UPDATE service_profiles SET is_published = FALSE WHERE user_id = ?',
        [userId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Service profile not found'
        });
      }

      return res.json({
        success: true,
        message: 'Profile unpublished successfully'
      });
    }
  } catch (error) {
    console.error('Error updating profile publish status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) {
      connection.release();
    }
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

    if (typeof skills === 'string') {
      try {
        skills = JSON.parse(skills);
      } catch {
        skills = skills.split(',').map((s) => s.trim());
      }
    }

    const [profiles] = await db.query(
      'SELECT id FROM service_profiles WHERE user_id = ? LIMIT 1',
      [userId]
    );

    if (profiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'You need to create a service profile first'
      });
    }

    await db.query(
      `UPDATE service_profiles 
       SET about_me = ?, response_time = ?
       WHERE user_id = ?`,
      [aboutMe || null, responseTime || 'Within 24 hours', userId]
    );

    if (Array.isArray(skills)) {
      await applyProviderSkills(db, userId, skills);
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

    const [images] = await db.query(
      `SELECT pi.id, pi.image_public_id FROM portfolio_items pi
       JOIN service_requests sr ON sr.id = pi.service_request_id
       WHERE pi.id = ? AND sr.provider_id = ?`,
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

    const [profiles] = await db.query(
      'SELECT id, about_me, response_time FROM service_profiles WHERE user_id = ? LIMIT 1',
      [userId]
    );

    if (profiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service profile not found'
      });
    }

    const profile = profiles[0];
    const skills = await getProviderSkills(db, userId);

    const [portfolioItems] = await db.query(
      `SELECT pi.id, pi.image_url, pi.caption, pi.display_order,
              pi.is_published, pi.is_featured,
              sr.id AS service_request_id, sr.service_type_key, sr.service_type_label
       FROM portfolio_items pi
       JOIN service_requests sr ON sr.id = pi.service_request_id
       WHERE sr.provider_id = ?
       ORDER BY pi.display_order`,
      [userId]
    );

    const [statsRows] = await db.query(
      'SELECT jobs_completed FROM service_profile_stats WHERE service_profile_id = ? LIMIT 1',
      [profile.id]
    );

    const formattedPortfolio = portfolioItems.map((item) => ({
      id: item.id,
      src: item.image_url || null,
      caption: item.caption,
      serviceRequestId: item.service_request_id,
      serviceLabel: item.service_type_label || getServiceTypeByKey(item.service_type_key)?.label || 'Completed Service',
      isPublished: Boolean(item.is_published),
      isFeatured: Boolean(item.is_featured),
    }));

    res.json({
      success: true,
      data: {
        aboutMe: profile.about_me || '',
        responseTime: profile.response_time || 'Within 24 hours',
        jobsCompleted: toCount(statsRows[0]?.jobs_completed),
        skills,
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
    const settings = await ensureAvailabilitySettings(db, serviceProfileId);

    const [slots] = await db.query(
      `SELECT id, DATE_FORMAT(available_date, '%Y-%m-%d') AS available_date,
              TIME_FORMAT(start_time, '%H:%i') AS start_time,
              TIME_FORMAT(end_time, '%H:%i') AS end_time
       FROM provider_available_slots
       WHERE service_profile_id = ?
       ORDER BY available_date ASC, start_time ASC`,
      [serviceProfileId]
    );

    const [blackouts] = await db.query(
      `SELECT id, DATE_FORMAT(blackout_date, '%Y-%m-%d') AS blackout_date,
              TIME_FORMAT(start_time, '%H:%i') AS start_time,
              TIME_FORMAT(end_time, '%H:%i') AS end_time,
              reason
       FROM provider_availability_blackouts
       WHERE service_profile_id = ?
       ORDER BY blackout_date ASC`,
      [serviceProfileId]
    );

    return res.json({
      success: true,
      data: {
        acceptingBookings: String(settings.availability_status || 'available').toLowerCase() !== 'unavailable',
        availableSlots: slots.map((s) => ({
          id: s.id,
          date: s.available_date,
          startTime: s.start_time,
          endTime: s.end_time,
        })),
        blackouts: blackouts.map((b) => ({
          id: b.id,
          date: b.blackout_date,
          startTime: b.start_time,
          endTime: b.end_time,
          reason: b.reason,
        })),
        settings,
        exceptions: slots.map((s) => ({
          id: s.id,
          exception_date: s.available_date,
          start_time: s.start_time,
          end_time: s.end_time,
          exception_type: 'available',
        })),
      }
    });
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
      availableSlots,
      availability,
      blackouts,
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
    const submittedSlots = Array.isArray(availableSlots)
      ? availableSlots
      : (Array.isArray(availability) ? availability : (Array.isArray(specificAvailability) ? specificAvailability : null));

    connection = await db.getConnection();
    await connection.beginTransaction();

    await ensureAvailabilitySettings(connection, serviceProfileId);

    const availabilityStatus = acceptingBookings === false ? 'unavailable' : 'available';

    await connection.query(
      `UPDATE provider_availability_settings
       SET availability_status = ?
       WHERE service_profile_id = ?`,
      [availabilityStatus, serviceProfileId]
    );

    let countInserted = 0;
    if (Array.isArray(submittedSlots)) {
      const slotsByDate = new Map();
      for (const slot of submittedSlots) {
        const parsedDate = parseDateOnly(slot.date || slot.availableDate || slot.exceptionDate);
        const slotStart = parseTimeInputToSql(slot.startTime || slot.start_time);
        const slotEnd = parseTimeInputToSql(slot.endTime || slot.end_time);

        if (parsedDate && slotStart && slotEnd) {
          if (slotEnd <= slotStart) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'End time must be after start time' });
          }

          const dateStr = formatDateOnly(parsedDate);
          const ranges = slotsByDate.get(dateStr) || [];

          if (ranges.some((r) => slotStart < r.end && slotEnd > r.start)) {
            await connection.rollback();
            return res.status(400).json({
              success: false,
              message: `Availability slots overlap on ${dateStr}`
            });
          }

          ranges.push({ start: slotStart, end: slotEnd });
          slotsByDate.set(dateStr, ranges);
        }
      }

      await connection.query(
        'DELETE FROM provider_available_slots WHERE service_profile_id = ?',
        [serviceProfileId]
      );

      try {
        await connection.query(
          'DELETE FROM provider_weekly_availability WHERE service_profile_id = ?',
          [serviceProfileId]
        );
        await connection.query(
          'DELETE FROM provider_availability_exceptions WHERE service_profile_id = ?',
          [serviceProfileId]
        );
      } catch {
        // Ignore if legacy tables are dropped
      }

      for (const [dateStr, ranges] of slotsByDate.entries()) {
        for (const range of ranges) {
          await connection.query(
            `INSERT INTO provider_available_slots
             (service_profile_id, available_date, start_time, end_time)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE updated_at = NOW()`,
            [serviceProfileId, dateStr, range.start, range.end]
          );
          countInserted += 1;
        }
      }
    }

    if (Array.isArray(blackouts)) {
      await connection.query(
        'DELETE FROM provider_availability_blackouts WHERE service_profile_id = ?',
        [serviceProfileId]
      );

      for (const b of blackouts) {
        const parsedDate = parseDateOnly(b.date || b.blackoutDate);
        const slotStart = b.startTime ? parseTimeInputToSql(b.startTime) : null;
        const slotEnd = b.endTime ? parseTimeInputToSql(b.endTime) : null;

        if (parsedDate) {
          await connection.query(
            `INSERT INTO provider_availability_blackouts
             (service_profile_id, blackout_date, start_time, end_time, reason)
             VALUES (?, ?, ?, ?, ?)`,
            [serviceProfileId, formatDateOnly(parsedDate), slotStart, slotEnd, b.reason || null]
          );
        }
      }
    }

    await connection.commit();

    return res.json({
      success: true,
      message: 'Availability saved successfully',
      data: {
        acceptingBookings: availabilityStatus !== 'unavailable',
        availabilityCount: countInserted,
        systemRules: {
          allowSameDayBooking: false,
          minAdvanceNoticeMinutes: 720,
          maxAdvanceBookingDays: 60,
        },
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

    const serviceProfileId = profiles[0].id;
    const dateStr = formatDateOnly(parsedDate);

    if (exceptionType === 'available') {
      await db.query(
        `INSERT INTO provider_available_slots
         (service_profile_id, available_date, start_time, end_time)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE updated_at = NOW()`,
        [serviceProfileId, dateStr, normalizedStart, normalizedEnd]
      );
    } else {
      await db.query(
        `INSERT INTO provider_availability_blackouts
         (service_profile_id, blackout_date, start_time, end_time, reason)
         VALUES (?, ?, ?, ?, ?)`,
        [serviceProfileId, dateStr, normalizedStart, normalizedEnd, reason ? String(reason).trim().slice(0, 255) : null]
      );
    }

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

    const [resSlots] = await db.query(
      `DELETE pas
       FROM provider_available_slots pas
       JOIN service_profiles sp ON sp.id = pas.service_profile_id
       WHERE pas.id = ? AND sp.user_id = ?`,
      [exceptionId, userId]
    );

    const [resBlackouts] = await db.query(
      `DELETE pab
       FROM provider_availability_blackouts pab
       JOIN service_profiles sp ON sp.id = pab.service_profile_id
       WHERE pab.id = ? AND sp.user_id = ?`,
      [exceptionId, userId]
    );

    if (resSlots.affectedRows === 0 && resBlackouts.affectedRows === 0) {
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
    const languages = await getPersonLanguages(db, userId);

    return res.json({
      success: true,
      data: { languages }
    });
  } catch (error) {
    console.error('Error fetching provider languages:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch languages' });
  }
};

exports.updateMyLanguages = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const payload = Array.isArray(req.body.languages) ? req.body.languages : [];
    const normalized = Array.from(new Set(payload.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)));

    if (normalized.some((code) => !SUPPORTED_LANGUAGE_CODES.has(code))) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported language code provided'
      });
    }

    await applyPersonLanguages(db, userId, normalized);

    return res.json({
      success: true,
      message: 'Languages updated successfully',
      data: { languages: normalized }
    });
  } catch (error) {
    console.error('Error updating provider languages:', error);
    return res.status(500).json({ success: false, message: 'Failed to update languages' });
  }
};

exports.listEligibleCompletedRequests = async (req, res) => {
  try {
    const userId = req.user?.userId;

    const [rows] = await db.query(
      `SELECT sr.id, sr.service_type_key, sr.service_type_label, sr.created_at
       FROM service_requests sr
       LEFT JOIN portfolio_items pi ON pi.service_request_id = sr.id
       WHERE sr.provider_id = ?
         AND sr.status = 'completed'
         AND pi.id IS NULL
       ORDER BY sr.created_at DESC`,
      [userId]
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
      isPublished,
      isFeatured,
    } = req.body;

    if (!serviceRequestId) {
      return res.status(400).json({ success: false, message: 'serviceRequestId is required' });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [requests] = await connection.query(
      `SELECT id, status
       FROM service_requests
       WHERE id = ? AND provider_id = ?
       LIMIT 1 FOR UPDATE`,
      [serviceRequestId, userId]
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
      'SELECT COALESCE(MAX(display_order), 0) + 1 AS nextOrder FROM portfolio_items'
    );

    const publishFlag = isPublished == null
      ? true
      : !['false', '0', 'no'].includes(String(isPublished).trim().toLowerCase());
    const featuredFlag = ['true', '1', 'yes'].includes(
      String(isFeatured ?? false).trim().toLowerCase()
    );

    const [insertResult] = await connection.query(
      `INSERT INTO portfolio_items (
         service_request_id,
         image_url,
         image_public_id,
         is_published,
         is_featured,
         display_order
       )
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        serviceRequestId,
        imageUrl,
        imagePublicId,
        publishFlag,
        featuredFlag,
        orderResult[0].nextOrder,
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

    if (!items[0].completed_through_platform) {
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

    if (req.file) {
      if (hasCloudinaryConfig()) {
        const uploadResult = await uploadImageBuffer({
          buffer: req.file.buffer,
          mimeType: req.file.mimetype,
          folder: 'serbisyo-toledo/credentials',
          resourceType: req.file.mimetype === 'application/pdf' ? 'raw' : 'image',
          deliveryType: 'authenticated',
        });

        documentUrl = uploadResult.secure_url;
        documentPublicId = uploadResult.public_id;
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
         verification_status,
         verification_notes
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unverified', NULL)`,
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
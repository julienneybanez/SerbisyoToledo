const db = require('../config/database');
const {
  normalizeCategoryLabels,
  getServiceTypesForProfile,
  getServiceTypeByKey,
} = require('../config/serviceTaxonomy');
const {
  BLOCKING_STATUSES,
  parseDateOnly,
  parseTimeInputToSql,
  checkScheduleConflictForDates,
  normalizeBookingDates,
  isScheduleAvailableForDates,
} = require('../utils/bookingAvailability');
const cloudinaryService = require('../utils/cloudinaryService');

const MAX_JOB_DETAILS_LENGTH = 2000;
const MAX_DECLINE_REASON_LENGTH = 500;
const MAX_RESCHEDULE_REASON_LENGTH = 1000;
const MAX_DURATION_MINUTES = 24 * 60;
const MAX_BOOKING_DATES = 90;
const ACTIVE_REQUEST_STATUSES = ['pending', ...BLOCKING_STATUSES];

const CANCELLATION_REASONS = new Set([
  'Schedule conflict',
  'No longer need the service',
  'Provider unavailable',
  'Client unavailable',
  'Incorrect booking information',
  'Provider did not respond',
  'Found another provider',
  'Other',
]);

const allowedTransitions = {
  pending: ['accepted', 'declined', 'cancelled'],
  accepted: ['on_the_way', 'cancelled'],
  on_the_way: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  declined: [],
  cancelled: [],
};

const getProviderProfile = async (connection, serviceProfileId) => {
  const [profileRows] = await connection.query(
    `SELECT
      sp.id AS service_profile_id,
      sp.user_id AS provider_id,
      sp.starting_price,
      sp.is_published,
      u.user_type,
      u.is_active,
      u.is_verified
     FROM service_profiles sp
     JOIN users u ON u.id = sp.user_id
     WHERE sp.id = ?
     LIMIT 1`,
    [serviceProfileId]
  );

  return profileRows[0] || null;
};

const validateBookingPayload = ({
  bookingType,
  dates,
  startDate,
  endDate,
  scheduledDate,
  startTime,
  scheduledTime,
  estimatedDurationMinutes,
}) => {
  const rawBookingType = String(bookingType || 'one_day').trim().toLowerCase();
  const canonicalBookingType = rawBookingType === 'multi_day'
    ? 'date_range'
    : rawBookingType;

  if (!['one_day', 'date_range', 'specific_dates'].includes(canonicalBookingType)) {
    return { error: 'Invalid booking type' };
  }

  const normalizedStartTime = parseTimeInputToSql(startTime || scheduledTime);
  const normalizedDurationMinutes = Number(estimatedDurationMinutes || 0);
  const fallbackStartDate = startDate || scheduledDate;

  const normalizedDates = normalizeBookingDates({
    bookingType: canonicalBookingType,
    startDate: fallbackStartDate,
    endDate: endDate || fallbackStartDate,
    dates: Array.isArray(dates) ? dates : [],
  });

  if (!normalizedStartTime || normalizedDates.length === 0) {
    return { error: 'Booking date(s) and start time are required' };
  }

  if (normalizedDates.length > MAX_BOOKING_DATES) {
    return { error: `A booking can include at most ${MAX_BOOKING_DATES} service dates` };
  }

  if (canonicalBookingType === 'one_day' && normalizedDates.length !== 1) {
    return { error: 'One-day booking must contain exactly one service date' };
  }

  if (!Number.isInteger(normalizedDurationMinutes) || normalizedDurationMinutes <= 0 || normalizedDurationMinutes > MAX_DURATION_MINUTES) {
    return { error: 'Estimated duration must be between 1 and 1440 minutes' };
  }

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  for (const date of normalizedDates) {
    const parsed = parseDateOnly(date);
    if (!parsed) {
      return { error: 'Invalid booking date selection' };
    }
    if (parsed < todayUtc) {
      return { error: 'Schedule date cannot be in the past' };
    }
  }

  return {
    canonicalBookingType,
    storageBookingType: canonicalBookingType === 'one_day' ? 'one_day' : 'multi_day',
    normalizedDates,
    normalizedStartDate: normalizedDates[0],
    normalizedEndDate: normalizedDates[normalizedDates.length - 1],
    normalizedStartTime,
    normalizedDurationMinutes,
    durationDays: normalizedDates.length,
  };
};

const normalizeRequestSchedule = (requestRow) => {
  const startDate = requestRow.start_date;
  const endDate = requestRow.end_date;
  const startTime = parseTimeInputToSql(requestRow.start_time);
  const durationMinutes = Number(requestRow.estimated_duration_minutes || 0);

  return {
    startDate,
    endDate,
    startTime,
    durationMinutes,
  };
};

const getRequestDisplayLabel = (requestRow = {}) => {
  const storedLabel = String(requestRow.service_type_label || '').trim();
  if (storedLabel) return storedLabel;

  const serviceType = getServiceTypeByKey(requestRow.service_type_key);
  if (serviceType?.label) return serviceType.label;

  return 'Service Request';
};

const getPersistedRequestDates = async (queryable, requestRow = {}) => {
  try {
    const [rows] = await queryable.query(
      `SELECT DATE_FORMAT(service_date, '%Y-%m-%d') AS service_date
       FROM service_request_dates
       WHERE service_request_id = ?
       ORDER BY service_date ASC`,
      [requestRow.id]
    );

    const exactDates = rows
      .map((row) => String(row.service_date || '').trim())
      .filter(Boolean);

    if (exactDates.length > 0) {
      return exactDates;
    }
  } catch {
    // Fall back to schedule derivation
  }

  return normalizeBookingDates({
    bookingType: requestRow.booking_type === 'multi_day' ? 'date_range' : 'one_day',
    startDate: requestRow.start_date,
    endDate: requestRow.end_date || requestRow.start_date,
  });
};

const attachBookingDates = async (queryable, requestRows = []) => {
  const rows = Array.isArray(requestRows) ? requestRows : [];
  if (rows.length === 0) return [];

  let exactDatesByRequest = new Map();

  try {
    const ids = rows.map((row) => Number(row.id)).filter(Number.isFinite);
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(', ');
      const [dateRows] = await queryable.query(
        `SELECT service_request_id, DATE_FORMAT(service_date, '%Y-%m-%d') AS service_date
         FROM service_request_dates
         WHERE service_request_id IN (${placeholders})
         ORDER BY service_request_id, service_date`,
        ids
      );

      exactDatesByRequest = dateRows.reduce((map, row) => {
        const id = Number(row.service_request_id);
        if (!map.has(id)) map.set(id, []);
        map.get(id).push(String(row.service_date));
        return map;
      }, new Map());
    }
  } catch {
    // Ignore if exact dates table query fails
  }

  return rows.map((row) => {
    const fallbackDates = normalizeBookingDates({
      bookingType: row.booking_type === 'multi_day' ? 'date_range' : 'one_day',
      startDate: row.start_date,
      endDate: row.end_date || row.start_date,
    });
    const bookingDates = exactDatesByRequest.get(Number(row.id)) || fallbackDates;
    const continuousDates = bookingDates.length > 0
      ? normalizeBookingDates({
          bookingType: 'date_range',
          startDate: bookingDates[0],
          endDate: bookingDates[bookingDates.length - 1],
        })
      : [];
    const isContinuous = bookingDates.length === continuousDates.length
      && bookingDates.every((date, index) => date === continuousDates[index]);
    const bookingMode = bookingDates.length <= 1
      ? 'one_day'
      : (isContinuous ? 'date_range' : 'specific_dates');

    const { job_title: _legacyJobTitle, ...requestWithoutLegacyTitle } = row;

    return {
      ...requestWithoutLegacyTitle,
      service_display_label: getRequestDisplayLabel(row),
      booking_dates: bookingDates,
      selected_dates: bookingDates,
      booking_mode: bookingMode,
      multi_day_mode: bookingMode === 'specific_dates' ? 'specific_dates' : 'continuous',
      duration_days: bookingDates.length || Number(row.duration_days || 1),
    };
  });
};

const getRescheduleProposalDates = async (queryable, proposal = {}) => {
  if (proposal.id) {
    try {
      const [rows] = await queryable.query(
        `SELECT DATE_FORMAT(proposed_date, '%Y-%m-%d') AS proposed_date
         FROM service_request_reschedule_dates
         WHERE reschedule_id = ?
         ORDER BY proposed_date ASC`,
        [proposal.id]
      );
      const exactDates = rows.map((r) => String(r.proposed_date || '').trim()).filter(Boolean);
      if (exactDates.length > 0) {
        return exactDates;
      }
    } catch {
      // Fall through to date range derivation
    }
  }

  const startDate = proposal.proposed_start_date;
  const endDate = proposal.proposed_end_date || startDate;
  return normalizeBookingDates({
    bookingType: startDate && endDate && startDate !== endDate ? 'date_range' : 'one_day',
    startDate,
    endDate,
  });
};


// Create a new service request
exports.createRequest = async (req, res) => {
  let connection;

  try {
    const clientId = req.user.userId;
    const {
      providerId,
      serviceProfileId,
      serviceTypeKey,
      bookingType,
      dates,
      startDate,
      endDate,
      startTime,
      scheduledDate,
      scheduledTime,
      estimatedDurationMinutes,
      serviceLocation,
    } = req.body;

    const jobDetails = String(req.body.jobDetails || '').trim();
    const normalizedServiceLocation = String(serviceLocation || '').trim();

    if (req.user.userType !== 'client') {
      return res.status(403).json({
        success: false,
        message: 'Only clients can create service requests'
      });
    }

    if (!serviceProfileId || !jobDetails || !normalizedServiceLocation) {
      return res.status(400).json({
        success: false,
        message: 'Service profile, job details, and service location are required'
      });
    }

    if (normalizedServiceLocation.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Service location must not exceed 500 characters'
      });
    }

    if (jobDetails.length > MAX_JOB_DETAILS_LENGTH) {
      return res.status(400).json({
        success: false,
        message: 'Job details exceed the allowed length limit'
      });
    }

    const normalized = validateBookingPayload({
      bookingType,
      dates,
      startDate,
      endDate,
      scheduledDate,
      startTime,
      scheduledTime,
      estimatedDurationMinutes,
    });

    if (normalized.error) {
      return res.status(400).json({
        success: false,
        message: normalized.error,
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const profile = await getProviderProfile(connection, serviceProfileId);

    if (!profile) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Service profile not found'
      });
    }

    if (!profile.is_published) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'This service profile is not available for booking'
      });
    }

    if (profile.user_type !== 'tradesperson' || !profile.is_active || !profile.is_verified) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'This service provider is not available for booking'
      });
    }

    if (Number(clientId) === Number(profile.provider_id)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'You cannot book your own service profile'
      });
    }

    if (providerId && Number(providerId) !== Number(profile.provider_id)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Provider and service profile mismatch'
      });
    }

    const profileCategories = await connection.query(
      'SELECT category_key FROM service_profile_categories WHERE service_profile_id = ? ORDER BY category_key',
      [profile.service_profile_id]
    ).then(([rows]) => normalizeCategoryLabels(rows.map((row) => row.category_key), { preserveUnknown: true }));

    const [profileTypeRows] = await connection.query(
      'SELECT service_type_key FROM service_profile_types WHERE service_profile_id = ? ORDER BY service_type_key',
      [profile.service_profile_id]
    );
    const profileServiceTypeKeys = profileTypeRows.map((row) => row.service_type_key);
    const offeredServiceTypes = getServiceTypesForProfile({
      categoryLabels: profileCategories,
      serviceTypeKeys: profileServiceTypeKeys,
    });

    const offeredServiceTypeByKey = new Map(
      offeredServiceTypes.map((item) => [item.key, item])
    );

    const requestedServiceTypeKey = String(serviceTypeKey || '').trim() || null;

    if (requestedServiceTypeKey && !offeredServiceTypeByKey.has(requestedServiceTypeKey)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Selected service type is not offered by this provider',
      });
    }

    if (!requestedServiceTypeKey && offeredServiceTypes.length > 1) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Please select the specific service type you want to request',
      });
    }

    if (profileServiceTypeKeys.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'This service profile does not have any service types configured',
      });
    }

    const effectiveServiceType = requestedServiceTypeKey
      ? offeredServiceTypeByKey.get(requestedServiceTypeKey) || getServiceTypeByKey(requestedServiceTypeKey)
      : (offeredServiceTypes[0] || getServiceTypeByKey(profileServiceTypeKeys[0]) || null);
    const serviceRequestLabel = String(
      effectiveServiceType?.label || profileCategories[0] || 'Service Request'
    ).trim() || 'Service Request';

    const participantIds = [Number(clientId), Number(profile.provider_id)].sort((a, b) => a - b);
    await connection.query(
      'SELECT id FROM users WHERE id IN (?, ?) ORDER BY id FOR UPDATE',
      participantIds
    );

    const targetServiceTypeKey = (effectiveServiceType?.key || requestedServiceTypeKey || profileServiceTypeKeys[0] || null);

    if (targetServiceTypeKey) {
      const activeStatusPlaceholders = ACTIVE_REQUEST_STATUSES.map(() => '?').join(', ');
      const [activeClientRequests] = await connection.query(
        `SELECT sr.id, sr.provider_id, sr.service_type_key, sr.status
         FROM service_requests sr
         WHERE sr.client_id = ?
           AND sr.service_type_key = ?
           AND sr.status IN (${activeStatusPlaceholders})`,
        [clientId, targetServiceTypeKey, ...ACTIVE_REQUEST_STATUSES]
      );

      const activeServiceConflict = activeClientRequests.find((row) => (
        Number(row.provider_id) !== Number(profile.provider_id)
      ));

      if (activeServiceConflict) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          code: 'ACTIVE_SERVICE_TYPE_REQUEST_EXISTS',
          message: 'You already have an active request for this same service with another provider. Finish, cancel, or wait for that request to close first.',
          data: {
            existingRequestId: activeServiceConflict.id,
            serviceTypeKey: targetServiceTypeKey,
          },
        });
      }
    }

    const availability = await isScheduleAvailableForDates(connection, {
      serviceProfileId: profile.service_profile_id,
      providerId: profile.provider_id,
      dates: normalized.normalizedDates,
      startTime: normalized.normalizedStartTime,
      durationMinutes: normalized.normalizedDurationMinutes,
    });

    if (!availability.available) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: 'This schedule is no longer available. Please choose another available time.',
      });
    }

    const conflict = await checkScheduleConflictForDates(connection, {
      providerId: profile.provider_id,
      dates: normalized.normalizedDates,
      requestedStartTime: normalized.normalizedStartTime,
      requestedDurationMinutes: normalized.normalizedDurationMinutes,
    });

    if (conflict.conflict) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: 'This schedule is no longer available because the provider already has another confirmed booking.'
      });
    }

    const requestMultiDayMode = normalized.canonicalBookingType === 'specific_dates' ? 'specific_dates' : 'continuous';
    const dailyRate = Number(profile.starting_price || 0);
    const estimatedTotal = dailyRate * normalized.durationDays;

    const [result] = await connection.query(
      `INSERT INTO service_requests (
         client_id,
         provider_id,
         service_profile_id,
         service_type_key,
         service_type_label,
         job_details,
         service_location,
         booking_type,
         start_date,
         end_date,
         duration_days,
         multi_day_mode,
         start_time,
         estimated_duration_minutes,
         pricing_unit_snapshot,
         daily_rate_snapshot,
         estimated_total,
         status
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientId,
        profile.provider_id,
        profile.service_profile_id,
        targetServiceTypeKey,
        serviceRequestLabel,
        jobDetails,
        normalizedServiceLocation,
        normalized.storageBookingType,
        normalized.normalizedStartDate,
        normalized.normalizedEndDate,
        normalized.durationDays,
        requestMultiDayMode,
        normalized.normalizedStartTime,
        normalized.normalizedDurationMinutes,
        'per_day',
        dailyRate,
        estimatedTotal,
        'pending',
      ]
    );

    const requestId = result.insertId;

    await connection.query(
      `INSERT INTO service_request_status_history (
         service_request_id,
         from_status,
         to_status,
         changed_by,
         record_source
       ) VALUES (?, NULL, 'pending', ?, 'live')`,
      [requestId, clientId]
    );

    if (normalized.normalizedDates.length > 0) {
      const valuesSql = normalized.normalizedDates.map(() => '(?, ?)').join(', ');
      const values = normalized.normalizedDates.flatMap((date) => [requestId, date]);
      await connection.query(
        `INSERT INTO service_request_dates (service_request_id, service_date)
         VALUES ${valuesSql}
         ON DUPLICATE KEY UPDATE service_date = VALUES(service_date)`,
        values
      );
    }

    const [clientRows] = await connection.query('SELECT full_name FROM users WHERE id = ? LIMIT 1', [clientId]);
    const clientName = clientRows[0]?.full_name || 'A client';

    await connection.query(
      `INSERT INTO notifications (user_id, type, title, message, related_request_id)
       VALUES (?, 'request_received', ?, ?, ?)`,
      [profile.provider_id, 'New Service Request', `${clientName} has requested your service: ${serviceRequestLabel}`, requestId]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Service request created successfully',
      data: {
        requestId,
        serviceTypeKey: effectiveServiceType?.key || null,
        serviceTypeLabel: serviceRequestLabel,
        bookingType: normalized.canonicalBookingType,
        bookingDates: normalized.normalizedDates,
        startDate: normalized.normalizedStartDate,
        endDate: normalized.normalizedEndDate,
        startTime: normalized.normalizedStartTime,
        durationDays: normalized.durationDays,
        dailyRateSnapshot: dailyRate,
        estimatedTotal,
        serviceLocation: normalizedServiceLocation,
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Create request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create service request'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Get requests for client (their sent requests)
exports.getClientRequests = async (req, res) => {
  try {
    const clientId = req.user.userId;

    const [requests] = await db.query(
      `SELECT sr.*,
              u.full_name as provider_name,
              sp.barangay_address as provider_location,
              (SELECT COUNT(*) FROM reviews rv WHERE rv.service_request_id = sr.id) as has_review
       FROM service_requests sr
       JOIN service_profiles sp ON sr.service_profile_id = sp.id
       JOIN users u ON sr.provider_id = u.id
       WHERE sr.client_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM service_request_archives archive
           WHERE archive.service_request_id = sr.id AND archive.user_id = ?
         )
       ORDER BY sr.created_at DESC`,
      [clientId, clientId]
    );

    const requestsWithDates = await attachBookingDates(db, requests);
    const processedRequests = requestsWithDates.map((request) => ({
      ...request,
      has_review: request.has_review > 0,
    }));

    res.json({
      success: true,
      data: { requests: processedRequests }
    });
  } catch (error) {
    console.error('Get client requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requests'
    });
  }
};

// Get requests for service provider (received requests)
exports.getProviderRequests = async (req, res) => {
  try {
    const providerId = req.user.userId;

    const [requests] = await db.query(
      `SELECT sr.*,
              u.full_name as client_name
       FROM service_requests sr
       JOIN users u ON sr.client_id = u.id
       WHERE sr.provider_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM service_request_archives archive
           WHERE archive.service_request_id = sr.id AND archive.user_id = ?
         )
       ORDER BY sr.created_at DESC`,
      [providerId, providerId]
    );

    const requestsWithDates = await attachBookingDates(db, requests);

    res.json({
      success: true,
      data: { requests: requestsWithDates }
    });
  } catch (error) {
    console.error('Get provider requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requests'
    });
  }
};

// Update request status (accept/decline/on_the_way/in_progress/completed/cancelled)
exports.updateRequestStatus = async (req, res) => {
  let connection;

  try {
    const { requestId } = req.params;
    const { status, reason, cancellationReason, cancellationReasonOther } = req.body;
    const userId = req.user.userId;

    const validStatuses = ['accepted', 'declined', 'on_the_way', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [requests] = await connection.query(
      `SELECT sr.*, u.full_name as provider_name, c.full_name as client_name
       FROM service_requests sr
       JOIN users u ON sr.provider_id = u.id
       JOIN users c ON sr.client_id = c.id
       WHERE sr.id = ? AND (sr.client_id = ? OR sr.provider_id = ?)
       FOR UPDATE`,
      [requestId, userId, userId]
    );

    if (requests.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    const request = requests[0];
    const currentStatus = request.status;

    if (status !== 'completed') {
      const possibleTransitions = allowedTransitions[currentStatus] || [];
      if (!possibleTransitions.includes(status)) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: `Cannot change request status from ${currentStatus} to ${status}`
        });
      }
    }

    if (status === 'accepted') {
      if (request.provider_id !== userId) {
        await connection.rollback();
        return res.status(403).json({
          success: false,
          message: 'Only the service provider can accept this request'
        });
      }

      const schedule = normalizeRequestSchedule(request);
      const requestDates = await getPersistedRequestDates(connection, request);
      const conflict = await checkScheduleConflictForDates(connection, {
        providerId: request.provider_id,
        dates: requestDates,
        requestedStartTime: schedule.startTime,
        requestedDurationMinutes: schedule.durationMinutes,
        excludeRequestId: request.id,
      });

      if (conflict.conflict) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: 'This schedule is no longer available because the provider already has another confirmed booking.'
        });
      }
    }

    if (status === 'cancelled') {
      if (request.client_id !== userId && request.provider_id !== userId) {
        await connection.rollback();
        return res.status(403).json({
          success: false,
          message: 'Only participants can cancel this request'
        });
      }

      if (['completed', 'declined', 'cancelled'].includes(currentStatus)) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: `Cannot change request status from ${currentStatus} to cancelled`
        });
      }

      const normalizedCancellationReason = String(cancellationReason || '').trim();
      const normalizedCancellationReasonOther = String(cancellationReasonOther || '').trim();

      if (!CANCELLATION_REASONS.has(normalizedCancellationReason)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Invalid cancellation reason'
        });
      }

      if (normalizedCancellationReason === 'Other' && !normalizedCancellationReasonOther) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Please provide a cancellation explanation when selecting Other.'
        });
      }

      const effectiveReasonText = normalizedCancellationReason === 'Other'
        ? normalizedCancellationReasonOther
        : normalizedCancellationReason;

      await connection.query(
        `UPDATE service_requests
         SET status = 'cancelled',
             cancelled_by = ?,
             cancellation_reason = ?,
             cancellation_reason_other = ?,
             cancelled_at = NOW()
         WHERE id = ?`,
        [
          userId,
          normalizedCancellationReason,
          normalizedCancellationReason === 'Other' ? normalizedCancellationReasonOther : null,
          requestId,
        ]
      );

      await connection.query(
        `INSERT INTO service_request_status_history (
           service_request_id,
           from_status,
           to_status,
           changed_by,
           reason,
           record_source
         ) VALUES (?, ?, 'cancelled', ?, ?, 'live')`,
        [Number(requestId), currentStatus, userId, effectiveReasonText]
      );

      await connection.query(
        `UPDATE service_request_reschedules
         SET reschedule_status = 'declined', responded_at = NOW()
         WHERE service_request_id = ? AND reschedule_status = 'pending'`,
        [requestId]
      );

      const otherUserId = request.client_id === userId ? request.provider_id : request.client_id;
      const actorName = request.client_id === userId ? request.client_name : request.provider_name;
      await connection.query(
        `INSERT INTO notifications (user_id, type, title, message, related_request_id)
         VALUES (?, 'request_cancelled', ?, ?, ?)`,
        [
          otherUserId,
          'Booking Cancelled',
          `${actorName} cancelled the booking "${getRequestDisplayLabel(request)}".`,
          requestId,
        ]
      );

      await connection.commit();

      return res.json({
        success: true,
        message: 'Request cancelled successfully'
      });
    }

    if (status === 'completed') {
      if (request.client_id !== userId && request.provider_id !== userId) {
        await connection.rollback();
        return res.status(403).json({
          success: false,
          message: 'Only the client or provider can mark this request as completed'
        });
      }

      if (currentStatus === 'completed' || currentStatus === 'declined' || currentStatus === 'cancelled') {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: `Cannot change request status from ${currentStatus} to completed`
        });
      }

      if (currentStatus !== 'in_progress') {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: 'Request can only be completed after the provider starts the service'
        });
      }

      const isClientAction = request.client_id === userId;
      const isProviderAction = request.provider_id === userId;

      if (isProviderAction) {
        if (request.provider_completed) {
          await connection.rollback();
          return res.status(409).json({ success: false, message: 'You have already confirmed completion' });
        }
        await connection.query(
          `UPDATE service_requests
           SET provider_completed = TRUE,
               provider_completed_at = COALESCE(provider_completed_at, NOW())
           WHERE id = ? AND provider_completed = FALSE`,
          [requestId]
        );
      }

      if (isClientAction) {
        if (request.client_completed) {
          await connection.rollback();
          return res.status(409).json({ success: false, message: 'You have already confirmed completion' });
        }
        await connection.query(
          `UPDATE service_requests
           SET client_completed = TRUE,
               client_completed_at = COALESCE(client_completed_at, NOW())
           WHERE id = ? AND client_completed = FALSE`,
          [requestId]
        );
      }

      const [updated] = await connection.query(
        'SELECT status, provider_completed, client_completed FROM service_requests WHERE id = ? FOR UPDATE',
        [requestId]
      );
      const bothConfirmed = updated[0].provider_completed && updated[0].client_completed;

      if (bothConfirmed) {
        if (updated[0].status !== 'completed') {
          await connection.query('UPDATE service_requests SET status = ? WHERE id = ? AND status <> \'completed\'', ['completed', requestId]);

          await connection.query(
            `INSERT INTO service_request_status_history (
               service_request_id,
               from_status,
               to_status,
               changed_by,
               record_source
             ) VALUES (?, 'in_progress', 'completed', ?, 'live')`,
            [Number(requestId), userId]
          );

          await connection.query(
            `INSERT INTO notifications (user_id, type, title, message, related_request_id)
             VALUES (?, 'service_completed', ?, ?, ?)`,
            [request.client_id, 'Service Completed', `Your service request "${getRequestDisplayLabel(request)}" has been completed! You can now leave a review.`, requestId]
          );
          await connection.query(
            `INSERT INTO notifications (user_id, type, title, message, related_request_id)
             VALUES (?, 'service_completed', ?, ?, ?)`,
            [request.provider_id, 'Service Completed', `The service "${getRequestDisplayLabel(request)}" has been marked as completed by both parties.`, requestId]
          );
        }

        await connection.commit();

        return res.json({
          success: true,
          message: 'Both parties confirmed — service marked as completed!',
          data: { fullyCompleted: true }
        });
      }

      const otherUserId = isProviderAction ? request.client_id : request.provider_id;
      const confirmerName = isProviderAction ? request.provider_name : request.client_name;

      await connection.query(
        `INSERT INTO notifications (user_id, type, title, message, related_request_id)
         VALUES (?, 'completion_confirmed', ?, ?, ?)`,
        [otherUserId, 'Completion Pending', `${confirmerName} has confirmed completion for "${getRequestDisplayLabel(request)}". Please confirm on your end.`, requestId]
      );

      await connection.commit();

      return res.json({
        success: true,
        message: 'Completion confirmed! Waiting for the other party to confirm.',
        data: {
          fullyCompleted: false,
          provider_completed: isProviderAction ? true : Boolean(request.provider_completed),
          client_completed: isClientAction ? true : Boolean(request.client_completed),
        }
      });
    }

    if (request.provider_id !== userId) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        message: 'Only the service provider can update this request'
      });
    }

    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';

    if (status === 'declined') {
      if (!trimmedReason) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Reason for declining is required'
        });
      }

      if (trimmedReason.length > MAX_DECLINE_REASON_LENGTH) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Reason for declining must not exceed 500 characters'
        });
      }

      await connection.query(
        'UPDATE service_requests SET status = ?, decline_reason = ? WHERE id = ?',
        [status, trimmedReason, requestId]
      );
      await connection.query(
        `INSERT INTO service_request_status_history (
           service_request_id,
           from_status,
           to_status,
           changed_by,
           reason,
           record_source
         ) VALUES (?, ?, 'declined', ?, ?, 'live')`,
        [Number(requestId), currentStatus, userId, trimmedReason]
      );
    } else {
      await connection.query(
        'UPDATE service_requests SET status = ? WHERE id = ?',
        [status, requestId]
      );
      await connection.query(
        `INSERT INTO service_request_status_history (
           service_request_id,
           from_status,
           to_status,
           changed_by,
           record_source
         ) VALUES (?, ?, ?, ?, 'live')`,
        [Number(requestId), currentStatus, status, userId]
      );
    }

    if (status !== 'accepted') {
      await connection.query(
        `UPDATE service_request_reschedules
         SET reschedule_status = 'declined', responded_at = NOW()
         WHERE service_request_id = ? AND reschedule_status = 'pending'`,
        [requestId]
      );
    }

    let notificationType;
    let notificationTitle;
    let notificationMessage;

    switch (status) {
      case 'accepted':
        notificationType = 'request_accepted';
        notificationTitle = 'Request Accepted!';
        notificationMessage = `${request.provider_name} has accepted your service request: ${getRequestDisplayLabel(request)}`;
        break;
      case 'declined':
        notificationType = 'request_declined';
        notificationTitle = 'Request Declined';
        notificationMessage = `${request.provider_name} declined your service request "${getRequestDisplayLabel(request)}".\n\nReason: ${trimmedReason}`;
        break;
      case 'on_the_way':
        notificationType = 'provider_on_way';
        notificationTitle = 'Provider On The Way!';
        notificationMessage = `${request.provider_name} is now on the way for: ${getRequestDisplayLabel(request)}`;
        break;
      default:
        break;
    }

    if (notificationType) {
      await connection.query(
        `INSERT INTO notifications (user_id, type, title, message, related_request_id)
         VALUES (?, ?, ?, ?, ?)`,
        [request.client_id, notificationType, notificationTitle, notificationMessage, requestId]
      );
    }

    await connection.commit();

    if (['accepted', 'declined'].includes(status)) {
      const io = req.app.get('io');
      if (io) {
        try {
          const [conversationRows] = await db.query(
            'SELECT id FROM conversations WHERE service_request_id = ? LIMIT 1',
            [requestId]
          );
          const conversationId = conversationRows[0]?.id || null;
          const payload = {
            conversationId,
            serviceRequestId: Number(requestId),
            requestStatus: status,
            eventType: status === 'accepted' ? 'request_accepted' : 'request_declined',
          };
          io.to('user:' + request.client_id).emit('conversation:updated', payload);
          io.to('user:' + request.provider_id).emit('conversation:updated', payload);
        } catch (eventError) {
          console.error('Conversation status broadcast error:', eventError);
        }
      }
    }

    res.json({
      success: true,
      message: `Request ${status} successfully`
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Update request status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update request status'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

exports.proposeReschedule = async (req, res) => {
  let connection;

  try {
    const { requestId } = req.params;
    const actorId = req.user.userId;
    const {
      bookingType,
      proposedDates,
      proposedStartDate,
      proposedEndDate,
      proposedStartTime,
      reason,
      estimatedDurationMinutes,
    } = req.body;

    const rawBookingType = String(bookingType || 'one_day').trim().toLowerCase();
    const canonicalBookingType = rawBookingType === 'multi_day' ? 'date_range' : rawBookingType;

    if (!['one_day', 'date_range', 'specific_dates'].includes(canonicalBookingType)) {
      return res.status(400).json({ success: false, message: 'Invalid reschedule booking type.' });
    }

    const normalizedProposedDates = normalizeBookingDates({
      bookingType: canonicalBookingType,
      startDate: proposedStartDate,
      endDate: proposedEndDate || proposedStartDate,
      dates: Array.isArray(proposedDates) ? proposedDates : [],
    });
    const normalizedProposedTime = parseTimeInputToSql(proposedStartTime);
    const normalizedDurationMinutes = Number(estimatedDurationMinutes || 0);

    if (normalizedProposedDates.length === 0 || !normalizedProposedTime) {
      return res.status(400).json({ success: false, message: 'Proposed schedule is invalid.' });
    }

    if (normalizedProposedDates.length > MAX_BOOKING_DATES) {
      return res.status(400).json({ success: false, message: `A reschedule can include at most ${MAX_BOOKING_DATES} service dates.` });
    }

    if (canonicalBookingType === 'one_day' && normalizedProposedDates.length !== 1) {
      return res.status(400).json({ success: false, message: 'One-day reschedule must contain exactly one date.' });
    }

    if (!Number.isInteger(normalizedDurationMinutes) || normalizedDurationMinutes <= 0 || normalizedDurationMinutes > MAX_DURATION_MINUTES) {
      return res.status(400).json({ success: false, message: 'Estimated duration must be between 1 and 1440 minutes.' });
    }

    const today = new Date();
    const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    if (normalizedProposedDates.some((date) => {
      const parsed = parseDateOnly(date);
      return !parsed || parsed < todayUtc;
    })) {
      return res.status(400).json({ success: false, message: 'Proposed dates must be valid future or current dates.' });
    }

    const trimmedReason = String(reason || '').trim();
    if (!trimmedReason) {
      return res.status(400).json({ success: false, message: 'Reschedule reason is required.' });
    }

    if (trimmedReason.length > MAX_RESCHEDULE_REASON_LENGTH) {
      return res.status(400).json({ success: false, message: 'Reschedule reason is too long.' });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [requests] = await connection.query(
      `SELECT sr.*, provider.full_name AS provider_name, client.full_name AS client_name
       FROM service_requests sr
       JOIN users provider ON provider.id = sr.provider_id
       JOIN users client ON client.id = sr.client_id
       WHERE sr.id = ? AND (sr.client_id = ? OR sr.provider_id = ?)
       FOR UPDATE`,
      [requestId, actorId, actorId]
    );

    if (requests.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const request = requests[0];

    if (request.status !== 'accepted') {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: 'A booking can only be rescheduled before the provider is on the way.'
      });
    }

    const [pendingReschedules] = await connection.query(
      `SELECT id
       FROM service_request_reschedules
       WHERE service_request_id = ? AND reschedule_status = 'pending'
       LIMIT 1
       FOR UPDATE`,
      [request.id]
    );

    if (pendingReschedules.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: 'This booking already has a pending reschedule proposal. Resolve it before proposing another.'
      });
    }

    const availability = await isScheduleAvailableForDates(connection, {
      serviceProfileId: request.service_profile_id,
      providerId: request.provider_id,
      dates: normalizedProposedDates,
      startTime: normalizedProposedTime,
      durationMinutes: normalizedDurationMinutes,
      excludeRequestId: request.id,
    });

    if (!availability.available) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: availability.message || 'The proposed schedule is outside the provider\'s availability.'
      });
    }

    const conflict = await checkScheduleConflictForDates(connection, {
      providerId: request.provider_id,
      dates: normalizedProposedDates,
      requestedStartTime: normalizedProposedTime,
      requestedDurationMinutes: normalizedDurationMinutes,
      excludeRequestId: request.id,
    });

    if (conflict.conflict) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: 'The proposed schedule conflicts with another confirmed booking.'
      });
    }

    const existingSchedule = normalizeRequestSchedule(request);
    const proposedStartDateIso = normalizedProposedDates[0];
    const proposedEndDateIso = normalizedProposedDates[normalizedProposedDates.length - 1];

    const [rescheduleResult] = await connection.query(
      `INSERT INTO service_request_reschedules (
         service_request_id,
         original_start_date,
         original_end_date,
         original_start_time,
         proposed_start_date,
         proposed_end_date,
         proposed_start_time,
         proposed_estimated_duration_minutes,
         proposed_multi_day_mode,
         proposed_by,
         reschedule_reason,
         reschedule_status
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        request.id,
        existingSchedule.startDate,
        existingSchedule.endDate,
        existingSchedule.startTime,
        proposedStartDateIso,
        proposedEndDateIso,
        normalizedProposedTime,
        normalizedDurationMinutes,
        canonicalBookingType === 'specific_dates' ? 'specific_dates' : 'continuous',
        actorId,
        trimmedReason,
      ]
    );

    const rescheduleId = rescheduleResult.insertId;

    if (normalizedProposedDates.length > 0) {
      const placeholders = normalizedProposedDates.map(() => '(?, ?)').join(', ');
      const dateValues = normalizedProposedDates.flatMap((date) => [rescheduleId, date]);
      await connection.query(
        `INSERT INTO service_request_reschedule_dates (reschedule_id, proposed_date)
         VALUES ${placeholders}
         ON DUPLICATE KEY UPDATE proposed_date = VALUES(proposed_date)`,
        dateValues
      );
    }

    const recipientId = actorId === request.client_id ? request.provider_id : request.client_id;
    const actorName = actorId === request.client_id ? request.client_name : request.provider_name;

    await connection.query(
      `INSERT INTO notifications (user_id, type, title, message, related_request_id)
       VALUES (?, 'reschedule_proposed', ?, ?, ?)`,
      [
        recipientId,
        'Reschedule Proposed',
        `${actorName} proposed a new schedule for "${getRequestDisplayLabel(request)}".`,
        request.id,
      ]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Reschedule proposal sent successfully.',
      data: {
        bookingType: canonicalBookingType,
        dates: normalizedProposedDates,
        startTime: normalizedProposedTime,
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Propose reschedule error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create reschedule proposal'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

exports.respondToReschedule = async (req, res) => {
  let connection;

  try {
    const { requestId, rescheduleId } = req.params;
    const actorId = req.user.userId;
    const { action } = req.body;

    if (!['accepted', 'declined'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid reschedule action.' });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [requests] = await connection.query(
      `SELECT sr.*, provider.full_name AS provider_name, client.full_name AS client_name
       FROM service_requests sr
       JOIN users provider ON provider.id = sr.provider_id
       JOIN users client ON client.id = sr.client_id
       WHERE sr.id = ? AND (sr.client_id = ? OR sr.provider_id = ?)
       FOR UPDATE`,
      [requestId, actorId, actorId]
    );

    if (requests.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const request = requests[0];

    if (request.status !== 'accepted') {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: 'This reschedule proposal is no longer valid because the booking is not in Accepted status.'
      });
    }

    const [reschedules] = await connection.query(
      `SELECT *
       FROM service_request_reschedules
       WHERE id = ? AND service_request_id = ?
       FOR UPDATE`,
      [rescheduleId, requestId]
    );

    if (reschedules.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Reschedule proposal not found' });
    }

    const proposal = reschedules[0];

    if (proposal.reschedule_status !== 'pending') {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Reschedule proposal is already resolved' });
    }

    if (proposal.proposed_by === actorId) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: 'You cannot respond to your own proposal' });
    }

    if (action === 'accepted') {
      const proposedDates = await getRescheduleProposalDates(connection, proposal);
      if (proposedDates.length === 0) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: 'The proposed schedule has no valid service dates.' });
      }

      const proposedDurationMinutes = Number(
        proposal.proposed_estimated_duration_minutes || request.estimated_duration_minutes || 0
      );

      const availability = await isScheduleAvailableForDates(connection, {
        serviceProfileId: request.service_profile_id,
        providerId: request.provider_id,
        dates: proposedDates,
        startTime: proposal.proposed_start_time,
        durationMinutes: proposedDurationMinutes,
        excludeRequestId: request.id,
      });

      if (!availability.available) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: availability.message || 'The proposed schedule is no longer within the provider\'s availability.'
        });
      }

      const conflict = await checkScheduleConflictForDates(connection, {
        providerId: request.provider_id,
        dates: proposedDates,
        requestedStartTime: proposal.proposed_start_time,
        requestedDurationMinutes: proposedDurationMinutes,
        excludeRequestId: request.id,
      });

      if (conflict.conflict) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: 'The proposed schedule is no longer available.'
        });
      }

      const durationDays = proposedDates.length;
      const dailyRateSnapshot = Number(request.daily_rate_snapshot || 0);
      const estimatedTotal = dailyRateSnapshot * durationDays;
      const specificMode = String(proposal.proposed_multi_day_mode || '').toLowerCase() === 'specific_dates' ? 'specific_dates' : 'continuous';

      await connection.query(
        `UPDATE service_requests
         SET booking_type = ?,
             start_date = ?,
             end_date = ?,
             duration_days = ?,
             start_time = ?,
             estimated_duration_minutes = ?,
             estimated_total = ?,
             multi_day_mode = ?
         WHERE id = ?`,
        [
          proposedDates.length === 1 ? 'one_day' : 'multi_day',
          proposedDates[0],
          proposedDates[proposedDates.length - 1],
          durationDays,
          proposal.proposed_start_time,
          proposedDurationMinutes,
          estimatedTotal,
          specificMode,
          request.id,
        ]
      );

      await connection.query(
        'DELETE FROM service_request_dates WHERE service_request_id = ?',
        [request.id]
      );

      const placeholders = proposedDates.map(() => '(?, ?)').join(', ');
      const dateValues = proposedDates.flatMap((date) => [request.id, date]);
      await connection.query(
        `INSERT INTO service_request_dates (service_request_id, service_date)
         VALUES ${placeholders}`,
        dateValues
      );
    }

    await connection.query(
      `UPDATE service_request_reschedules
       SET reschedule_status = ?, responded_by = ?, responded_at = NOW()
       WHERE id = ?`,
      [action, actorId, proposal.id]
    );

    const proposerId = proposal.proposed_by;
    const responderName = actorId === request.client_id ? request.client_name : request.provider_name;

    await connection.query(
      `INSERT INTO notifications (user_id, type, title, message, related_request_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        proposerId,
        action === 'accepted' ? 'reschedule_accepted' : 'reschedule_declined',
        `Reschedule ${action}`,
        `${responderName} ${action} the reschedule proposal for "${getRequestDisplayLabel(request)}".`,
        request.id,
      ]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: `Reschedule proposal ${action} successfully.`
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Respond reschedule error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to respond to reschedule proposal'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Get single request details
exports.getRequestById = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.userId;

    const [requests] = await db.query(
          `SELECT sr.*,
              u.full_name as provider_name,
              sp.barangay_address as provider_location,
              c.full_name as client_name
       FROM service_requests sr
       JOIN service_profiles sp ON sr.service_profile_id = sp.id
       JOIN users u ON sr.provider_id = u.id
       JOIN users c ON sr.client_id = c.id
       WHERE sr.id = ? AND (sr.client_id = ? OR sr.provider_id = ?)` ,
      [requestId, userId, userId]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    const [request] = await attachBookingDates(db, requests);

    const [reschedules] = await db.query(
      `SELECT *
       FROM service_request_reschedules
       WHERE service_request_id = ?
       ORDER BY created_at DESC`,
      [requestId]
    );

    const formattedReschedules = await Promise.all(reschedules.map(async (item) => {
      const dates = await getRescheduleProposalDates(db, item);
      const isSpecific = String(item.proposed_multi_day_mode || '').toLowerCase() === 'specific_dates';
      const bookingMode = isSpecific
        ? 'specific_dates'
        : (String(item.proposed_start_date || '') !== String(item.proposed_end_date || '') ? 'date_range' : 'one_day');

      return {
        ...item,
        proposed_booking_mode: bookingMode,
        proposed_specific_dates: dates,
      };
    }));

    res.json({
      success: true,
      data: { request, reschedules: formattedReschedules }
    });
  } catch (error) {
    console.error('Get request by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch request details'
    });
  }
};

// Create a review for a completed service request
exports.createReview = async (req, res) => {
  try {
    const { requestId } = req.params;
    const clientId = req.user.userId;
    const { rating, comment } = req.body;
    const trimmedComment = String(comment || '').trim();

    if (!rating || rating < 1 || rating > 5 || (rating * 2) % 1 !== 0) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5, in half-star increments'
      });
    }

    if (trimmedComment.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Review comment must not exceed 2000 characters'
      });
    }

    const [requests] = await db.query(
      `SELECT sr.*, sp.id as profile_id, u.full_name as client_name
       FROM service_requests sr
       JOIN service_profiles sp ON sr.service_profile_id = sp.id
       JOIN users u ON sr.client_id = u.id
       WHERE sr.id = ? AND sr.client_id = ?`,
      [requestId, clientId]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    const request = requests[0];

    if (request.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'You can only review completed service requests'
      });
    }

    const [existingReview] = await db.query(
      'SELECT id FROM reviews WHERE service_request_id = ?',
      [requestId]
    );

    if (existingReview.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this service request'
      });
    }

    await db.query(
      `INSERT INTO reviews (service_request_id, rating, comment)
       VALUES (?, ?, ?)`,
      [requestId, rating, trimmedComment || null]
    );

    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, related_request_id)
       VALUES (?, 'review_received', ?, ?, ?)`,
      [request.provider_id, 'New Review', `${request.client_name} left a ${rating}-star review for "${getRequestDisplayLabel(request)}"`, requestId]
    );

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: { rating }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this service request'
      });
    }

    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit review'
    });
  }
};

// Report a user involved in a service request
exports.createReport = async (req, res) => {
  try {
    const { requestId } = req.params;
    const reporterId = req.user.userId;
    const { reportedUserId, reason, description } = req.body;

    if (!reportedUserId || !reason || !description) {
      return res.status(400).json({
        success: false,
        message: 'Reported user, reason, and description are required'
      });
    }

    const [requests] = await db.query(
      `SELECT id, client_id, provider_id
       FROM service_requests
       WHERE id = ?
         AND (client_id = ? OR provider_id = ?)
       LIMIT 1`,
      [requestId, reporterId, reporterId]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    const request = requests[0];
    const reporterIsParticipant = request.client_id === reporterId || request.provider_id === reporterId;
    const reportedIdNum = Number(reportedUserId);
    const validCounterparty =
      (request.client_id === reporterId && request.provider_id === reportedIdNum) ||
      (request.provider_id === reporterId && request.client_id === reportedIdNum);

    if (!reporterIsParticipant || !validCounterparty) {
      return res.status(403).json({
        success: false,
        message: 'You can only report users you had a valid service request interaction with'
      });
    }

    const screenshotFile = req.file;
    let uploadedScreenshot = null;
    if (screenshotFile) {
      if (!cloudinaryService.hasCloudinaryConfig()) {
        return res.status(503).json({ success: false, message: 'Screenshot upload is temporarily unavailable' });
      }
      uploadedScreenshot = await cloudinaryService.uploadImageBuffer({
        buffer: screenshotFile.buffer,
        mimeType: screenshotFile.mimetype,
        folder: 'serbisyo-toledo/reports',
      });
    }

    try {
      await db.query(
      `INSERT INTO user_reports
       (request_id, reporter_id, reported_user_id, reason, description, screenshot_url, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [
        requestId,
        reporterId,
        reportedIdNum,
        reason,
        description,
        uploadedScreenshot?.secure_url || null,
      ]
      );
    } catch (error) {
      if (uploadedScreenshot?.public_id) {
        await cloudinaryService.deleteImageByPublicId(uploadedScreenshot.public_id);
      }
      throw error;
    }

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully'
    });
  } catch (error) {
    console.error('Create report error:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'You already submitted a report for this user on this request'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to submit report'
    });
  }
};

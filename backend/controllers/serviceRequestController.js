const db = require('../config/database');
const { parseJsonArray } = require('../utils/jsonHelpers');
const {
  normalizeCategoryLabels,
  getServiceTypesForProfile,
} = require('../config/serviceTaxonomy');
const {
  BLOCKING_STATUSES,
  parseDateOnly,
  formatDateOnly,
  parseTimeInputToSql,
  calculateDurationDays,
  checkScheduleConflict,
  isScheduleAvailableForRange,
} = require('../utils/bookingAvailability');

const MAX_JOB_TITLE_LENGTH = 255;
const MAX_JOB_DETAILS_LENGTH = 2000;
const MAX_DECLINE_REASON_LENGTH = 500;
const MAX_RESCHEDULE_REASON_LENGTH = 1000;
const MAX_DURATION_MINUTES = 24 * 60;

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
      sp.service_categories,
      sp.service_types,
      sp.is_published,
      u.user_type,
      u.is_active
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
  startDate,
  endDate,
  scheduledDate,
  startTime,
  scheduledTime,
  estimatedDurationMinutes,
}) => {
  const normalizedBookingType = bookingType === 'multi_day' ? 'multi_day' : 'one_day';
  const normalizedStartDate = startDate || scheduledDate;
  const normalizedEndDate = normalizedBookingType === 'multi_day'
    ? (endDate || startDate || scheduledDate)
    : (startDate || scheduledDate);
  const normalizedStartTime = parseTimeInputToSql(startTime || scheduledTime);
  const normalizedDurationMinutes = Number(estimatedDurationMinutes || 0);

  if (!normalizedStartDate || !normalizedEndDate || !normalizedStartTime) {
    return { error: 'Booking date and start time are required' };
  }

  if (!Number.isInteger(normalizedDurationMinutes) || normalizedDurationMinutes <= 0 || normalizedDurationMinutes > MAX_DURATION_MINUTES) {
    return { error: 'Estimated duration must be between 1 and 1440 minutes' };
  }

  const parsedStartDate = parseDateOnly(normalizedStartDate);
  const parsedEndDate = parseDateOnly(normalizedEndDate);

  if (!parsedStartDate || !parsedEndDate) {
    return { error: 'Invalid booking date range' };
  }

  if (parsedEndDate < parsedStartDate) {
    return { error: 'End date cannot be earlier than start date' };
  }

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  if (parsedStartDate < todayUtc) {
    return { error: 'Schedule date cannot be in the past' };
  }

  const durationDays = calculateDurationDays(normalizedStartDate, normalizedEndDate);

  if (!durationDays) {
    return { error: 'Invalid booking duration' };
  }

  return {
    normalizedBookingType,
    normalizedStartDate,
    normalizedEndDate,
    normalizedStartTime,
    normalizedDurationMinutes,
    durationDays,
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
      startDate,
      endDate,
      startTime,
      scheduledDate,
      scheduledTime,
      estimatedDurationMinutes,
    } = req.body;

    const jobTitle = String(req.body.jobTitle || '').trim();
    const jobDetails = String(req.body.jobDetails || '').trim();

    if (req.user.userType !== 'client') {
      return res.status(403).json({
        success: false,
        message: 'Only clients can create service requests'
      });
    }

    if (!serviceProfileId || !jobTitle || !jobDetails) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (jobTitle.length > MAX_JOB_TITLE_LENGTH || jobDetails.length > MAX_JOB_DETAILS_LENGTH) {
      return res.status(400).json({
        success: false,
        message: 'Request details exceed allowed length limits'
      });
    }

    const normalized = validateBookingPayload({
      bookingType,
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

    if (profile.user_type !== 'tradesperson' || !profile.is_active) {
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

    const profileCategories = normalizeCategoryLabels(parseJsonArray(profile.service_categories, []), { preserveUnknown: true });
    const profileServiceTypeKeys = parseJsonArray(profile.service_types, []);
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

    const effectiveServiceType = requestedServiceTypeKey
      ? offeredServiceTypeByKey.get(requestedServiceTypeKey)
      : (offeredServiceTypes[0] || null);

    const scheduleAvailability = await isScheduleAvailableForRange(connection, {
      serviceProfileId: profile.service_profile_id,
      providerId: profile.provider_id,
      startDate: normalized.normalizedStartDate,
      endDate: normalized.normalizedEndDate,
      startTime: normalized.normalizedStartTime,
      durationMinutes: normalized.normalizedDurationMinutes,
    });

    if (!scheduleAvailability.available) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: scheduleAvailability.message || 'The selected schedule is not available for this provider.',
        code: 'SCHEDULE_UNAVAILABLE',
      });
    }

    const [duplicateRows] = await connection.query(
      `SELECT id
       FROM service_requests
       WHERE client_id = ?
         AND provider_id = ?
         AND service_profile_id = ?
         AND start_date = ?
         AND end_date = ?
         AND start_time = ?
         AND LOWER(job_title) = LOWER(?)
         AND status IN ('pending', 'accepted', 'on_the_way', 'in_progress')
       LIMIT 1`,
      [
        clientId,
        profile.provider_id,
        profile.service_profile_id,
        normalized.normalizedStartDate,
        normalized.normalizedEndDate,
        normalized.normalizedStartTime,
        jobTitle,
      ]
    );

    if (duplicateRows.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: 'A similar booking request already exists for this schedule.'
      });
    }

    const conflict = await checkScheduleConflict(connection, {
      providerId: profile.provider_id,
      requestedStartDate: normalized.normalizedStartDate,
      requestedEndDate: normalized.normalizedEndDate,
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

    const dailyRate = Number(profile.starting_price || 0);
    const estimatedTotal = dailyRate * normalized.durationDays;

    const [result] = await connection.query(
      `INSERT INTO service_requests (
         client_id,
         provider_id,
         service_profile_id,
         service_type_key,
         service_type_label,
         job_title,
         job_details,
         booking_type,
         start_date,
         end_date,
         start_time,
         scheduled_start_at,
         scheduled_end_at,
         estimated_duration_minutes,
         duration_days,
         daily_rate_snapshot,
         estimated_total
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientId,
        profile.provider_id,
        profile.service_profile_id,
        effectiveServiceType?.key || null,
        effectiveServiceType?.label || null,
        jobTitle,
        jobDetails,
        normalized.normalizedBookingType,
        normalized.normalizedStartDate,
        normalized.normalizedEndDate,
        normalized.normalizedStartTime,
        `${normalized.normalizedStartDate} ${normalized.normalizedStartTime}`,
        `${normalized.normalizedEndDate} ${normalized.normalizedStartTime}`,
        normalized.normalizedDurationMinutes,
        normalized.durationDays,
        dailyRate,
        estimatedTotal,
      ]
    );

    const requestId = result.insertId;

    const [clientRows] = await connection.query('SELECT full_name FROM users WHERE id = ? LIMIT 1', [clientId]);
    const clientName = clientRows[0]?.full_name || 'A client';

    await connection.query(
      `INSERT INTO notifications (user_id, type, title, message, related_request_id)
       VALUES (?, 'request_received', ?, ?, ?)`,
      [profile.provider_id, 'New Service Request', `${clientName} has requested your service: ${jobTitle}`, requestId]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Service request created successfully',
      data: {
        requestId,
        serviceTypeKey: effectiveServiceType?.key || null,
        serviceTypeLabel: effectiveServiceType?.label || null,
        bookingType: normalized.normalizedBookingType,
        startDate: normalized.normalizedStartDate,
        endDate: normalized.normalizedEndDate,
        startTime: normalized.normalizedStartTime,
        durationDays: normalized.durationDays,
        dailyRateSnapshot: dailyRate,
        estimatedTotal,
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
              sp.full_name as provider_name, 
              sp.barangay_address as provider_location,
              u.phone as provider_phone,
              (SELECT COUNT(*) FROM reviews rv WHERE rv.service_request_id = sr.id AND rv.client_id = sr.client_id) as has_review
       FROM service_requests sr
       JOIN service_profiles sp ON sr.service_profile_id = sp.id
       JOIN users u ON sr.provider_id = u.id
       WHERE sr.client_id = ?
       ORDER BY sr.created_at DESC`,
      [clientId]
    );

    const processedRequests = requests.map((request) => ({
      ...request,
      provider_phone: request.discussion_accepted ? request.provider_phone : null,
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
              u.full_name as client_name,
              u.email as client_email
       FROM service_requests sr
       JOIN users u ON sr.client_id = u.id
       WHERE sr.provider_id = ?
       ORDER BY sr.created_at DESC`,
      [providerId]
    );

    res.json({
      success: true,
      data: { requests }
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

      await connection.query(
        'SELECT id FROM service_profiles WHERE id = ? AND user_id = ? FOR UPDATE',
        [request.service_profile_id, request.provider_id]
      );

      const schedule = normalizeRequestSchedule(request);
      const conflict = await checkScheduleConflict(connection, {
        providerId: request.provider_id,
        requestedStartDate: schedule.startDate,
        requestedEndDate: schedule.endDate,
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

      const otherUserId = request.client_id === userId ? request.provider_id : request.client_id;
      const actorName = request.client_id === userId ? request.client_name : request.provider_name;
      await connection.query(
        `INSERT INTO notifications (user_id, type, title, message, related_request_id)
         VALUES (?, 'request_cancelled', ?, ?, ?)`,
        [
          otherUserId,
          'Booking Cancelled',
          `${actorName} cancelled the booking "${request.job_title}".`,
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
        await connection.query('UPDATE service_requests SET provider_completed = TRUE WHERE id = ?', [requestId]);
      }

      if (isClientAction) {
        if (request.client_completed) {
          await connection.rollback();
          return res.status(409).json({ success: false, message: 'You have already confirmed completion' });
        }
        await connection.query('UPDATE service_requests SET client_completed = TRUE WHERE id = ?', [requestId]);
      }

      const [updated] = await connection.query('SELECT provider_completed, client_completed FROM service_requests WHERE id = ? FOR UPDATE', [requestId]);
      const bothConfirmed = updated[0].provider_completed && updated[0].client_completed;

      if (bothConfirmed) {
        await connection.query('UPDATE service_requests SET status = ? WHERE id = ?', ['completed', requestId]);

        await connection.query(
          'UPDATE service_profiles SET jobs_completed = jobs_completed + 1 WHERE user_id = ?',
          [request.provider_id]
        );

        await connection.query(
          `INSERT INTO notifications (user_id, type, title, message, related_request_id)
           VALUES (?, 'service_completed', ?, ?, ?)`,
          [request.client_id, 'Service Completed', `Your service request "${request.job_title}" has been completed! You can now leave a review.`, requestId]
        );
        await connection.query(
          `INSERT INTO notifications (user_id, type, title, message, related_request_id)
           VALUES (?, 'service_completed', ?, ?, ?)`,
          [request.provider_id, 'Service Completed', `The service "${request.job_title}" has been marked as completed by both parties.`, requestId]
        );

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
        [otherUserId, 'Completion Pending', `${confirmerName} has confirmed completion for "${request.job_title}". Please confirm on your end.`, requestId]
      );

      await connection.commit();

      return res.json({
        success: true,
        message: 'Completion confirmed! Waiting for the other party to confirm.',
        data: {
          fullyCompleted: false,
          provider_completed: isProviderAction ? true : request.provider_completed,
          client_completed: isClientAction ? true : request.client_completed,
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
    }

    if (status === 'declined') {
      await connection.query(
        'UPDATE service_requests SET status = ?, decline_reason = ? WHERE id = ?',
        [status, trimmedReason, requestId]
      );
    } else {
      await connection.query(
        'UPDATE service_requests SET status = ? WHERE id = ?',
        [status, requestId]
      );
    }

    let notificationType;
    let notificationTitle;
    let notificationMessage;

    switch (status) {
      case 'accepted':
        notificationType = 'request_accepted';
        notificationTitle = 'Request Accepted!';
        notificationMessage = `${request.provider_name} has accepted your service request: ${request.job_title}`;
        break;
      case 'declined':
        notificationType = 'request_declined';
        notificationTitle = 'Request Declined';
        notificationMessage = `${request.provider_name} declined your service request "${request.job_title}".\n\nReason: ${trimmedReason}`;
        break;
      case 'on_the_way':
        notificationType = 'provider_on_way';
        notificationTitle = 'Provider On The Way!';
        notificationMessage = `${request.provider_name} is now on the way for: ${request.job_title}`;
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
    const { proposedStartDate, proposedEndDate, proposedStartTime, reason, estimatedDurationMinutes } = req.body;

    const parsedProposedStart = parseDateOnly(proposedStartDate);
    const parsedProposedEnd = parseDateOnly(proposedEndDate || proposedStartDate);
    const normalizedProposedTime = parseTimeInputToSql(proposedStartTime);
    const normalizedDurationMinutes = Number(estimatedDurationMinutes || 0);

    if (!parsedProposedStart || !parsedProposedEnd || !normalizedProposedTime) {
      return res.status(400).json({ success: false, message: 'Proposed schedule is invalid.' });
    }

    if (parsedProposedEnd < parsedProposedStart) {
      return res.status(400).json({ success: false, message: 'Proposed end date cannot be before start date.' });
    }

    if (!Number.isInteger(normalizedDurationMinutes) || normalizedDurationMinutes <= 0 || normalizedDurationMinutes > MAX_DURATION_MINUTES) {
      return res.status(400).json({ success: false, message: 'Estimated duration must be between 1 and 1440 minutes.' });
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

    const proposedStartDateIso = formatDateOnly(parsedProposedStart);
    const proposedEndDateIso = formatDateOnly(parsedProposedEnd);

    const availability = await isScheduleAvailableForRange(connection, {
      serviceProfileId: request.service_profile_id,
      providerId: request.provider_id,
      startDate: proposedStartDateIso,
      endDate: proposedEndDateIso,
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

    const conflict = await checkScheduleConflict(connection, {
      providerId: request.provider_id,
      requestedStartDate: proposedStartDateIso,
      requestedEndDate: proposedEndDateIso,
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

    await connection.query(
      `INSERT INTO service_request_reschedules (
         service_request_id,
         original_start_date,
         original_end_date,
         original_start_time,
         proposed_start_date,
         proposed_end_date,
         proposed_start_time,
         proposed_estimated_duration_minutes,
         proposed_by,
         reschedule_reason,
         reschedule_status
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        request.id,
        existingSchedule.startDate,
        existingSchedule.endDate,
        existingSchedule.startTime,
        proposedStartDateIso,
        proposedEndDateIso,
        normalizedProposedTime,
        normalizedDurationMinutes,
        actorId,
        trimmedReason,
      ]
    );

    const recipientId = actorId === request.client_id ? request.provider_id : request.client_id;
    const actorName = actorId === request.client_id ? request.client_name : request.provider_name;

    await connection.query(
      `INSERT INTO notifications (user_id, type, title, message, related_request_id)
       VALUES (?, 'reschedule_proposed', ?, ?, ?)`,
      [
        recipientId,
        'Reschedule Proposed',
        `${actorName} proposed a new schedule for "${request.job_title}".`,
        request.id,
      ]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Reschedule proposal sent successfully.',
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
      const availability = await isScheduleAvailableForRange(connection, {
        serviceProfileId: request.service_profile_id,
        providerId: request.provider_id,
        startDate: proposal.proposed_start_date,
        endDate: proposal.proposed_end_date,
        startTime: proposal.proposed_start_time,
        durationMinutes: Number(proposal.proposed_estimated_duration_minutes || request.estimated_duration_minutes || 0),
        excludeRequestId: request.id,
      });

      if (!availability.available) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: availability.message || 'The proposed schedule is no longer within the provider\'s availability.'
        });
      }

      const conflict = await checkScheduleConflict(connection, {
        providerId: request.provider_id,
        requestedStartDate: proposal.proposed_start_date,
        requestedEndDate: proposal.proposed_end_date,
        requestedStartTime: proposal.proposed_start_time,
        requestedDurationMinutes: Number(proposal.proposed_estimated_duration_minutes || request.estimated_duration_minutes || 0),
        excludeRequestId: request.id,
      });

      if (conflict.conflict) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: 'The proposed schedule is no longer available.'
        });
      }

      const durationDays = calculateDurationDays(proposal.proposed_start_date, proposal.proposed_end_date) || 1;
      const dailyRateSnapshot = Number(request.daily_rate_snapshot || 0);
      const estimatedTotal = dailyRateSnapshot * durationDays;
      const proposedStartAt = `${proposal.proposed_start_date} ${proposal.proposed_start_time}`;
      const proposedEndAt = `${proposal.proposed_end_date} ${proposal.proposed_start_time}`;

      await connection.query(
        `UPDATE service_requests
         SET start_date = ?,
             end_date = ?,
             start_time = ?,
             scheduled_start_at = ?,
             scheduled_end_at = ?,
             estimated_duration_minutes = ?,
             duration_days = ?,
             estimated_total = ?
         WHERE id = ?`,
        [
          proposal.proposed_start_date,
          proposal.proposed_end_date,
          proposal.proposed_start_time,
          proposedStartAt,
          proposedEndAt,
          Number(proposal.proposed_estimated_duration_minutes || request.estimated_duration_minutes || 0),
          durationDays,
          estimatedTotal,
          request.id,
        ]
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
        `${responderName} ${action} the reschedule proposal for "${request.job_title}".`,
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

// Request discussion (client requests to discuss details)
exports.requestDiscussion = async (req, res) => {
  try {
    const { requestId } = req.params;
    const clientId = req.user.userId;

    const [requests] = await db.query(
      `SELECT sr.*, u.full_name as client_name, p.full_name as provider_name
       FROM service_requests sr
       JOIN users u ON sr.client_id = u.id
       JOIN users p ON sr.provider_id = p.id
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

    if (!['accepted', 'on_the_way', 'in_progress'].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: 'Discussion can only be requested for accepted requests'
      });
    }

    if (request.discussion_requested) {
      return res.status(400).json({
        success: false,
        message: 'Discussion already requested'
      });
    }

    await db.query(
      'UPDATE service_requests SET discussion_requested = TRUE WHERE id = ?',
      [requestId]
    );

    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, related_request_id)
       VALUES (?, 'discussion_requested', ?, ?, ?)`,
      [request.provider_id, 'Discussion Request', `${request.client_name} wants to discuss details for: ${request.job_title}`, requestId]
    );

    res.json({
      success: true,
      message: 'Discussion request sent successfully'
    });
  } catch (error) {
    console.error('Request discussion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request discussion'
    });
  }
};

// Accept discussion request (provider accepts, revealing their phone)
exports.acceptDiscussion = async (req, res) => {
  try {
    const { requestId } = req.params;
    const providerId = req.user.userId;

    const [requests] = await db.query(
      `SELECT sr.*, u.full_name as provider_name, c.full_name as client_name
       FROM service_requests sr
       JOIN users u ON sr.provider_id = u.id
       JOIN users c ON sr.client_id = c.id
       WHERE sr.id = ? AND sr.provider_id = ?`,
      [requestId, providerId]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    const request = requests[0];

    if (!request.discussion_requested) {
      return res.status(400).json({
        success: false,
        message: 'No discussion request pending'
      });
    }

    const [providerData] = await db.query('SELECT phone FROM users WHERE id = ?', [providerId]);
    const providerPhone = providerData[0]?.phone;

    if (!providerPhone || providerPhone.trim() === '') {
      return res.status(400).json({
        success: false,
        code: 'NO_PHONE',
        message: 'Please set your phone number in Edit Profile before accepting a discussion request.'
      });
    }

    await db.query(
      'UPDATE service_requests SET discussion_accepted = TRUE, provider_phone_revealed = TRUE WHERE id = ?',
      [requestId]
    );

    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, related_request_id)
       VALUES (?, 'discussion_accepted', ?, ?, ?)`,
      [request.client_id, 'Discussion Accepted', `${request.provider_name} accepted your discussion request. You can now contact them at: ${providerPhone}`, requestId]
    );

    res.json({
      success: true,
      message: 'Discussion accepted, phone number revealed to client'
    });
  } catch (error) {
    console.error('Accept discussion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept discussion'
    });
  }
};

// Get single request details
exports.getRequestById = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.userId;

    const [requests] = await db.query(
      `SELECT sr.*, 
              sp.full_name as provider_name,
              sp.barangay_address as provider_location,
              u.phone as provider_phone,
              c.full_name as client_name,
              c.email as client_email
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

    const request = requests[0];

    if (!request.discussion_accepted) {
      request.provider_phone = null;
    }

    const [reschedules] = await db.query(
      `SELECT id, proposed_start_date, proposed_end_date, proposed_start_time, proposed_by, reschedule_reason, reschedule_status, created_at, responded_at
       FROM service_request_reschedules
       WHERE service_request_id = ?
       ORDER BY created_at DESC`,
      [requestId]
    );

    res.json({
      success: true,
      data: { request, reschedules }
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

    if (!rating || rating < 0.5 || rating > 5 || (rating * 2) % 1 !== 0) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 0.5 and 5, in half-star increments'
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
      'SELECT id FROM reviews WHERE service_request_id = ? AND client_id = ?',
      [requestId, clientId]
    );

    if (existingReview.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this service request'
      });
    }

    await db.query(
      `INSERT INTO reviews (service_profile_id, client_id, service_request_id, rating, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [request.profile_id, clientId, requestId, rating, comment || null]
    );

    const [ratingResult] = await db.query(
      `SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews 
       FROM reviews WHERE service_profile_id = ?`,
      [request.profile_id]
    );

    const avgRating = parseFloat(ratingResult[0].avg_rating).toFixed(1);
    const totalReviews = ratingResult[0].total_reviews;

    await db.query(
      'UPDATE service_profiles SET rating = ?, reviews_count = ? WHERE id = ?',
      [avgRating, totalReviews, request.profile_id]
    );

    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, related_request_id)
       VALUES (?, 'review_received', ?, ?, ?)`,
      [request.provider_id, 'New Review', `${request.client_name} left a ${rating}-star review for "${request.job_title}"`, requestId]
    );

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: { avgRating, totalReviews }
    });
  } catch (error) {
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
      `SELECT id, client_id, provider_id, job_title
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

    await db.query(
      `INSERT INTO user_reports
       (request_id, reporter_id, reported_user_id, reason, description, screenshot_data, screenshot_mime, status, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'medium')`,
      [
        requestId,
        reporterId,
        reportedIdNum,
        reason,
        description,
        screenshotFile ? screenshotFile.buffer : null,
        screenshotFile ? (screenshotFile.mimetype || 'application/octet-stream') : null,
      ]
    );

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

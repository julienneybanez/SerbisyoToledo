const db = require('../config/database');

const MAX_JOB_TITLE_LENGTH = 255;
const MAX_JOB_DETAILS_LENGTH = 2000;
const MAX_DECLINE_REASON_LENGTH = 500;

const allowedTransitions = {
  pending: ['accepted', 'declined', 'cancelled'],
  accepted: ['on_the_way', 'cancelled'],
  on_the_way: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  declined: [],
  cancelled: []
};

const parseDateOnly = (dateString) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateString || ''))) {
    return null;
  }

  const [year, month, day] = String(dateString).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

// Create a new service request
exports.createRequest = async (req, res) => {
  let connection;

  try {
    const clientId = req.user.userId;
    const { providerId, serviceProfileId, scheduledDate, scheduledTime } = req.body;
    const jobTitle = String(req.body.jobTitle || '').trim();
    const jobDetails = String(req.body.jobDetails || '').trim();

    if (req.user.userType !== 'client') {
      return res.status(403).json({
        success: false,
        message: 'Only clients can create service requests'
      });
    }

    // Validate required fields
    if (!serviceProfileId || !jobTitle || !jobDetails || !scheduledDate || !scheduledTime) {
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

    const parsedDate = parseDateOnly(scheduledDate);
    if (!parsedDate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid scheduled date'
      });
    }

    const today = new Date();
    const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    if (parsedDate < todayUtc) {
      return res.status(400).json({
        success: false,
        message: 'Schedule date cannot be in the past'
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [profileRows] = await connection.query(
      `SELECT
        sp.id AS service_profile_id,
        sp.user_id AS provider_id,
        sp.is_published,
        u.user_type,
        u.is_active
       FROM service_profiles sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.id = ?
       LIMIT 1`,
      [serviceProfileId]
    );

    if (profileRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Service profile not found'
      });
    }

    const profile = profileRows[0];

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

    // Create the service request
    const [result] = await connection.query(
      `INSERT INTO service_requests (client_id, provider_id, service_profile_id, job_title, job_details, scheduled_date, scheduled_time)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [clientId, profile.provider_id, profile.service_profile_id, jobTitle, jobDetails, scheduledDate, scheduledTime]
    );

    const requestId = result.insertId;

    // Get client name for notification
    const [clientRows] = await connection.query('SELECT full_name FROM users WHERE id = ? LIMIT 1', [clientId]);
    const clientName = clientRows[0]?.full_name || 'A client';

    // Create notification for the service provider
    await connection.query(
      `INSERT INTO notifications (user_id, type, title, message, related_request_id)
       VALUES (?, 'request_received', ?, ?, ?)`,
      [profile.provider_id, 'New Service Request', `${clientName} has requested your service: ${jobTitle}`, requestId]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Service request created successfully',
      data: { requestId }
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

    // Only include phone if discussion is accepted
    const processedRequests = requests.map(req => ({
      ...req,
      provider_phone: req.discussion_accepted ? req.provider_phone : null,
      has_review: req.has_review > 0
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

// Update request status (accept/decline/on_the_way/complete)
exports.updateRequestStatus = async (req, res) => {
  let connection;

  try {
    const { requestId } = req.params;
    const { status, reason } = req.body;
    const userId = req.user.userId;

    // Validate status
    const validStatuses = ['accepted', 'declined', 'on_the_way', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Get participant-bound request to verify ownership and lock row for update
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
    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
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

    // Only provider can update status (except cancelled and completed which have special rules)
    if (status === 'cancelled') {
      if (request.client_id !== userId) {
        await connection.rollback();
        return res.status(403).json({
          success: false,
          message: 'Only the client can cancel the request'
        });
      }
    } else if (status === 'completed') {
      // Both client and provider can mark as completed (two-way confirmation)
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
          message: 'Request can only be completed after it is in progress'
        });
      }

      const isClientAction = request.client_id === userId;
      const isProviderAction = request.provider_id === userId;

      // Update the respective completion flag
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

      // Re-fetch to check if both have now confirmed
      const [updated] = await connection.query('SELECT provider_completed, client_completed FROM service_requests WHERE id = ? FOR UPDATE', [requestId]);
      const bothConfirmed = updated[0].provider_completed && updated[0].client_completed;

      if (bothConfirmed) {
        // Both confirmed — mark as completed
        await connection.query('UPDATE service_requests SET status = ? WHERE id = ?', ['completed', requestId]);

        // Increment jobs_completed for the provider's service profile
        await connection.query(
          'UPDATE service_profiles SET jobs_completed = jobs_completed + 1 WHERE user_id = ?',
          [request.provider_id]
        );

        // Notify both parties
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
      } else {
        // Only one party confirmed so far — notify the other
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
            client_completed: isClientAction ? true : request.client_completed
          }
        });
      }
    } else {
      if (request.provider_id !== userId) {
        await connection.rollback();
        return res.status(403).json({
          success: false,
          message: 'Only the service provider can update this request'
        });
      }
    }

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

    // Update the status (and decline reason where applicable)
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

    // Create notification for the client based on status
    let notificationType, notificationTitle, notificationMessage;

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
      case 'completed':
        // Handled by two-way confirmation above, should not reach here
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

// Request discussion (client requests to discuss details)
exports.requestDiscussion = async (req, res) => {
  try {
    const { requestId } = req.params;
    const clientId = req.user.userId;

    // Verify the request belongs to this client and is accepted
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

    if (request.status !== 'accepted' && request.status !== 'on_the_way' && request.status !== 'in_progress') {
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

    // Update the request
    await db.query(
      'UPDATE service_requests SET discussion_requested = TRUE WHERE id = ?',
      [requestId]
    );

    // Notify the provider
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

    // Verify the request and ownership
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

    // Get provider phone first — block if not set
    const [providerData] = await db.query('SELECT phone FROM users WHERE id = ?', [providerId]);
    const providerPhone = providerData[0]?.phone;

    if (!providerPhone || providerPhone.trim() === '') {
      return res.status(400).json({
        success: false,
        code: 'NO_PHONE',
        message: 'Please set your phone number in Edit Profile before accepting a discussion request.'
      });
    }

    // Update the request
    await db.query(
      'UPDATE service_requests SET discussion_accepted = TRUE, provider_phone_revealed = TRUE WHERE id = ?',
      [requestId]
    );

    // Notify the client that discussion was accepted and phone is revealed
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
       WHERE sr.id = ? AND (sr.client_id = ? OR sr.provider_id = ?)`,
      [requestId, userId, userId]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    const request = requests[0];
    
    // Only include phone if discussion is accepted
    if (!request.discussion_accepted) {
      request.provider_phone = null;
    }

    res.json({
      success: true,
      data: { request }
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

    // Validate rating (0.5 to 5 in steps of 0.5)
    if (!rating || rating < 0.5 || rating > 5 || (rating * 2) % 1 !== 0) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 0.5 and 5, in half-star increments'
      });
    }

    // Get the request and verify ownership + completion
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

    // Check if a review already exists for this request
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

    // Create the review
    await db.query(
      `INSERT INTO reviews (service_profile_id, client_id, service_request_id, rating, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [request.profile_id, clientId, requestId, rating, comment || null]
    );

    // Update the service profile's average rating and review count
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

    // Notify the provider about the new review
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

    // Verify this request is a valid interaction between reporter and reported user
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

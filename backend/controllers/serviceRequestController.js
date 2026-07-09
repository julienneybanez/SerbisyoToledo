const db = require('../config/database');

// Create a new service request
exports.createRequest = async (req, res) => {
  try {
    const clientId = req.user.userId;
    const { providerId, serviceProfileId, jobTitle, jobDetails, scheduledDate, scheduledTime } = req.body;

    console.log('Create request received:', { clientId, providerId, serviceProfileId, jobTitle, scheduledDate, scheduledTime });

    // Validate required fields
    if (!providerId || !serviceProfileId || !jobTitle || !jobDetails || !scheduledDate || !scheduledTime) {
      console.log('Validation failed - missing fields:', { providerId, serviceProfileId, jobTitle, jobDetails: !!jobDetails, scheduledDate, scheduledTime });
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Create the service request
    const [result] = await db.query(
      `INSERT INTO service_requests (client_id, provider_id, service_profile_id, job_title, job_details, scheduled_date, scheduled_time)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [clientId, providerId, serviceProfileId, jobTitle, jobDetails, scheduledDate, scheduledTime]
    );

    const requestId = result.insertId;

    // Get client name for notification
    const [clientRows] = await db.query('SELECT full_name FROM users WHERE id = ?', [clientId]);
    const clientName = clientRows[0]?.full_name || 'A client';

    // Create notification for the service provider
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, related_request_id)
       VALUES (?, 'request_received', ?, ?, ?)`,
      [providerId, 'New Service Request', `${clientName} has requested your service: ${jobTitle}`, requestId]
    );

    res.status(201).json({
      success: true,
      message: 'Service request created successfully',
      data: { requestId }
    });
  } catch (error) {
    console.error('Create request error:', error);
    console.error('Error details:', error.message, error.code, error.sqlMessage);
    res.status(500).json({
      success: false,
      message: 'Failed to create service request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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
  try {
    const { requestId } = req.params;
    const { status } = req.body;
    const userId = req.user.userId;

    // Validate status
    const validStatuses = ['accepted', 'declined', 'on_the_way', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    // Get the request to verify ownership and get client info
    const [requests] = await db.query(
      `SELECT sr.*, u.full_name as provider_name, c.full_name as client_name
       FROM service_requests sr
       JOIN users u ON sr.provider_id = u.id
       JOIN users c ON sr.client_id = c.id
       WHERE sr.id = ?`,
      [requestId]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    const request = requests[0];

    // Only provider can update status (except cancelled and completed which have special rules)
    if (status === 'cancelled') {
      if (request.client_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Only the client can cancel the request'
        });
      }
    } else if (status === 'completed') {
      // Both client and provider can mark as completed (two-way confirmation)
      if (request.client_id !== userId && request.provider_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Only the client or provider can mark this request as completed'
        });
      }

      const isClientAction = request.client_id === userId;
      const isProviderAction = request.provider_id === userId;

      // Update the respective completion flag
      if (isProviderAction) {
        if (request.provider_completed) {
          return res.status(400).json({ success: false, message: 'You have already confirmed completion' });
        }
        await db.query('UPDATE service_requests SET provider_completed = TRUE WHERE id = ?', [requestId]);
      }
      if (isClientAction) {
        if (request.client_completed) {
          return res.status(400).json({ success: false, message: 'You have already confirmed completion' });
        }
        await db.query('UPDATE service_requests SET client_completed = TRUE WHERE id = ?', [requestId]);
      }

      // Re-fetch to check if both have now confirmed
      const [updated] = await db.query('SELECT provider_completed, client_completed FROM service_requests WHERE id = ?', [requestId]);
      const bothConfirmed = updated[0].provider_completed && updated[0].client_completed;

      if (bothConfirmed) {
        // Both confirmed — mark as completed
        await db.query('UPDATE service_requests SET status = ? WHERE id = ?', ['completed', requestId]);

        // Increment jobs_completed for the provider's service profile
        await db.query(
          'UPDATE service_profiles SET jobs_completed = jobs_completed + 1 WHERE user_id = ?',
          [request.provider_id]
        );

        // Notify both parties
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, related_request_id)
           VALUES (?, 'service_completed', ?, ?, ?)`,
          [request.client_id, 'Service Completed', `Your service request "${request.job_title}" has been completed! You can now leave a review.`, requestId]
        );
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, related_request_id)
           VALUES (?, 'service_completed', ?, ?, ?)`,
          [request.provider_id, 'Service Completed', `The service "${request.job_title}" has been marked as completed by both parties.`, requestId]
        );

        return res.json({
          success: true,
          message: 'Both parties confirmed — service marked as completed!',
          data: { fullyCompleted: true }
        });
      } else {
        // Only one party confirmed so far — notify the other
        const otherUserId = isProviderAction ? request.client_id : request.provider_id;
        const confirmerName = isProviderAction ? request.provider_name : request.client_name;
        
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, related_request_id)
           VALUES (?, 'completion_confirmed', ?, ?, ?)`,
          [otherUserId, 'Completion Pending', `${confirmerName} has confirmed completion for "${request.job_title}". Please confirm on your end.`, requestId]
        );

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
        return res.status(403).json({
          success: false,
          message: 'Only the service provider can update this request'
        });
      }
    }

    // Update the status
    await db.query(
      'UPDATE service_requests SET status = ? WHERE id = ?',
      [status, requestId]
    );

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
        notificationMessage = `${request.provider_name} has declined your service request: ${request.job_title}`;
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
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, related_request_id)
         VALUES (?, ?, ?, ?, ?)`,
        [request.client_id, notificationType, notificationTitle, notificationMessage, requestId]
      );
    }

    res.json({
      success: true,
      message: `Request ${status} successfully`
    });
  } catch (error) {
    console.error('Update request status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update request status'
    });
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
       WHERE id = ?`,
      [requestId]
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

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getUser, serviceProfileAPI, serviceRequestAPI } from '../services/api';
import RequestDetailsModal from '../components/common/RequestDetailsModal';
import ReviewModal from '../components/common/ReviewModal';
import ReportUserModal from '../components/common/ReportUserModal';
import NextStepHelp from '../components/common/NextStepHelp';
import { BOOKING_TYPE, REQUEST_STATUS, SPECIFIC_DATE_BOOKING_ENABLED } from '../constants/domain';
import { useLanguage } from '../context/LanguageContext';
import './Requests.css';

const getHiddenRequestsStorageKey = (user) => {
  if (!user?.id || !user?.userType) {
    return null;
  }

  return `hiddenRequests_${user.id}_${user.userType}`;
};

const getHiddenRequestIds = (user) => {
  const key = getHiddenRequestsStorageKey(user);
  if (!key) {
    return [];
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id));
  } catch {
    return [];
  }
};

const saveHiddenRequestIds = (user, ids) => {
  const key = getHiddenRequestsStorageKey(user);
  if (!key) {
    return;
  }

  localStorage.setItem(key, JSON.stringify(ids));
};

const addDaysIso = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const getContiguousDatesFrom = (availableDates, startDate) => {
  if (!startDate) return [];
  const sorted = Array.from(new Set(availableDates || [])).sort();
  const startIndex = sorted.indexOf(startDate);
  if (startIndex < 0) return [];

  const result = [startDate];
  let previous = new Date(`${startDate}T00:00:00`);

  for (let index = startIndex + 1; index < sorted.length; index += 1) {
    const current = new Date(`${sorted[index]}T00:00:00`);
    const diffDays = Math.round((current.getTime() - previous.getTime()) / 86400000);
    if (diffDays !== 1) break;
    result.push(sorted[index]);
    previous = current;
  }

  return result;
};

const getDateRangeIso = (startDate, endDate) => {
  if (!startDate || !endDate) return [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const dates = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
};

const CANCELLATION_REASONS = {
  SCHEDULE_CONFLICT: 'Schedule conflict',
  NO_LONGER_NEEDED: 'No longer need the service',
  PROVIDER_UNAVAILABLE: 'Provider unavailable',
  CLIENT_UNAVAILABLE: 'Client unavailable',
  INCORRECT_BOOKING: 'Incorrect booking information',
  PROVIDER_NO_RESPONSE: 'Provider did not respond',
  FOUND_ANOTHER_PROVIDER: 'Found another provider',
  OTHER: 'Other',
};

export default function Requests() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = getUser();
  const isProvider = user?.userType === 'tradesperson';
  
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewRequest, setReviewRequest] = useState(null);
  const [reportRequest, setReportRequest] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [declineDialog, setDeclineDialog] = useState({
    open: false,
    requestId: null,
    reason: '',
    error: '',
  });
  const [cancelDialog, setCancelDialog] = useState({
    open: false,
    requestId: null,
    cancellationReason: CANCELLATION_REASONS.SCHEDULE_CONFLICT,
    cancellationReasonOther: '',
    error: '',
  });
  const [rescheduleDialog, setRescheduleDialog] = useState({
    open: false,
    requestId: null,
    proposedStartDate: '',
    proposedEndDate: '',
    proposedStartTime: '',
    estimatedDurationMinutes: 60,
    serviceProfileId: null,
    bookingType: BOOKING_TYPE.ONE_DAY,
    proposedDates: [],
    availableDates: [],
    availableSlots: [],
    availabilityLoading: false,
    reason: '',
    error: '',
  });

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = isProvider
        ? await serviceRequestAPI.getProviderRequests()
        : await serviceRequestAPI.getClientRequests();
      
      if (response.success) {
        const hiddenIds = new Set(getHiddenRequestIds({ id: user?.id, userType: user?.userType }));
        const visibleRequests = (response.data.requests || []).filter((req) => !hiddenIds.has(Number(req.id)));
        setRequests(visibleRequests);
      }
    } catch (err) {
      setError(t('requestsLoadFailed'));
      console.error('Fetch requests error:', err);
    } finally {
      setLoading(false);
    }
  }, [isProvider, t, user?.id, user?.userType]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleStatusUpdate = async (requestId, status, reason = null, options = {}) => {
    const { suppressAlert = false, cancellation = null } = options;
    setActionLoading(requestId);
    try {
      const response = await serviceRequestAPI.updateStatus(requestId, status, reason, cancellation);
      if (response.success) {
        if (status === REQUEST_STATUS.COMPLETED && response.data) {
          // Two-way completion
          if (response.data.fullyCompleted) {
            // Both confirmed — mark as completed
            setRequests(prev =>
              prev.map(req =>
                req.id === requestId ? { ...req, status: REQUEST_STATUS.COMPLETED, provider_completed: true, client_completed: true } : req
              )
            );
            if (selectedRequest?.id === requestId) {
              setSelectedRequest(prev => ({ ...prev, status: REQUEST_STATUS.COMPLETED, provider_completed: true, client_completed: true }));
            }
            if (!suppressAlert) {
              alert(t('requestsServiceCompletedBoth'));
            }
          } else {
            // Only one side confirmed
            setRequests(prev =>
              prev.map(req =>
                req.id === requestId 
                  ? { ...req, 
                      provider_completed: response.data.provider_completed, 
                      client_completed: response.data.client_completed 
                    } 
                  : req
              )
            );
            if (selectedRequest?.id === requestId) {
              setSelectedRequest(prev => ({ 
                ...prev, 
                provider_completed: response.data.provider_completed, 
                client_completed: response.data.client_completed 
              }));
            }
            if (!suppressAlert) {
              alert(t('requestsCompletionConfirmedWaiting'));
            }
          }
        } else {
          // Normal status update
          setRequests(prev =>
            prev.map(req =>
              req.id === requestId ? { ...req, status, ...(status === REQUEST_STATUS.DECLINED ? { decline_reason: reason?.trim() || null } : {}) } : req
            )
          );
          if (selectedRequest?.id === requestId) {
            setSelectedRequest(prev => ({ ...prev, status, ...(status === REQUEST_STATUS.DECLINED ? { decline_reason: reason?.trim() || null } : {}) }));
          }
        }

        if (status === REQUEST_STATUS.CANCELLED && cancellation) {
          setRequests(prev =>
            prev.map(req =>
              req.id === requestId
                ? {
                    ...req,
                    status,
                    cancellation_reason: cancellation.cancellationReason,
                    cancellation_reason_other: cancellation.cancellationReasonOther || null,
                  }
                : req
            )
          );
          if (selectedRequest?.id === requestId) {
            setSelectedRequest(prev => prev ? {
              ...prev,
              status,
              cancellation_reason: cancellation.cancellationReason,
              cancellation_reason_other: cancellation.cancellationReasonOther || null,
            } : null);
          }
        }
        return { success: true };
      }
    } catch (err) {
      console.error('Status update error:', err);
      if (!suppressAlert) {
        alert(err.message || t('requestsStatusUpdateFailed'));
      }
      return { success: false, message: err.message || t('requestsStatusUpdateFailed') };
    } finally {
      setActionLoading(null);
    }

    return { success: false, message: t('requestsStatusUpdateFailed') };
  };

  const openCancelDialog = (requestId) => {
    setCancelDialog({
      open: true,
      requestId,
      cancellationReason: CANCELLATION_REASONS.SCHEDULE_CONFLICT,
      cancellationReasonOther: '',
      error: '',
    });
  };

  const closeCancelDialog = () => {
    setCancelDialog({
      open: false,
      requestId: null,
      cancellationReason: CANCELLATION_REASONS.SCHEDULE_CONFLICT,
      cancellationReasonOther: '',
      error: '',
    });
  };

  const handleConfirmCancellation = async () => {
    if (cancelDialog.cancellationReason === CANCELLATION_REASONS.OTHER && !cancelDialog.cancellationReasonOther.trim()) {
      setCancelDialog((prev) => ({
        ...prev,
        error: t('requestsCancellationDetailsRequired'),
      }));
      return;
    }

    const result = await handleStatusUpdate(cancelDialog.requestId, REQUEST_STATUS.CANCELLED, null, {
      suppressAlert: true,
      cancellation: {
        cancellationReason: cancelDialog.cancellationReason,
        cancellationReasonOther: cancelDialog.cancellationReasonOther.trim() || null,
      },
    });

    if (result?.success) {
      closeCancelDialog();
      return;
    }

    setCancelDialog((prev) => ({
      ...prev,
      error: result?.message || t('requestsCancelFailed'),
    }));
  };

  const openRescheduleDialog = async (request) => {
    const currentStartDate = String(request.start_date || request.scheduled_date || '').slice(0, 10);
    const currentEndDate = String(request.end_date || request.scheduled_date || currentStartDate).slice(0, 10);
    const currentBookingDates = Array.isArray(request.booking_dates) && request.booking_dates.length > 0
      ? request.booking_dates.map((value) => String(value).slice(0, 10)).filter(Boolean)
      : getDateRangeIso(currentStartDate, currentEndDate);
    const startTime = request.start_time || request.scheduled_time || '09:00';
    const sqlTime = String(startTime).slice(0, 5);
    const serviceProfileId = Number(request.service_profile_id || request.serviceProfileId || 0);
    const duration = Number(request.estimated_duration_minutes || 60);
    const bookingType = request.booking_mode === BOOKING_TYPE.SPECIFIC_DATES
      || request.multi_day_mode === 'specific_dates'
      ? BOOKING_TYPE.SPECIFIC_DATES
      : request.booking_type === 'multi_day'
        ? BOOKING_TYPE.DATE_RANGE
        : BOOKING_TYPE.ONE_DAY;

    setRescheduleDialog({
      open: true,
      requestId: request.id,
      proposedStartDate: currentStartDate,
      proposedEndDate: currentEndDate,
      proposedStartTime: sqlTime,
      estimatedDurationMinutes: duration,
      serviceProfileId,
      bookingType,
      proposedDates: currentBookingDates,
      availableDates: [],
      availableSlots: [],
      availabilityLoading: true,
      reason: '',
      error: '',
    });

    if (!serviceProfileId) {
      setRescheduleDialog((prev) => ({
        ...prev,
        availabilityLoading: false,
        error: t('requestsProviderScheduleUnavailable'),
      }));
      return;
    }

    try {
      const response = await serviceProfileAPI.getAvailableDates(serviceProfileId, {
        fromDate: addDaysIso(0),
        toDate: addDaysIso(60),
        duration,
        excludeRequestId: request.id,
      });
      const dates = Array.isArray(response.data?.dates) ? response.data.dates : [];
      const retainedSpecificDates = currentBookingDates.filter((date) => dates.includes(date));
      const nextStart = dates.includes(currentStartDate) ? currentStartDate : (dates[0] || '');
      const contiguous = getContiguousDatesFrom(dates, nextStart);
      const nextEnd = bookingType === BOOKING_TYPE.DATE_RANGE && contiguous.includes(currentEndDate)
        ? currentEndDate
        : nextStart;
      const nextDates = bookingType === BOOKING_TYPE.SPECIFIC_DATES
        ? retainedSpecificDates
        : (bookingType === BOOKING_TYPE.DATE_RANGE
          ? getDateRangeIso(nextStart, nextEnd)
          : (nextStart ? [nextStart] : []));

      setRescheduleDialog((prev) => ({
        ...prev,
        proposedStartDate: nextDates[0] || nextStart,
        proposedEndDate: nextDates[nextDates.length - 1] || nextEnd,
        proposedDates: nextDates,
        availableDates: dates,
        availabilityLoading: false,
        error: dates.length === 0 ? t('requestsNoProviderDates') : '',
      }));
    } catch (error) {
      setRescheduleDialog((prev) => ({
        ...prev,
        availabilityLoading: false,
        error: error.message || t('requestsLoadProviderDatesFailed'),
      }));
    }
  };

  const closeRescheduleDialog = () => {
    setRescheduleDialog({
      open: false,
      requestId: null,
      proposedStartDate: '',
      proposedEndDate: '',
      proposedStartTime: '',
      estimatedDurationMinutes: 60,
      serviceProfileId: null,
      bookingType: BOOKING_TYPE.ONE_DAY,
      proposedDates: [],
      availableDates: [],
      availableSlots: [],
      availabilityLoading: false,
      reason: '',
      error: '',
    });
  };

  const refreshSelectedRequest = useCallback(async (requestId) => {
    try {
      setDetailsLoading(true);
      const response = await serviceRequestAPI.getRequestById(requestId);
      if (response.success && response.data?.request) {
        setSelectedRequest({
          ...response.data.request,
          reschedules: response.data.reschedules || [],
        });
      }
    } catch (err) {
      console.error('Failed to refresh request details:', err);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const handleViewDetails = useCallback(async (request) => {
    setSelectedRequest({ ...request, reschedules: [] });
    await refreshSelectedRequest(request.id);
  }, [refreshSelectedRequest]);

  const handleCloseDetails = useCallback(() => {
    if (searchParams.has('request')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('request');
      setSearchParams(nextParams, { replace: true });
    }

    setSelectedRequest(null);
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const rawRequestId = searchParams.get('request');
    if (!rawRequestId) return;

    const focusRequestId = Number(rawRequestId);
    if (!Number.isFinite(focusRequestId) || requests.length === 0) {
      return;
    }

    const targetRequest = requests.find((entry) => Number(entry.id) === focusRequestId);
    if (!targetRequest) {
      return;
    }

    if (!selectedRequest || Number(selectedRequest.id) !== focusRequestId) {
      void handleViewDetails(targetRequest);
    }
  }, [handleViewDetails, requests, searchParams, selectedRequest]);

  useEffect(() => {
    const loadRescheduleSlots = async () => {
      if (
        !rescheduleDialog.open
        || !rescheduleDialog.serviceProfileId
        || rescheduleDialog.availableDates.length === 0
      ) {
        return;
      }

      let selectedDates = [];
      if (rescheduleDialog.bookingType === BOOKING_TYPE.SPECIFIC_DATES) {
        selectedDates = Array.from(new Set(rescheduleDialog.proposedDates || [])).sort();
      } else if (rescheduleDialog.bookingType === BOOKING_TYPE.DATE_RANGE) {
        selectedDates = getDateRangeIso(
          rescheduleDialog.proposedStartDate,
          rescheduleDialog.proposedEndDate
        );
        const availableSet = new Set(rescheduleDialog.availableDates);
        if (selectedDates.length === 0 || selectedDates.some((date) => !availableSet.has(date))) {
          setRescheduleDialog((prev) => ({
            ...prev,
            availableSlots: [],
            proposedStartTime: '',
            error: t('bookingRangeUnavailable'),
          }));
          return;
        }
      } else if (rescheduleDialog.proposedStartDate) {
        selectedDates = [rescheduleDialog.proposedStartDate];
      }

      if (selectedDates.length === 0) {
        setRescheduleDialog((prev) => ({
          ...prev,
          availableSlots: [],
          proposedStartTime: '',
        }));
        return;
      }

      setRescheduleDialog((prev) => ({ ...prev, availabilityLoading: true, error: '' }));

      try {
        const response = await serviceProfileAPI.getAvailableSlots(rescheduleDialog.serviceProfileId, {
          date: selectedDates[0],
          endDate: selectedDates[selectedDates.length - 1],
          dates: rescheduleDialog.bookingType === BOOKING_TYPE.SPECIFIC_DATES ? selectedDates : [],
          bookingType: rescheduleDialog.bookingType,
          duration: Number(rescheduleDialog.estimatedDurationMinutes || 0),
          excludeRequestId: rescheduleDialog.requestId,
        });

        const slots = Array.isArray(response.data?.slots) ? response.data.slots : [];
        setRescheduleDialog((prev) => ({
          ...prev,
          availableSlots: slots,
          proposedStartTime: slots.some((slot) => String(slot.time).slice(0, 5) === String(prev.proposedStartTime).slice(0, 5))
            ? prev.proposedStartTime
            : '',
          availabilityLoading: false,
          error: slots.length === 0 ? t('requestsNoCommonProviderTime') : '',
        }));
      } catch (error) {
        setRescheduleDialog((prev) => ({
          ...prev,
          availableSlots: [],
          proposedStartTime: '',
          availabilityLoading: false,
          error: error.message || t('requestsLoadProviderTimesFailed'),
        }));
      }
    };

    void loadRescheduleSlots();
  }, [
    rescheduleDialog.open,
    rescheduleDialog.requestId,
    rescheduleDialog.serviceProfileId,
    rescheduleDialog.proposedStartDate,
    rescheduleDialog.proposedEndDate,
    rescheduleDialog.proposedDates,
    rescheduleDialog.estimatedDurationMinutes,
    rescheduleDialog.bookingType,
    rescheduleDialog.availableDates,
    t,
  ]);

  const handleRescheduleBookingTypeChange = (nextType) => {
    setRescheduleDialog((prev) => {
      const firstAvailable = prev.proposedStartDate || prev.proposedDates?.[0] || prev.availableDates[0] || '';
      const nextDates = nextType === BOOKING_TYPE.SPECIFIC_DATES
        ? (firstAvailable ? [firstAvailable] : [])
        : (firstAvailable ? [firstAvailable] : []);

      return {
        ...prev,
        bookingType: nextType,
        proposedStartDate: firstAvailable,
        proposedEndDate: firstAvailable,
        proposedDates: nextDates,
        proposedStartTime: '',
        availableSlots: [],
        error: '',
      };
    });
  };

  const toggleRescheduleSpecificDate = (date) => {
    setRescheduleDialog((prev) => {
      const nextSet = new Set(prev.proposedDates || []);
      if (nextSet.has(date)) nextSet.delete(date);
      else nextSet.add(date);
      const nextDates = Array.from(nextSet).sort();

      return {
        ...prev,
        proposedDates: nextDates,
        proposedStartDate: nextDates[0] || '',
        proposedEndDate: nextDates[nextDates.length - 1] || '',
        proposedStartTime: '',
        availableSlots: [],
        error: '',
      };
    });
  };

  const handleSubmitReschedule = async () => {
    const trimmedReason = rescheduleDialog.reason.trim();
    if (!trimmedReason) {
      setRescheduleDialog((prev) => ({ ...prev, error: t('requestsRescheduleReasonRequired') }));
      return;
    }

    try {
      setActionLoading(rescheduleDialog.requestId);
      const proposedDates = rescheduleDialog.bookingType === BOOKING_TYPE.SPECIFIC_DATES
        ? Array.from(new Set(rescheduleDialog.proposedDates || [])).sort()
        : rescheduleDialog.bookingType === BOOKING_TYPE.DATE_RANGE
          ? getDateRangeIso(rescheduleDialog.proposedStartDate, rescheduleDialog.proposedEndDate)
          : (rescheduleDialog.proposedStartDate ? [rescheduleDialog.proposedStartDate] : []);

      if (proposedDates.length === 0 || !rescheduleDialog.proposedStartTime) {
        setRescheduleDialog((prev) => ({ ...prev, error: t('requestsProviderScheduleUnavailable') }));
        return;
      }

      await serviceRequestAPI.proposeReschedule(rescheduleDialog.requestId, {
        bookingType: rescheduleDialog.bookingType,
        proposedDates,
        proposedStartDate: proposedDates[0],
        proposedEndDate: proposedDates[proposedDates.length - 1],
        proposedStartTime: rescheduleDialog.proposedStartTime,
        estimatedDurationMinutes: Number(rescheduleDialog.estimatedDurationMinutes || 0),
        reason: trimmedReason,
      });

      closeRescheduleDialog();
      await fetchRequests();
      await refreshSelectedRequest(rescheduleDialog.requestId);
    } catch (err) {
      setRescheduleDialog((prev) => ({ ...prev, error: err.message || t('requestsRescheduleProposalFailed') }));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRespondReschedule = async (requestId, rescheduleId, action) => {
    try {
      setActionLoading(requestId);
      await serviceRequestAPI.respondReschedule(requestId, rescheduleId, action);
      await fetchRequests();
      await refreshSelectedRequest(requestId);
    } catch (err) {
      alert(err.message || t('requestsRescheduleResponseFailed'));
    } finally {
      setActionLoading(null);
    }
  };

  const openDeclineDialog = (requestId) => {
    setDeclineDialog({
      open: true,
      requestId,
      reason: '',
      error: '',
    });
  };

  const closeDeclineDialog = () => {
    setDeclineDialog({
      open: false,
      requestId: null,
      reason: '',
      error: '',
    });
  };

  const handleConfirmDecline = async () => {
    const trimmedReason = declineDialog.reason.trim();
    if (!trimmedReason) {
      setDeclineDialog((prev) => ({
        ...prev,
        error: t('requestsDeclineReasonRequired'),
      }));
      return;
    }

    const result = await handleStatusUpdate(declineDialog.requestId, REQUEST_STATUS.DECLINED, trimmedReason, { suppressAlert: true });
    if (result?.success) {
      closeDeclineDialog();
      return;
    }

    setDeclineDialog((prev) => ({
      ...prev,
      error: result?.message || t('requestsDeclineFailed'),
    }));
  };

  const handleRequestDiscussion = async (requestId) => {
    setActionLoading(requestId);
    try {
      const response = await serviceRequestAPI.requestDiscussion(requestId);
      if (response.success) {
        setRequests(prev =>
          prev.map(req =>
            req.id === requestId ? { ...req, discussion_requested: true } : req
          )
        );
        alert(t('requestsDiscussionRequestedSuccess'));
      }
    } catch (err) {
      console.error('Request discussion error:', err);
      alert(err.message || t('requestsDiscussionRequestFailed'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptDiscussion = async (requestId) => {
    setActionLoading(requestId);
    try {
      const response = await serviceRequestAPI.acceptDiscussion(requestId);
      if (response.success) {
        setRequests(prev =>
          prev.map(req =>
            req.id === requestId 
              ? { ...req, discussion_accepted: true, provider_phone_revealed: true } 
              : req
          )
        );
        alert(t('requestsDiscussionAcceptedSuccess'));
      }
    } catch (err) {
      console.error('Accept discussion error:', err);
      if (err.code === 'NO_PHONE') {
        alert(t('requestsNoPhoneWarning'));
      } else {
        alert(err.message || t('requestsDiscussionAcceptFailed'));
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleHideRequest = (requestId) => {
    const shouldHide = window.confirm(t('requestsHideConfirm'));
    if (!shouldHide) {
      return;
    }

    const numericRequestId = Number(requestId);
    const currentIds = getHiddenRequestIds(user);
    const nextIds = Array.from(new Set([...currentIds, numericRequestId]));
    saveHiddenRequestIds(user, nextIds);

    setRequests((prev) => prev.filter((req) => Number(req.id) !== numericRequestId));
    setSelectedRequest((prev) => (prev && Number(prev.id) === numericRequestId ? null : prev));
  };

  const handleSubmitReview = async ({ rating, comment }) => {
    if (!reviewRequest) return;
    setReviewLoading(true);
    try {
      const response = await serviceRequestAPI.createReview(reviewRequest.id, { rating, comment });
      if (response.success) {
        setRequests(prev =>
          prev.map(req =>
            req.id === reviewRequest.id ? { ...req, has_review: true } : req
          )
        );
        if (selectedRequest?.id === reviewRequest.id) {
          setSelectedRequest(prev => prev ? { ...prev, has_review: true } : null);
        }
        setReviewRequest(null);
        alert(t('requestsReviewSubmittedSuccess'));
      }
    } catch (err) {
      console.error('Submit review error:', err);
      alert(err.message || t('requestsReviewSubmitFailed'));
    } finally {
      setReviewLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    const statusClasses = {
      pending: 'badge-pending',
      accepted: 'badge-accepted',
      declined: 'badge-declined',
      on_the_way: 'badge-on-way',
      in_progress: 'badge-in-progress',
      completed: 'badge-completed',
      cancelled: 'badge-cancelled',
    };
    return statusClasses[status] || 'badge-pending';
  };

  const formatStatus = (status) => {
    const statusLabelMap = {
      pending: t('statusPending'),
      accepted: t('statusAccepted'),
      declined: t('statusDeclined'),
      on_the_way: t('statusOnTheWay'),
      in_progress: t('statusInProgress'),
      completed: t('statusCompleted'),
      cancelled: t('statusCancelled'),
    };

    return statusLabelMap[status] || status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatBookingDates = (request) => {
    const dates = Array.isArray(request.booking_dates)
      ? request.booking_dates.filter(Boolean)
      : [];

    if (dates.length === 0) {
      return formatDate(request.start_date || request.scheduled_date);
    }

    if (request.booking_mode === 'specific_dates') {
      return dates.map((date) => formatDate(date)).join(' • ');
    }

    if (dates.length > 1) {
      return `${formatDate(dates[0])} – ${formatDate(dates[dates.length - 1])}`;
    }

    return formatDate(dates[0]);
  };

  const filteredRequests = requests.filter(req => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'active') 
      return [REQUEST_STATUS.PENDING, REQUEST_STATUS.ACCEPTED, REQUEST_STATUS.ON_THE_WAY, REQUEST_STATUS.IN_PROGRESS].includes(req.status);
    if (activeFilter === REQUEST_STATUS.COMPLETED) return req.status === REQUEST_STATUS.COMPLETED;
    if (activeFilter === REQUEST_STATUS.CANCELLED) return [REQUEST_STATUS.DECLINED, REQUEST_STATUS.CANCELLED].includes(req.status);
    return true;
  });

  const pendingRequests = requests.filter((request) => request.status === REQUEST_STATUS.PENDING);
  const activeRequests = requests.filter((request) => (
    [REQUEST_STATUS.ACCEPTED, REQUEST_STATUS.ON_THE_WAY, REQUEST_STATUS.IN_PROGRESS].includes(request.status)
  ));

  const showAllRequests = () => {
    setActiveFilter('all');
    window.setTimeout(() => {
      document.querySelector('.requests-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const requestsHelpGuidance = (() => {
    if (isProvider) {
      if (pendingRequests.length > 0) {
        return {
          title: pendingRequests.length === 1 ? '1 request needs your response' : `${pendingRequests.length} requests need your response`,
          description: 'Review the request details first, then accept or decline based on your availability.',
          steps: [
            'Open the request details and check the service, schedule, and client information.',
            'Accept the request if you can take the job, or decline it with a clear reason.',
            'After accepting, keep the job status updated as the service progresses.',
          ],
          actionLabel: 'Review requests',
          onAction: showAllRequests,
          targetSelector: '.requests-grid',
        };
      }

      if (activeRequests.length > 0) {
        return {
          title: 'Check your active jobs',
          description: 'Your current requests are already accepted or in progress. Review their schedules and update the job status when needed.',
          steps: [
            'Open View Details to confirm the schedule and service information.',
            'Use the available status action when you are on the way or the service is complete.',
          ],
          actionLabel: 'View active jobs',
          onAction: showAllRequests,
          targetSelector: '.requests-grid',
        };
      }

      return {
        title: 'No requests need action right now',
        description: 'Keep your service listing and schedule up to date so clients can send suitable booking requests.',
        steps: [
          'Check your Dashboard for profile setup or upcoming work.',
          'Update your Schedule whenever your availability changes.',
        ],
        actionLabel: 'Go to Dashboard',
        actionTo: '/dashboard',
      };
    }

    if (requests.length === 0) {
      return {
        title: 'Start your first booking',
        description: 'Browse local providers, compare their profiles, then send a service request.',
        steps: [
          'Find the service you need in Browse Services.',
          'Open a provider profile and check their rate, location, availability, and reviews.',
          'Choose Request Service and submit your preferred schedule.',
        ],
        actionLabel: 'Browse Services',
        actionTo: '/feed',
      };
    }

    if (activeRequests.length > 0) {
      return {
        title: 'Check your active booking',
        description: 'Open the booking details to review the latest status, schedule, and available actions.',
        steps: [
          'Use View Details for the complete booking information.',
          'Check the status before proposing a schedule change or confirming completion.',
        ],
        actionLabel: 'View bookings',
        onAction: showAllRequests,
        targetSelector: '.requests-grid',
      };
    }

    if (pendingRequests.length > 0) {
      return {
        title: 'Your request is waiting for the provider',
        description: 'You can review the booking details while waiting for the provider to accept or decline the request.',
        steps: [
          'Use View Details to confirm what you submitted.',
          'Watch the booking status here for the provider response.',
        ],
        actionLabel: 'View bookings',
        onAction: showAllRequests,
        targetSelector: '.requests-grid',
      };
    }

    return {
      title: 'Need another service?',
      description: 'Your current bookings do not need an immediate action. You can browse providers again whenever you need another service.',
      steps: [
        'Review completed bookings here when needed.',
        'Return to Browse Services to find another provider.',
      ],
      actionLabel: 'Browse Services',
      actionTo: '/feed',
      targetSelector: '.requests-grid',
    };
  })();

  if (loading) {
    return (
      <div className="requests-container">
        <div className="requests-loading">
          <div className="spinner"></div>
            <p>{t('requestsLoading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="requests-container">
      <div className="requests-wrapper">
        <div className="requests-toolbar" data-tour={isProvider ? 'incoming-requests' : undefined}>
          <div className="requests-filters">
            <button
              className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              {t('all')}
            </button>
            <button
              className={`filter-btn ${activeFilter === 'active' ? 'active' : ''}`}
              onClick={() => setActiveFilter('active')}
            >
              {t('active')}
            </button>
            <button
              className={`filter-btn ${activeFilter === REQUEST_STATUS.COMPLETED ? 'active' : ''}`}
              onClick={() => setActiveFilter(REQUEST_STATUS.COMPLETED)}
            >
              {t(REQUEST_STATUS.COMPLETED)}
            </button>
            <button
              className={`filter-btn ${activeFilter === REQUEST_STATUS.CANCELLED ? 'active' : ''}`}
              onClick={() => setActiveFilter(REQUEST_STATUS.CANCELLED)}
            >
              {t(REQUEST_STATUS.CANCELLED)}
            </button>
          </div>
          <NextStepHelp guidance={requestsHelpGuidance} />
        </div>

        {error && (
          <div className="requests-error">
            <i className="bi bi-exclamation-triangle"></i>
            <p>{error}</p>
            <button onClick={fetchRequests}>{t('tryAgain')}</button>
          </div>
        )}

        {filteredRequests.length === 0 ? (
          <div className="requests-empty">
            <i className="bi bi-inbox"></i>
            <h3>{t('requestsNoResultsTitle')}</h3>
            <p>{activeFilter === 'all' 
              ? (isProvider ? t('requestsNoProviderRequestsYet') : t('requestsNoClientRequestsYet'))
              : t('requestsNoFiltered', { filter: activeFilter })
            }</p>
          </div>
        ) : (
          <div className="requests-grid">
            {filteredRequests.map((request) => (
              <div key={request.id} className="request-card">
                <div className="request-card-header">
                  <div className="request-title-section">
                    <h3 className="request-title">{request.service_display_label || request.service_type_label || 'Service Request'}</h3>
                    <span className={`request-status-badge ${getStatusBadgeClass(request.status)}`}>
                      {formatStatus(request.status)}
                    </span>
                  </div>
                </div>

                <div className="request-card-body">
                  <div className="request-body-left">
                    <p className="request-counterparty">
                      <i className="bi bi-person"></i>
                      <span>{isProvider ? request.client_name : request.provider_name}</span>
                    </p>
                    <p className="request-details">{request.job_details}</p>
                  </div>
                  
                  <div className="request-meta">
                    <div className="meta-row">
                      <i className="bi bi-calendar"></i>
                      <span>{formatBookingDates(request)}</span>
                    </div>
                    <div className="meta-row">
                      <i className="bi bi-clock"></i>
                      <span>{request.start_time || request.scheduled_time}</span>
                    </div>
                    {request.estimated_total != null && (
                      <div className="meta-row">
                        <i className="bi bi-currency-exchange"></i>
                        <span>{t('estimatedAmount', { amount: Number(request.estimated_total).toLocaleString() })}</span>
                      </div>
                    )}
                    {!isProvider && request.provider_location && (
                      <div className="meta-row">
                        <i className="bi bi-geo-alt"></i>
                        <span>{request.provider_location}</span>
                      </div>
                    )}
                  </div>
                </div>

                {request.status === REQUEST_STATUS.DECLINED && request.decline_reason && (
                  <p className="request-decline-reason"><strong>{t('reasonForDeclining')}:</strong> {request.decline_reason}</p>
                )}
                {request.status === REQUEST_STATUS.CANCELLED && request.cancellation_reason && (
                  <p className="request-decline-reason"><strong>{t('reasonForCancellation')}:</strong> {request.cancellation_reason_other || request.cancellation_reason.replaceAll('_', ' ')}</p>
                )}

                {/* Discussion/Phone Section */}
                {[REQUEST_STATUS.ACCEPTED, REQUEST_STATUS.ON_THE_WAY, REQUEST_STATUS.IN_PROGRESS].includes(request.status) && (
                  <div className="request-discussion-section">
                    {!isProvider ? (
                      // Client view
                      <>
                        {request.discussion_accepted && request.provider_phone ? (
                          <div className="phone-revealed">
                            <i className="bi bi-telephone-fill"></i>
                            <div>
                              <span className="phone-label">{t('requestsProviderPhoneLabel')}</span>
                              <a href={`tel:${request.provider_phone}`} className="phone-number">
                                {request.provider_phone}
                              </a>
                            </div>
                          </div>
                        ) : request.discussion_requested ? (
                          <div className="discussion-pending">
                            <i className="bi bi-hourglass-split"></i>
                            <span>{t('requestsWaitingProviderDiscussion')}</span>
                          </div>
                        ) : (
                          <button
                            className="btn-request-discussion"
                            onClick={() => handleRequestDiscussion(request.id)}
                            disabled={actionLoading === request.id}
                          >
                            {actionLoading === request.id ? (
                              <><span className="spinner-btn"></span> {t('requestsSending')}</>
                            ) : (
                              <><i className="bi bi-chat-dots"></i> {t('requestsRequestDiscussion')}</>
                            )}
                          </button>
                        )}
                      </>
                    ) : (
                      // Provider view
                      <>
                        {request.discussion_accepted ? (
                          <div className="discussion-accepted-badge">
                            <i className="bi bi-check-circle-fill"></i>
                            <span>{t('requestsPhoneSharedWithClient')}</span>
                          </div>
                        ) : request.discussion_requested ? (
                          <div className="discussion-request-pending">
                            <p><i className="bi bi-chat-dots-fill"></i> {t('requestsClientWantsDiscuss')}</p>
                            <button
                              className="btn-accept-discussion"
                              onClick={() => handleAcceptDiscussion(request.id)}
                              disabled={actionLoading === request.id}
                            >
                              {actionLoading === request.id ? (
                                <><span className="spinner-btn"></span> {t('requestsAccepting')}</>
                              ) : (
                                <><i className="bi bi-telephone"></i> {t('requestsAcceptAndSharePhone')}</>
                              )}
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                )}

                <div className="request-card-actions">
                  {isProvider ? (
                    // Provider actions
                    <>
                      {request.status === REQUEST_STATUS.PENDING && (
                        <>
                          <button
                            className="btn-action btn-accept btn-primary-action"
                            onClick={() => handleStatusUpdate(request.id, REQUEST_STATUS.ACCEPTED)}
                            disabled={actionLoading === request.id}
                          >
                            {actionLoading === request.id ? t('requestsProcessing') : t('requestsAcceptRequest')}
                          </button>
                          <button
                            className="btn-action btn-view-details-secondary"
                            onClick={() => void handleViewDetails(request)}
                          >
                            <i className="bi bi-eye"></i> {t('viewDetails')}
                          </button>
                          <button
                            className="btn-action btn-decline btn-danger-subtle"
                            onClick={() => openDeclineDialog(request.id)}
                            disabled={actionLoading === request.id}
                          >
                            {t('requestsDeclineRequest')}
                          </button>
                        </>
                      )}
                      {request.status === REQUEST_STATUS.ACCEPTED && (
                        <>
                          <button className="btn-action btn-on-way btn-primary-action" onClick={() => handleStatusUpdate(request.id, REQUEST_STATUS.ON_THE_WAY)} disabled={actionLoading === request.id}>
                            <i className="bi bi-truck"></i> {t('requestsImOnMyWay')}
                          </button>
                          <button className="btn-action btn-view-details-secondary" onClick={() => void handleViewDetails(request)}>
                            <i className="bi bi-eye"></i> {t('viewDetails')}
                          </button>
                          <button className="btn-action btn-cancel btn-danger-subtle" onClick={() => openCancelDialog(request.id)} disabled={actionLoading === request.id}>
                            {t('cancelServiceRequest')}
                          </button>
                        </>
                      )}
                      {request.status === REQUEST_STATUS.ON_THE_WAY && (
                        <>
                          <button className="btn-action btn-on-way btn-primary-action" onClick={() => handleStatusUpdate(request.id, REQUEST_STATUS.IN_PROGRESS)} disabled={actionLoading === request.id}>
                            <i className="bi bi-play-circle"></i> {t('requestsStartService')}
                          </button>
                          <button className="btn-action btn-view-details-secondary" onClick={() => void handleViewDetails(request)}>
                            <i className="bi bi-eye"></i> {t('viewDetails')}
                          </button>
                        </>
                      )}
                      {request.status === REQUEST_STATUS.IN_PROGRESS && !request.provider_completed && (
                        <>
                          <button className="btn-action btn-complete btn-primary-action" onClick={() => handleStatusUpdate(request.id, REQUEST_STATUS.COMPLETED)} disabled={actionLoading === request.id}>
                            <i className="bi bi-check-lg"></i> {t('requestsMarkServiceComplete')}
                          </button>
                          <button className="btn-action btn-view-details-secondary" onClick={() => void handleViewDetails(request)}>
                            <i className="bi bi-eye"></i> {t('viewDetails')}
                          </button>
                        </>
                      )}
                      {request.status === REQUEST_STATUS.COMPLETED && (
                        <>
                          <button
                            className="btn-action btn-view-details-secondary"
                            onClick={() => void handleViewDetails(request)}
                          >
                            <i className="bi bi-eye"></i> {t('viewDetails')}
                          </button>
                          <button
                            className="btn-action btn-hide"
                            onClick={() => handleHideRequest(request.id)}
                            disabled={actionLoading === request.id}
                          >
                            <i className="bi bi-eye-slash"></i> {t('requestsRemoveFromList')}
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    // Client actions
                    <>
                      {request.status === REQUEST_STATUS.PENDING && (
                        <>
                          <button
                            className="btn-action btn-view-details-secondary"
                            onClick={() => void handleViewDetails(request)}
                          >
                            <i className="bi bi-eye"></i> {t('viewDetails')}
                          </button>
                          <button
                            className="btn-action btn-cancel btn-danger-subtle"
                            onClick={() => openCancelDialog(request.id)}
                            disabled={actionLoading === request.id}
                          >
                            {t('requestsCancelRequest')}
                          </button>
                        </>
                      )}
                      {request.status === REQUEST_STATUS.ACCEPTED && (
                        <>
                          <button className="btn-action btn-view-details-secondary" onClick={() => void handleViewDetails(request)}>
                            <i className="bi bi-eye"></i> {t('viewDetails')}
                          </button>
                          <button className="btn-action btn-on-way" onClick={() => openRescheduleDialog(request)} disabled={actionLoading === request.id}>
                            <i className="bi bi-calendar2-week"></i> {t('requestsProposeReschedule')}
                          </button>
                          <button className="btn-action btn-cancel btn-danger-subtle" onClick={() => openCancelDialog(request.id)} disabled={actionLoading === request.id}>
                            {t('cancelServiceRequest')}
                          </button>
                        </>
                      )}
                      {[REQUEST_STATUS.ON_THE_WAY, REQUEST_STATUS.IN_PROGRESS].includes(request.status) && (
                        <button className="btn-action btn-view-details-secondary" onClick={() => void handleViewDetails(request)}>
                          <i className="bi bi-eye"></i> {t('viewDetails')}
                        </button>
                      )}
                      {request.status === REQUEST_STATUS.IN_PROGRESS && !request.client_completed && (
                        <button className="btn-action btn-complete btn-primary-action" onClick={() => handleStatusUpdate(request.id, REQUEST_STATUS.COMPLETED)} disabled={actionLoading === request.id}>
                          <i className="bi bi-check-lg"></i> {t('requestsMarkServiceComplete')}
                        </button>
                      )}
                      {request.status === REQUEST_STATUS.COMPLETED && !request.has_review && (
                        <>
                          <button
                            className="btn-action btn-review btn-primary-action"
                            onClick={() => setReviewRequest(request)}
                          >
                            <i className="bi bi-star"></i> {t('requestsLeaveReview')}
                          </button>
                          <button
                            className="btn-action btn-view-details-secondary"
                            onClick={() => void handleViewDetails(request)}
                          >
                            <i className="bi bi-eye"></i> {t('viewDetails')}
                          </button>
                        </>
                      )}
                      {request.status === REQUEST_STATUS.COMPLETED && request.has_review && (
                        <div className="review-submitted-badge">
                          <i className="bi bi-star-fill"></i>
                          <span>{t('requestsReviewSubmitted')}</span>
                        </div>
                      )}
                      {request.status === REQUEST_STATUS.COMPLETED && (
                        <button
                          className="btn-action btn-hide"
                          onClick={() => handleHideRequest(request.id)}
                          disabled={actionLoading === request.id}
                        >
                          <i className="bi bi-eye-slash"></i> {t('requestsRemoveFromList')}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request Details Modal */}
      {selectedRequest && (
        <RequestDetailsModal
          request={selectedRequest}
          currentUserId={user?.id || user?.userId || null}
          isProvider={isProvider}
          onClose={handleCloseDetails}
          onStatusUpdate={handleStatusUpdate}
          onOpenCancel={(request) => openCancelDialog(request.id)}
          onOpenReschedule={(request) => openRescheduleDialog(request)}
          onRespondReschedule={handleRespondReschedule}
          onRequestDiscussion={async (requestId) => {
            await handleRequestDiscussion(requestId);
            setSelectedRequest(prev => prev ? { ...prev, discussion_requested: true } : null);
          }}
          onAcceptDiscussion={async (requestId) => {
            await handleAcceptDiscussion(requestId);
            setSelectedRequest(prev => prev ? { ...prev, discussion_accepted: true, provider_phone_revealed: true } : null);
          }}
          onOpenReview={(request) => {
            setReviewRequest(request);
          }}
          onOpenDecline={(request) => {
            openDeclineDialog(request.id);
          }}
          onOpenReport={(request) => {
            setReportRequest(request);
          }}
          detailsLoading={detailsLoading}
          actionLoading={actionLoading}
        />
      )}

      {cancelDialog.open && (
        <div className="decline-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title" onClick={closeCancelDialog}>
          <div className="decline-dialog-card" onClick={(event) => event.stopPropagation()}>
            <div className="decline-dialog-header">
              <h2 id="cancel-dialog-title">{t('cancelServiceRequest')}</h2>
              <button type="button" className="decline-dialog-close" onClick={closeCancelDialog} aria-label={t('requestsCloseCancelDialog')}>
                ×
              </button>
            </div>
            <div className="decline-dialog-body">
              <label htmlFor="cancel-reason-select" className="decline-dialog-label">{t('requestsReasonForCancellationLabel')}</label>
              <select
                id="cancel-reason-select"
                className="decline-dialog-textarea"
                value={cancelDialog.cancellationReason}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setCancelDialog((prev) => ({
                    ...prev,
                    cancellationReason: nextValue,
                    error: '',
                  }));
                }}
              >
                <option value={CANCELLATION_REASONS.SCHEDULE_CONFLICT}>{t('requestsCancelReasonScheduleConflict')}</option>
                <option value={CANCELLATION_REASONS.NO_LONGER_NEEDED}>{t('requestsCancelReasonNoLongerNeedService')}</option>
                <option value={CANCELLATION_REASONS.PROVIDER_UNAVAILABLE}>{t('requestsCancelReasonProviderUnavailable')}</option>
                <option value={CANCELLATION_REASONS.CLIENT_UNAVAILABLE}>{t('requestsCancelReasonClientUnavailable')}</option>
                <option value={CANCELLATION_REASONS.INCORRECT_BOOKING}>{t('requestsCancelReasonIncorrectBookingInfo')}</option>
                <option value={CANCELLATION_REASONS.PROVIDER_NO_RESPONSE}>{t('requestsCancelReasonProviderNoResponse')}</option>
                <option value={CANCELLATION_REASONS.FOUND_ANOTHER_PROVIDER}>{t('requestsCancelReasonFoundAnotherProvider')}</option>
                <option value={CANCELLATION_REASONS.OTHER}>{t('other')}</option>
              </select>
              {cancelDialog.cancellationReason === CANCELLATION_REASONS.OTHER && (
                <>
                  <label htmlFor="cancel-reason-other" className="decline-dialog-label">{t('requestsProvideCancellationDetails')}</label>
                  <textarea
                    id="cancel-reason-other"
                    className="decline-dialog-textarea"
                    rows={3}
                    value={cancelDialog.cancellationReasonOther}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setCancelDialog((prev) => ({
                        ...prev,
                        cancellationReasonOther: nextValue,
                        error: '',
                      }));
                    }}
                    maxLength={500}
                    placeholder={t('requestsTellWhyCancelling')}
                  />
                </>
              )}
              {cancelDialog.error ? <p className="decline-dialog-error">{cancelDialog.error}</p> : null}
            </div>
            <div className="decline-dialog-actions">
              <button
                type="button"
                className="decline-btn-cancel"
                onClick={closeCancelDialog}
                disabled={actionLoading === cancelDialog.requestId}
              >
                {t('requestsKeepRequest')}
              </button>
              <button
                type="button"
                className="decline-btn-confirm"
                onClick={handleConfirmCancellation}
                disabled={actionLoading === cancelDialog.requestId}
              >
                {actionLoading === cancelDialog.requestId ? t('requestsCancelling') : t('requestsConfirmCancellation')}
              </button>
            </div>
          </div>
        </div>
      )}

      {rescheduleDialog.open && (
        <div className="decline-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="reschedule-dialog-title" onClick={closeRescheduleDialog}>
          <div className="decline-dialog-card" onClick={(event) => event.stopPropagation()}>
            <div className="decline-dialog-header">
              <h2 id="reschedule-dialog-title">{t('requestsProposeReschedule')}</h2>
              <button type="button" className="decline-dialog-close" onClick={closeRescheduleDialog} aria-label={t('requestsCloseRescheduleDialog')}>
                ×
              </button>
            </div>
            <div className="decline-dialog-body">
              <label htmlFor="reschedule-booking-type" className="decline-dialog-label">{t('bookingTypeLabel')}</label>
              <select
                id="reschedule-booking-type"
                className="decline-dialog-textarea"
                value={rescheduleDialog.bookingType}
                onChange={(event) => handleRescheduleBookingTypeChange(event.target.value)}
                disabled={rescheduleDialog.availabilityLoading}
              >
                <option value={BOOKING_TYPE.ONE_DAY}>{t('bookingOneDay')}</option>
                <option value={BOOKING_TYPE.DATE_RANGE}>{t('bookingDateRange')}</option>
                {SPECIFIC_DATE_BOOKING_ENABLED && (
                  <option value={BOOKING_TYPE.SPECIFIC_DATES}>{t('bookingSpecificDates')}</option>
                )}
              </select>

              {rescheduleDialog.bookingType === BOOKING_TYPE.SPECIFIC_DATES ? (
                <>
                  <span className="decline-dialog-label">{t('bookingSpecificDates')}</span>
                  <div className="reschedule-specific-date-grid" role="group" aria-label={t('bookingSpecificDates')}>
                    {rescheduleDialog.availableDates.map((date) => {
                      const selected = (rescheduleDialog.proposedDates || []).includes(date);
                      return (
                        <button
                          key={date}
                          type="button"
                          className={`reschedule-date-chip ${selected ? 'selected' : ''}`}
                          aria-pressed={selected}
                          onClick={() => toggleRescheduleSpecificDate(date)}
                          disabled={rescheduleDialog.availabilityLoading}
                        >
                          {formatDate(date)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="reschedule-date-summary">
                    {t('bookingSelectedLabel')}: {(rescheduleDialog.proposedDates || []).length}
                  </p>
                </>
              ) : (
                <>
                  <label htmlFor="reschedule-start-date" className="decline-dialog-label">{t('requestsStartDate')}</label>
                  <select
                    id="reschedule-start-date"
                    className="decline-dialog-textarea"
                    value={rescheduleDialog.proposedStartDate}
                    onChange={(event) => {
                      const nextStart = event.target.value;
                      setRescheduleDialog((prev) => ({
                        ...prev,
                        proposedStartDate: nextStart,
                        proposedEndDate: nextStart,
                        proposedDates: nextStart ? [nextStart] : [],
                        proposedStartTime: '',
                        error: '',
                      }));
                    }}
                    disabled={rescheduleDialog.availabilityLoading || rescheduleDialog.availableDates.length === 0}
                  >
                    {rescheduleDialog.availableDates.map((date) => (
                      <option key={date} value={date}>{date}</option>
                    ))}
                  </select>

                  {rescheduleDialog.bookingType === BOOKING_TYPE.DATE_RANGE && (
                    <>
                      <label htmlFor="reschedule-end-date" className="decline-dialog-label">{t('requestsEndDate')}</label>
                      <select
                        id="reschedule-end-date"
                        className="decline-dialog-textarea"
                        value={rescheduleDialog.proposedEndDate}
                        onChange={(event) => {
                          const nextEnd = event.target.value;
                          setRescheduleDialog((prev) => ({
                            ...prev,
                            proposedEndDate: nextEnd,
                            proposedDates: getDateRangeIso(prev.proposedStartDate, nextEnd),
                            proposedStartTime: '',
                            error: '',
                          }));
                        }}
                        disabled={rescheduleDialog.availabilityLoading}
                      >
                        {getContiguousDatesFrom(rescheduleDialog.availableDates, rescheduleDialog.proposedStartDate).map((date) => (
                          <option key={date} value={date}>{date}</option>
                        ))}
                      </select>
                    </>
                  )}
                </>
              )}

              <label htmlFor="reschedule-start-time" className="decline-dialog-label">{t('requestsStartTime')}</label>
              <select
                id="reschedule-start-time"
                className="decline-dialog-textarea"
                value={String(rescheduleDialog.proposedStartTime || '').slice(0, 5)}
                onChange={(event) => setRescheduleDialog((prev) => ({ ...prev, proposedStartTime: event.target.value, error: '' }))}
                disabled={rescheduleDialog.availabilityLoading || rescheduleDialog.availableSlots.length === 0}
              >
                {rescheduleDialog.availableSlots.map((slot) => (
                  <option key={slot.time} value={String(slot.time).slice(0, 5)}>{String(slot.time).slice(0, 5)}</option>
                ))}
              </select>

              <label htmlFor="reschedule-duration" className="decline-dialog-label">{t('requestsEstimatedDurationMinutes')}</label>
              <input
                id="reschedule-duration"
                className="decline-dialog-textarea"
                type="number"
                min="1"
                max="1440"
                value={rescheduleDialog.estimatedDurationMinutes}
                disabled
                aria-readonly="true"
              />

              <label htmlFor="reschedule-reason" className="decline-dialog-label">{t('reason')}</label>
              <textarea
                id="reschedule-reason"
                className="decline-dialog-textarea"
                rows={4}
                value={rescheduleDialog.reason}
                onChange={(event) => setRescheduleDialog((prev) => ({ ...prev, reason: event.target.value, error: '' }))}
                maxLength={1000}
                placeholder={t('requestsExplainProposedSchedule')}
              />

              {rescheduleDialog.error ? <p className="decline-dialog-error">{rescheduleDialog.error}</p> : null}
            </div>
            <div className="decline-dialog-actions">
              <button type="button" className="decline-btn-cancel" onClick={closeRescheduleDialog} disabled={actionLoading === rescheduleDialog.requestId}>
                {t('requestsCancelAction')}
              </button>
              <button
                type="button"
                className="decline-btn-confirm"
                onClick={handleSubmitReschedule}
                disabled={
                  actionLoading === rescheduleDialog.requestId
                  || rescheduleDialog.availabilityLoading
                  || (rescheduleDialog.bookingType === BOOKING_TYPE.SPECIFIC_DATES
                    ? (rescheduleDialog.proposedDates || []).length === 0
                    : !rescheduleDialog.proposedStartDate)
                  || !rescheduleDialog.proposedStartTime
                  || rescheduleDialog.availableSlots.length === 0
                }
              >
                {actionLoading === rescheduleDialog.requestId ? t('requestsSending') : t('requestsSendProposal')}
              </button>
            </div>
          </div>
        </div>
      )}

      {declineDialog.open && (
        <div className="decline-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="decline-dialog-title" onClick={closeDeclineDialog}>
          <div className="decline-dialog-card" onClick={(event) => event.stopPropagation()}>
            <div className="decline-dialog-header">
              <h2 id="decline-dialog-title">{t('declineServiceRequest')}</h2>
              <button type="button" className="decline-dialog-close" onClick={closeDeclineDialog} aria-label={t('requestsCloseDeclineDialog')}>
                ×
              </button>
            </div>
            <div className="decline-dialog-body">
              <label htmlFor="decline-reason-text" className="decline-dialog-label">{t('reasonForDeclining')}</label>
              <textarea
                id="decline-reason-text"
                className="decline-dialog-textarea"
                value={declineDialog.reason}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setDeclineDialog((prev) => ({
                    ...prev,
                    reason: nextValue,
                    error: prev.error ? '' : prev.error,
                  }));
                }}
                rows={4}
                maxLength={500}
                placeholder={t('requestsDeclineReasonPlaceholder')}
              />
              {declineDialog.error ? <p className="decline-dialog-error">{declineDialog.error}</p> : null}
            </div>
            <div className="decline-dialog-actions">
              <button
                type="button"
                className="decline-btn-cancel"
                onClick={closeDeclineDialog}
                disabled={actionLoading === declineDialog.requestId}
              >
                {t('requestsCancelAction')}
              </button>
              <button
                type="button"
                className="decline-btn-confirm"
                onClick={handleConfirmDecline}
                disabled={actionLoading === declineDialog.requestId || !declineDialog.reason.trim()}
              >
                {actionLoading === declineDialog.requestId ? t('requestsDeclining') : t('requestsConfirmDecline')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewRequest && (
        <ReviewModal
          request={reviewRequest}
          onClose={() => setReviewRequest(null)}
          onSubmit={handleSubmitReview}
          loading={reviewLoading}
        />
      )}

      {/* Report Modal */}
      {reportRequest && (
        <ReportUserModal
          request={reportRequest}
          isProvider={isProvider}
          onClose={() => setReportRequest(null)}
          onSubmitted={() => {
            setReportRequest(null);
          }}
        />
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { isAuthenticated, serviceProfileAPI, serviceRequestAPI } from '../../services/api';
import './BookingModal.css';

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatMoney = (amount) => `₱${Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const getDurationDays = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }

  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
};

export default function BookingModal({ provider, onClose }) {
  const now = new Date();
  const defaultStartDate = formatDateInput(now);

  const [bookingType, setBookingType] = useState('one_day');
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultStartDate);
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState(120);
  const [availableDates, setAvailableDates] = useState([]);
  const [dateLoading, setDateLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDetails, setJobDetails] = useState('');
  const [slotLoading, setSlotLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  const dailyRate = Number(provider?.dailyRate ?? provider?.startingPrice ?? 0);
  const durationDays = useMemo(() => getDurationDays(startDate, bookingType === 'multi_day' ? endDate : startDate), [bookingType, startDate, endDate]);
  const estimatedTotal = useMemo(() => dailyRate * durationDays, [dailyRate, durationDays]);
  const availableDateSet = useMemo(() => new Set(availableDates), [availableDates]);

  const isContinuousMultiDayRange = useMemo(() => {
    if (bookingType !== 'multi_day') {
      return true;
    }

    if (!startDate || !endDate) {
      return false;
    }

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return false;
    }

    for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const dateKey = formatDateInput(cursor);
      if (!availableDateSet.has(dateKey)) {
        return false;
      }
    }

    return true;
  }, [bookingType, startDate, endDate, availableDateSet]);

  const endDateOptions = useMemo(() => (
    availableDates.filter((date) => date >= startDate)
  ), [availableDates, startDate]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    if (bookingType === 'one_day') {
      setEndDate(startDate);
    }
  }, [bookingType, startDate]);

  useEffect(() => {
    const loadAvailableDates = async () => {
      if (!provider?.id) {
        setAvailableDates([]);
        return;
      }

      setDateLoading(true);
      setSubmitError('');

      const windowStart = new Date();
      const windowEnd = addDays(windowStart, 60);

      try {
        const response = await serviceProfileAPI.getAvailableDates(provider.id, {
          fromDate: formatDateInput(windowStart),
          toDate: formatDateInput(windowEnd),
          duration: estimatedDurationMinutes,
        });

        if (response.success) {
          const dates = Array.isArray(response.data?.dates) ? response.data.dates : [];
          setAvailableDates(dates);

          if (dates.length > 0) {
            setStartDate((prev) => (dates.includes(prev) ? prev : dates[0]));
            setEndDate((prev) => (dates.includes(prev) ? prev : dates[0]));
          } else {
            setStartDate('');
            setEndDate('');
          }
        }
      } catch (error) {
        setAvailableDates([]);
        setStartDate('');
        setEndDate('');
        setSubmitError(error.message || 'Unable to load available dates');
      } finally {
        setDateLoading(false);
      }
    };

    loadAvailableDates();
  }, [provider?.id, estimatedDurationMinutes]);

  useEffect(() => {
    if (bookingType !== 'multi_day') {
      return;
    }

    if (endDate && !endDateOptions.includes(endDate)) {
      setEndDate(endDateOptions[0] || startDate);
    }
  }, [bookingType, endDate, endDateOptions, startDate]);

  useEffect(() => {
    const loadSlots = async () => {
      if (!provider?.id || !startDate) {
        setAvailableSlots([]);
        setSelectedTime('');
        return;
      }

      if (bookingType === 'multi_day' && !isContinuousMultiDayRange) {
        setAvailableSlots([]);
        setSelectedTime('');
        setSubmitError('Selected date range has unavailable day(s). Please choose a continuous available range.');
        return;
      }

      setSlotLoading(true);
      setSubmitError('');
      try {
        const response = await serviceProfileAPI.getAvailableSlots(provider.id, {
          date: startDate,
          endDate: bookingType === 'multi_day' ? endDate : null,
          bookingType,
          duration: estimatedDurationMinutes,
        });

        if (response.success) {
          const slots = response.data?.slots || [];
          setAvailableSlots(slots);

          setSelectedTime((previousSelectedTime) => {
            if (slots.length === 0) {
              return '';
            }

            return slots.some((slot) => slot.time === previousSelectedTime)
              ? previousSelectedTime
              : slots[0].time;
          });
        }
      } catch (error) {
        setAvailableSlots([]);
        setSelectedTime('');
        setSubmitError(error.message || 'Unable to load available time slots');
      } finally {
        setSlotLoading(false);
      }
    };

    loadSlots();
  }, [provider?.id, startDate, endDate, bookingType, estimatedDurationMinutes, isContinuousMultiDayRange]);

  const handleSubmit = async () => {
    if (!isAuthenticated()) {
      setSubmitError('Please log in to submit a booking request.');
      return;
    }

    if (!provider?.id || !provider?.userId) {
      setSubmitError('Provider information is incomplete. Please try another provider.');
      return;
    }

    if (!selectedTime) {
      setSubmitError('Please choose an available time slot.');
      return;
    }

    if (!startDate || (bookingType === 'multi_day' && !endDate)) {
      setSubmitError('Please select available booking date(s).');
      return;
    }

    if (bookingType === 'multi_day' && !isContinuousMultiDayRange) {
      setSubmitError('Selected date range has unavailable day(s). Please choose a continuous available range.');
      return;
    }

    if (!jobTitle.trim() || !jobDetails.trim()) {
      setSubmitError('Please complete job title and details.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const payload = {
        providerId: provider.userId,
        serviceProfileId: provider.id,
        bookingType,
        startDate,
        endDate: bookingType === 'multi_day' ? endDate : startDate,
        startTime: selectedTime,
        scheduledDate: startDate,
        scheduledTime: selectedTime,
        estimatedDurationMinutes: Number(estimatedDurationMinutes),
        jobTitle: jobTitle.trim(),
        jobDetails: jobDetails.trim(),
      };

      const response = await serviceRequestAPI.createRequest(payload);
      if (response.success) {
        setSuccess(true);
      }
    } catch (error) {
      setSubmitError(error.message || 'Failed to submit booking request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="booking-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="booking-modal" onClick={(event) => event.stopPropagation()}>
        <section className="booking-content" style={{ width: '100%' }}>
          <button className="booking-close" type="button" onClick={onClose} aria-label="Close booking modal">
            X
          </button>

          <div className="booking-header">
            <h2 className="booking-title">Book {provider?.name || 'Service Provider'}</h2>
            <p className="booking-subtitle">Choose one-day or multi-day service, then pick a backend-validated slot.</p>
          </div>

          <div className="booking-stage-content" style={{ display: 'grid', gap: '1rem' }}>
            <div className="booking-form-group">
              <label>Booking Type</label>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <label>
                  <input type="radio" name="bookingType" value="one_day" checked={bookingType === 'one_day'} onChange={() => setBookingType('one_day')} /> One day
                </label>
                <label>
                  <input type="radio" name="bookingType" value="multi_day" checked={bookingType === 'multi_day'} onChange={() => setBookingType('multi_day')} /> Multiple days
                </label>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div className="booking-form-group">
                <label>Start Date</label>
                <select
                  className="booking-input"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  disabled={dateLoading || availableDates.length === 0}
                >
                  {availableDates.length === 0 ? (
                    <option value="">No available dates</option>
                  ) : (
                    availableDates.map((date) => (
                      <option key={date} value={date}>{date}</option>
                    ))
                  )}
                </select>
              </div>

              <div className="booking-form-group">
                <label>End Date</label>
                <select
                  className="booking-input"
                  value={bookingType === 'multi_day' ? endDate : startDate}
                  disabled={bookingType !== 'multi_day'}
                  onChange={(event) => setEndDate(event.target.value)}
                >
                  {bookingType !== 'multi_day' ? (
                    <option value={startDate}>{startDate || 'Select start date first'}</option>
                  ) : endDateOptions.length === 0 ? (
                    <option value="">No valid end date</option>
                  ) : (
                    endDateOptions.map((date) => (
                      <option key={date} value={date}>{date}</option>
                    ))
                  )}
                </select>
              </div>

              <div className="booking-form-group">
                <label>Estimated Duration (minutes)</label>
                <input
                  className="booking-input"
                  type="number"
                  min="30"
                  max="1440"
                  step="30"
                  value={estimatedDurationMinutes}
                  onChange={(event) => setEstimatedDurationMinutes(Number(event.target.value || 0))}
                />
              </div>
            </div>

            <div className="booking-form-group">
              <label>Available Time Slots</label>
              {dateLoading ? (
                <p className="booking-subtitle">Loading provider availability...</p>
              ) : slotLoading ? (
                <p className="booking-subtitle">Loading available slots...</p>
              ) : availableSlots.length === 0 ? (
                <p className="booking-subtitle">No valid slots available for this schedule.</p>
              ) : (
                <div className="time-slots">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      className={`time-slot ${selectedTime === slot.time ? 'selected' : ''}`}
                      onClick={() => setSelectedTime(slot.time)}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="booking-form-group">
              <label>Job Title</label>
              <input className="booking-input" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Example: Pipe leak repair" />
            </div>

            <div className="booking-form-group">
              <label>Job Details and Service Location</label>
              <textarea className="booking-textarea" rows={4} value={jobDetails} onChange={(event) => setJobDetails(event.target.value)} placeholder="Describe the work and include service location details." />
            </div>

            <div className="booking-hint-card">
              <p><strong>Daily rate:</strong> {formatMoney(dailyRate)} per day</p>
              <p><strong>Duration:</strong> {durationDays} day(s)</p>
              <p><strong>Estimated service cost:</strong> {formatMoney(estimatedTotal)}</p>
              <p className="hint-subtext">The displayed amount is an estimate based on the provider’s daily rate. The final price may depend on the actual scope of work and the agreement between the client and provider. Payment is completed directly or in person.</p>
            </div>

            {submitError && (
              <div className="booking-error">
                <i className="bi bi-exclamation-circle"></i> {submitError}
              </div>
            )}

            {success && (
              <div className="booking-success">
                <h3>Request sent</h3>
                <p>Your booking request has been submitted successfully.</p>
              </div>
            )}
          </div>

          <div className="booking-actions">
            <button className="booking-btn booking-btn-outline" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            {!success && (
              <button className="booking-btn booking-btn-primary" type="button" onClick={handleSubmit} disabled={submitting || slotLoading}>
                {submitting ? 'Submitting...' : 'Confirm Booking'}
              </button>
            )}
            {success && (
              <button className="booking-btn booking-btn-primary" type="button" onClick={onClose}>
                Close
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

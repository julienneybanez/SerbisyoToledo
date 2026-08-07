import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  LocationIcon,
  UserIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from './Icons';
import { isAuthenticated, serviceProfileAPI, serviceRequestAPI } from '../../services/api';
import './BookingModal.css';

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const timelineStages = [
  { label: '1 Schedule', description: 'Pick your date range', icon: CalendarIcon },
  { label: '2 Time', description: 'Choose available time', icon: ClockIcon },
  { label: '3 Details', description: 'Share service details', icon: UserIcon },
];

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

const generateCalendarDays = (year, month) => {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const cells = [];
  for (let i = 0; i < firstDay; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
};

const getDurationDays = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;

  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);

  if (!start || !end || end < start) {
    return 0;
  }

  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
};

const formatMoney = (amount) => `P${Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function BookingModal({ provider, onClose }) {
  const today = new Date();
  const bookingWindowStart = today;
  const bookingWindowEnd = addDays(today, 60);

  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [step, setStep] = useState(1);

  const [bookingType, setBookingType] = useState('one_day');
  const [startDate, setStartDate] = useState(formatDateInput(today));
  const [endDate, setEndDate] = useState(formatDateInput(today));
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState(120);

  const [availableDates, setAvailableDates] = useState([]);
  const [dateLoading, setDateLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotLoading, setSlotLoading] = useState(false);

  const [selectedTime, setSelectedTime] = useState('');
  const [selectedServiceTypeKey, setSelectedServiceTypeKey] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDetails, setJobDetails] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const providerServiceTypes = useMemo(() => {
    const raw = Array.isArray(provider?.serviceTypes) ? provider.serviceTypes : [];
    return raw.filter((item) => item && item.key && item.label);
  }, [provider?.serviceTypes]);

  const dailyRate = Number(provider?.dailyRate ?? provider?.startingPrice ?? 0);
  const durationDays = useMemo(
    () => getDurationDays(startDate, bookingType === 'multi_day' ? endDate : startDate),
    [bookingType, startDate, endDate],
  );
  const estimatedTotal = useMemo(() => dailyRate * durationDays, [dailyRate, durationDays]);

  const availableDateSet = useMemo(() => new Set(availableDates), [availableDates]);

  const isRangeContinuous = useCallback((fromDate, toDate) => {
    const from = parseDateInput(fromDate);
    const to = parseDateInput(toDate);

    if (!from || !to || to < from) {
      return false;
    }

    for (const cursor = new Date(from); cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
      if (!availableDateSet.has(formatDateInput(cursor))) {
        return false;
      }
    }

    return true;
  }, [availableDateSet]);

  const isContinuousMultiDayRange = useMemo(() => {
    if (bookingType !== 'multi_day') return true;
    return isRangeContinuous(startDate, endDate);
  }, [bookingType, endDate, isRangeContinuous, startDate]);

  const statusIndex = step >= 4 ? 2 : Math.max(step - 1, 0);

  const safeProvider = {
    name: provider?.name || 'Service Provider',
    profession: provider?.profession || provider?.categories?.[0] || provider?.tags?.[0] || 'Community Services',
    location: provider?.location || 'Toledo City',
    description: provider?.bio || provider?.description || 'Reliable service provider ready to help with your request.',
  };

  const initials = safeProvider.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const calendarCells = useMemo(
    () => generateCalendarDays(currentYear, currentMonth),
    [currentYear, currentMonth],
  );

  const formattedSelectedRange = useMemo(() => {
    if (!startDate) return 'No date selected';

    const start = parseDateInput(startDate);
    if (!start) return 'No date selected';

    const startLabel = start.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    if (bookingType !== 'multi_day' || !endDate || endDate === startDate) {
      return startLabel;
    }

    const end = parseDateInput(endDate);
    if (!end) return startLabel;

    const endLabel = end.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    return `${startLabel} to ${endLabel}`;
  }, [bookingType, endDate, startDate]);

  const canGoToPrevMonth = useMemo(() => {
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    return prevYear > bookingWindowStart.getFullYear()
      || (prevYear === bookingWindowStart.getFullYear() && prevMonth >= bookingWindowStart.getMonth());
  }, [bookingWindowStart, currentMonth, currentYear]);

  const canGoToNextMonth = useMemo(() => {
    return currentYear < bookingWindowEnd.getFullYear()
      || (currentYear === bookingWindowEnd.getFullYear() && currentMonth < bookingWindowEnd.getMonth());
  }, [bookingWindowEnd, currentMonth, currentYear]);

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
    const loadAvailableDates = async () => {
      if (!provider?.id) {
        setAvailableDates([]);
        return;
      }

      setDateLoading(true);
      setSubmitError('');

      try {
        const response = await serviceProfileAPI.getAvailableDates(provider.id, {
          fromDate: formatDateInput(bookingWindowStart),
          toDate: formatDateInput(bookingWindowEnd),
          duration: estimatedDurationMinutes,
        });

        if (response.success) {
          const dates = Array.isArray(response.data?.dates) ? response.data.dates : [];
          setAvailableDates(dates);

          if (dates.length > 0) {
            const firstDate = dates[0];
            const parsedFirstDate = parseDateInput(firstDate);

            setStartDate((prev) => (dates.includes(prev) ? prev : firstDate));
            setEndDate((prev) => (dates.includes(prev) ? prev : firstDate));

            if (parsedFirstDate) {
              setCurrentMonth(parsedFirstDate.getMonth());
              setCurrentYear(parsedFirstDate.getFullYear());
            }
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
  }, [provider?.id, estimatedDurationMinutes, bookingWindowEnd, bookingWindowStart]);

  useEffect(() => {
    if (bookingType === 'one_day') {
      setEndDate(startDate);
    }
  }, [bookingType, startDate]);

  useEffect(() => {
    if (providerServiceTypes.length === 0) {
      setSelectedServiceTypeKey('');
      return;
    }

    if (providerServiceTypes.length === 1) {
      setSelectedServiceTypeKey(providerServiceTypes[0].key);
      return;
    }

    setSelectedServiceTypeKey((prev) => (
      providerServiceTypes.some((item) => item.key === prev)
        ? prev
        : providerServiceTypes[0].key
    ));
  }, [providerServiceTypes]);

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

          setSelectedTime((prevSelected) => {
            if (slots.length === 0) return '';
            return slots.some((slot) => slot.time === prevSelected) ? prevSelected : slots[0].time;
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

  const handlePrevMonth = useCallback(() => {
    if (!canGoToPrevMonth) return;

    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  }, [canGoToPrevMonth, currentMonth]);

  const handleNextMonth = useCallback(() => {
    if (!canGoToNextMonth) return;

    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  }, [canGoToNextMonth, currentMonth]);

  const getDateKeyForDay = useCallback((day) => {
    const date = new Date(currentYear, currentMonth, day);
    return formatDateInput(date);
  }, [currentMonth, currentYear]);

  const isDateAvailable = useCallback((day) => {
    if (!day) return false;
    return availableDateSet.has(getDateKeyForDay(day));
  }, [availableDateSet, getDateKeyForDay]);

  const isSelectedDay = useCallback((day) => {
    if (!day || !startDate) return false;

    const key = getDateKeyForDay(day);
    if (bookingType !== 'multi_day') {
      return key === startDate;
    }

    if (!endDate) {
      return key === startDate;
    }

    return key >= startDate && key <= endDate;
  }, [bookingType, endDate, getDateKeyForDay, startDate]);

  const handleSelectDay = useCallback((day) => {
    if (!day) return;

    const dateKey = getDateKeyForDay(day);
    if (!availableDateSet.has(dateKey)) {
      return;
    }

    setSubmitError('');

    if (bookingType === 'one_day') {
      setStartDate(dateKey);
      setEndDate(dateKey);
      return;
    }

    if (!startDate || !endDate || startDate !== endDate) {
      setStartDate(dateKey);
      setEndDate(dateKey);
      return;
    }

    let nextStart = startDate;
    let nextEnd = dateKey;

    if (dateKey < startDate) {
      nextStart = dateKey;
      nextEnd = startDate;
    }

    if (!isRangeContinuous(nextStart, nextEnd)) {
      setSubmitError('Selected date range has unavailable day(s). Please choose a continuous available range.');
      setStartDate(dateKey);
      setEndDate(dateKey);
      return;
    }

    setStartDate(nextStart);
    setEndDate(nextEnd);
  }, [availableDateSet, bookingType, endDate, getDateKeyForDay, isRangeContinuous, startDate]);

  const canProceed = () => {
    if (step === 1) {
      if (!startDate) return false;
      if (bookingType !== 'multi_day') return true;
      return Boolean(endDate) && isContinuousMultiDayRange;
    }

    if (step === 2) {
      return Boolean(selectedTime);
    }

    if (step === 3) {
      const hasValidServiceTypeSelection = providerServiceTypes.length <= 1 || Boolean(selectedServiceTypeKey);
      return hasValidServiceTypeSelection && jobTitle.trim().length > 0 && jobDetails.trim().length > 0;
    }

    return true;
  };

  const handlePrev = () => {
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleNext = async () => {
    if (step < 3) {
      setStep((prev) => Math.min(prev + 1, 4));
      return;
    }

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

    if (bookingType === 'multi_day' && !isContinuousMultiDayRange) {
      setSubmitError('Selected date range has unavailable day(s). Please choose a continuous available range.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const payload = {
        providerId: provider.userId,
        serviceProfileId: provider.id,
        serviceTypeKey: selectedServiceTypeKey || null,
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
        setStep(4);
      }
    } catch (error) {
      setSubmitError(error.message || 'Failed to submit booking request.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderCalendar = () => (
    <div className="booking-calendar">
      <div className="calendar-header">
        <button
          className={`calendar-nav ${!canGoToPrevMonth ? 'disabled' : ''}`}
          type="button"
          aria-label="Previous month"
          disabled={!canGoToPrevMonth}
          onClick={handlePrevMonth}
        >
          <ChevronLeftIcon />
        </button>

        <div className="calendar-month">
          <span>{monthNames[currentMonth]} {currentYear}</span>
        </div>

        <button
          className={`calendar-nav ${!canGoToNextMonth ? 'disabled' : ''}`}
          type="button"
          aria-label="Next month"
          disabled={!canGoToNextMonth}
          onClick={handleNextMonth}
        >
          <ChevronRightIcon />
        </button>
      </div>

      <div className="calendar-weekdays">
        {weekdayLabels.map((day) => (
          <span key={day} className="weekday">{day}</span>
        ))}
      </div>

      <div className="calendar-grid">
        {calendarCells.map((cell, index) => {
          if (!cell) {
            return <span key={`empty-${index}`} className="calendar-day empty"></span>;
          }

          const available = isDateAvailable(cell);
          const selected = isSelectedDay(cell);

          return (
            <button
              key={`day-${cell}`}
              type="button"
              className={`calendar-day ${available ? 'available' : 'unavailable'} ${selected ? 'selected' : ''}`}
              onClick={() => handleSelectDay(cell)}
              disabled={!available}
              aria-label={available ? `Select ${monthNames[currentMonth]} ${cell}` : `${monthNames[currentMonth]} ${cell} unavailable`}
            >
              {cell}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderStepContent = () => {
    if (step === 1) {
      return (
        <>
          {renderCalendar()}

          <div className="booking-time-panel">
            <div className="booking-form-group">
              <label>Booking Type</label>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <label>
                  <input
                    type="radio"
                    name="bookingType"
                    value="one_day"
                    checked={bookingType === 'one_day'}
                    onChange={() => setBookingType('one_day')}
                  />{' '}
                  One day
                </label>
                <label>
                  <input
                    type="radio"
                    name="bookingType"
                    value="multi_day"
                    checked={bookingType === 'multi_day'}
                    onChange={() => setBookingType('multi_day')}
                  />{' '}
                  Multiple days
                </label>
              </div>
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

            <div className="booking-hint-card" style={{ marginTop: 0 }}>
              <p><strong>Selected:</strong> {formattedSelectedRange}</p>
              <p><strong>Duration:</strong> {durationDays} day(s)</p>
              <p><strong>Daily rate:</strong> {formatMoney(dailyRate)} per day</p>
              <p><strong>Estimated service cost:</strong> {formatMoney(estimatedTotal)}</p>
              <p className="hint-subtext">
                Select available dates only. For multi-day bookings, choose a continuous range.
              </p>
            </div>

            {dateLoading && <p className="booking-subtitle">Loading provider availability...</p>}
          </div>
        </>
      );
    }

    if (step === 2) {
      return (
        <>
          {renderCalendar()}

          <div className="booking-time-panel">
            <p className="time-panel-label">{formattedSelectedRange}</p>
            {slotLoading ? (
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
        </>
      );
    }

    if (step === 3) {
      return (
        <form className="booking-form" onSubmit={(event) => event.preventDefault()}>
          {providerServiceTypes.length > 1 && (
            <div className="booking-form-group">
              <label htmlFor="booking-service-type">Service Type</label>
              <select
                id="booking-service-type"
                className="booking-input"
                value={selectedServiceTypeKey}
                onChange={(event) => setSelectedServiceTypeKey(event.target.value)}
              >
                {providerServiceTypes.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </div>
          )}

          {providerServiceTypes.length === 1 && (
            <div className="booking-form-group">
              <label>Service Type</label>
              <input className="booking-input" value={providerServiceTypes[0].label} readOnly aria-readonly="true" />
            </div>
          )}

          <div className="booking-form-group">
            <label>Job Title</label>
            <input
              className="booking-input"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              placeholder="Example: Pipe leak repair"
            />
          </div>

          <div className="booking-form-group">
            <label>Job Details and Service Location</label>
            <textarea
              className="booking-textarea"
              rows={5}
              value={jobDetails}
              onChange={(event) => setJobDetails(event.target.value)}
              placeholder="Describe the work and include service location details."
            />
          </div>

          <div className="booking-hint-card">
            <p><strong>Booking:</strong> {formattedSelectedRange}</p>
            <p><strong>Time:</strong> {selectedTime || 'Not selected'}</p>
            <p><strong>Estimated:</strong> {formatMoney(estimatedTotal)}</p>
            <p className="hint-subtext">
              The displayed amount is an estimate based on the provider daily rate. Final price may vary depending on scope.
            </p>
            <p className="hint-subtext">
              The provider must accept your request before the booking is confirmed.
            </p>
          </div>
        </form>
      );
    }

    return (
      <div className="booking-success">
        <div className="success-icon">
          <CheckIcon />
        </div>
        <h3>Request sent</h3>
        <p>Your booking request has been submitted successfully.</p>
      </div>
    );
  };

  return (
    <div className="booking-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="booking-modal" onClick={(event) => event.stopPropagation()}>
        <aside className="booking-sidebar">
          <div className="booking-provider-meta">
            <div className="booking-provider-avatar">{initials}</div>
            <p className="booking-provider-profession">{safeProvider.profession}</p>
            <p className="booking-provider-name">{safeProvider.name}</p>
            <p className="booking-provider-location">
              <LocationIcon /> {safeProvider.location}
            </p>
            <p className="booking-provider-bio">{safeProvider.description}</p>
          </div>

          <div className="booking-stepper">
            {timelineStages.map((stage, index) => {
              const Icon = stage.icon;
              const state = index < statusIndex ? 'completed' : index === statusIndex ? 'active' : '';
              return (
                <div key={stage.label} className={`booking-stage ${state}`}>
                  <div className={`stage-indicator ${state}`}>
                    <Icon />
                  </div>
                  <div>
                    <p className="stage-label">{stage.label}</p>
                    <p className="stage-description">{stage.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <section className="booking-content">
          <button className="booking-close" type="button" onClick={onClose} aria-label="Close booking modal">
            X
          </button>

          <div className="booking-header">
            <h2 className="booking-title">Request Service</h2>
            <p className="booking-subtitle">
              {step === 4
                ? 'All set. Feel free to close this window.'
                : step === 3
                  ? 'Review the details before sending your request.'
                  : 'Choose an available schedule to continue.'}
            </p>
          </div>

          <div className={`booking-stage-content ${step <= 2 ? 'two-column' : ''}`}>
            {renderStepContent()}
          </div>

          {submitError && (
            <div className="booking-error" style={{ marginTop: '1rem' }}>
              <i className="bi bi-exclamation-circle"></i> {submitError}
            </div>
          )}

          <div className="booking-actions">
            {step > 1 && step < 4 && (
              <button className="booking-btn booking-btn-outline" type="button" onClick={handlePrev} disabled={submitting}>
                Back
              </button>
            )}

            {step < 4 && (
              <button
                className="booking-btn booking-btn-primary"
                type="button"
                onClick={handleNext}
                disabled={!canProceed() || submitting || dateLoading || slotLoading}
              >
                {submitting ? 'Sending...' : step === 3 ? 'Send Request' : 'Continue'}
              </button>
            )}

            {step === 4 && (
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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { BOOKING_TYPE, SPECIFIC_DATE_BOOKING_ENABLED } from '../../constants/domain';
import { useLanguage } from '../../context/LanguageContext';
import './BookingModal.css';

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

const getDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return [];
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  if (!start || !end || end < start) return [];

  const dates = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    dates.push(formatDateInput(cursor));
  }
  return dates;
};

const formatMoney = (amount) => `₱${Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function BookingModal({ provider, onClose }) {
  const { t, language } = useLanguage();
  const locale = language === 'ceb' ? 'ceb-PH' : 'en-PH';
  const weekdayLabels = useMemo(() => (
    Array.from({ length: 7 }, (_, index) => (
      new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2023, 0, 1 + index))
    ))
  ), [locale]);
  const monthNames = useMemo(() => (
    Array.from({ length: 12 }, (_, index) => (
      new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2023, index, 1))
    ))
  ), [locale]);
  const timelineStages = useMemo(() => ([
    { label: t('bookingTimelineScheduleLabel'), description: t('bookingTimelineScheduleDescription'), icon: CalendarIcon },
    { label: t('bookingTimelineTimeLabel'), description: t('bookingTimelineTimeDescription'), icon: ClockIcon },
    { label: t('bookingTimelineDetailsLabel'), description: t('bookingTimelineDetailsDescription'), icon: UserIcon },
  ]), [t]);
  const [today] = useState(() => new Date());
  const bookingWindowStart = today;
  const bookingWindowEnd = useMemo(() => addDays(today, 60), [today]);

  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [step, setStep] = useState(1);

  const [bookingType, setBookingType] = useState(BOOKING_TYPE.ONE_DAY);
  const [startDate, setStartDate] = useState(formatDateInput(today));
  const [endDate, setEndDate] = useState(formatDateInput(today));
  const [selectedDates, setSelectedDates] = useState([formatDateInput(today)]);
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
  const resolvedBookingDates = useMemo(() => {
    if (bookingType === BOOKING_TYPE.SPECIFIC_DATES) {
      return Array.from(new Set(selectedDates)).sort();
    }
    if (bookingType === BOOKING_TYPE.DATE_RANGE) {
      return getDateRange(startDate, endDate);
    }
    return startDate ? [startDate] : [];
  }, [bookingType, endDate, selectedDates, startDate]);

  const durationDays = resolvedBookingDates.length;
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
    if (bookingType !== BOOKING_TYPE.DATE_RANGE) return true;
    return isRangeContinuous(startDate, endDate);
  }, [bookingType, endDate, isRangeContinuous, startDate]);

  const statusIndex = step >= 4 ? 2 : Math.max(step - 1, 0);

  const safeProvider = {
    name: provider?.name || t('serviceProvider'),
    profession: provider?.profession || provider?.categories?.[0] || provider?.tags?.[0] || t('bookingDefaultProfession'),
    location: provider?.location || 'Toledo City',
    description: provider?.bio || provider?.description || t('bookingDefaultDescription'),
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
    if (bookingType === BOOKING_TYPE.SPECIFIC_DATES) {
      if (resolvedBookingDates.length === 0) return t('bookingNoDatesSelected');
      return resolvedBookingDates
        .map((value) => parseDateInput(value)?.toLocaleDateString(locale, { month: 'short', day: 'numeric' }))
        .filter(Boolean)
        .join(' · ');
    }

    if (!startDate) return t('bookingNoDateSelected');

    const start = parseDateInput(startDate);
    if (!start) return t('bookingNoDateSelected');

    const startLabel = start.toLocaleDateString(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    if (bookingType !== BOOKING_TYPE.DATE_RANGE || !endDate || endDate === startDate) {
      return startLabel;
    }

    const end = parseDateInput(endDate);
    if (!end) return startLabel;

    const endLabel = end.toLocaleDateString(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    return t('bookingDateRangeLabel', { start: startLabel, end: endLabel });
  }, [bookingType, endDate, locale, resolvedBookingDates, startDate, t]);

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
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    const computedPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`;
    }
    body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
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

            setStartDate((prev) => (dates.includes(prev) ? prev : ''));
            setEndDate((prev) => (dates.includes(prev) ? prev : ''));
            setSelectedDates((prev) => prev.filter((value) => dates.includes(value)));

            if (parsedFirstDate) {
              setCurrentMonth(parsedFirstDate.getMonth());
              setCurrentYear(parsedFirstDate.getFullYear());
            }
          } else {
            setStartDate('');
            setEndDate('');
            setSelectedDates([]);
          }
        }
      } catch (error) {
        setAvailableDates([]);
        setStartDate('');
        setEndDate('');
        setSubmitError(error.message || t('bookingLoadDatesFailed'));
      } finally {
        setDateLoading(false);
      }
    };

    loadAvailableDates();
  }, [provider?.id, estimatedDurationMinutes, bookingWindowEnd, bookingWindowStart, t]);

  useEffect(() => {
    if (bookingType === BOOKING_TYPE.ONE_DAY) {
      setEndDate(startDate);
      setSelectedDates(startDate ? [startDate] : []);
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
        : ''
    ));
  }, [providerServiceTypes]);

  useEffect(() => {
    const loadSlots = async () => {
      if (!provider?.id || resolvedBookingDates.length === 0) {
        setAvailableSlots([]);
        setSelectedTime('');
        return;
      }

      if (bookingType === BOOKING_TYPE.DATE_RANGE && !isContinuousMultiDayRange) {
        setAvailableSlots([]);
        setSelectedTime('');
        setSubmitError(t('bookingRangeUnavailable'));
        return;
      }

      setSlotLoading(true);
      setSubmitError('');

      try {
        const response = await serviceProfileAPI.getAvailableSlots(provider.id, {
          date: resolvedBookingDates[0] || startDate,
          endDate: bookingType === BOOKING_TYPE.DATE_RANGE ? endDate : null,
          dates: bookingType === BOOKING_TYPE.SPECIFIC_DATES ? resolvedBookingDates : [],
          bookingType,
          duration: estimatedDurationMinutes,
        });

        if (response.success) {
          const slots = response.data?.slots || [];
          setAvailableSlots(slots);

          setSelectedTime((prevSelected) => (
            slots.some((slot) => slot.time === prevSelected) ? prevSelected : ''
          ));
        }
      } catch (error) {
        setAvailableSlots([]);
        setSelectedTime('');
        setSubmitError(error.message || t('bookingLoadSlotsFailed'));
      } finally {
        setSlotLoading(false);
      }
    };

    loadSlots();
  }, [provider?.id, startDate, endDate, bookingType, estimatedDurationMinutes, isContinuousMultiDayRange, resolvedBookingDates, t]);

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
    if (bookingType === BOOKING_TYPE.SPECIFIC_DATES) {
      return selectedDates.includes(key);
    }

    if (bookingType !== BOOKING_TYPE.DATE_RANGE) {
      return key === startDate;
    }

    if (!endDate) {
      return key === startDate;
    }

    return key >= startDate && key <= endDate;
  }, [bookingType, endDate, getDateKeyForDay, selectedDates, startDate]);

  const handleSelectDay = useCallback((day) => {
    if (!day) return;

    const dateKey = getDateKeyForDay(day);
    if (!availableDateSet.has(dateKey)) {
      return;
    }

    setSubmitError('');

    if (bookingType === BOOKING_TYPE.ONE_DAY) {
      setStartDate(dateKey);
      setEndDate(dateKey);
      setSelectedDates([dateKey]);
      return;
    }

    if (bookingType === BOOKING_TYPE.SPECIFIC_DATES) {
      setSelectedDates((prev) => (
        prev.includes(dateKey)
          ? prev.filter((value) => value !== dateKey)
          : [...prev, dateKey].sort()
      ));
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
      setSubmitError(t('bookingRangeUnavailable'));
      setStartDate(dateKey);
      setEndDate(dateKey);
      return;
    }

    setStartDate(nextStart);
    setEndDate(nextEnd);
  }, [availableDateSet, bookingType, endDate, getDateKeyForDay, isRangeContinuous, startDate, t]);

  const canProceed = () => {
    if (step === 1) {
      if (bookingType === BOOKING_TYPE.SPECIFIC_DATES) return resolvedBookingDates.length > 0;
      if (!startDate) return false;
      if (bookingType !== BOOKING_TYPE.DATE_RANGE) return true;
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
      setSubmitError(t('bookingLoginRequired'));
      return;
    }

    if (!provider?.id || !provider?.userId) {
      setSubmitError(t('bookingProviderIncomplete'));
      return;
    }

    if (!selectedTime) {
      setSubmitError(t('bookingChooseTime'));
      return;
    }

    if (bookingType === BOOKING_TYPE.DATE_RANGE && !isContinuousMultiDayRange) {
      setSubmitError(t('bookingRangeUnavailable'));
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const payload = {
        providerId: provider.userId,
        serviceProfileId: provider.id,
        serviceTypeKey: selectedServiceTypeKey || null,
        bookingType: bookingType === BOOKING_TYPE.DATE_RANGE ? 'multi_day' : bookingType,
        startDate,
        endDate: bookingType === BOOKING_TYPE.DATE_RANGE ? endDate : startDate,
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
      setSubmitError(error.message || t('bookingSubmitFailed'));
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
          aria-label={t('bookingPreviousMonth')}
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
          aria-label={t('bookingNextMonth')}
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
              aria-label={available ? t('bookingSelectDate', { date: `${monthNames[currentMonth]} ${cell}` }) : t('bookingDateUnavailable', { date: `${monthNames[currentMonth]} ${cell}` })}
              aria-pressed={available ? selected : undefined}
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
              <label>{t('bookingTypeLabel')}</label>
              <div className="booking-type-options" aria-describedby="booking-provider-availability-help">
                <label className="booking-type-option">
                  <input
                    type="radio"
                    name="bookingType"
                    value="one_day"
                    checked={bookingType === BOOKING_TYPE.ONE_DAY}
                    onChange={() => setBookingType(BOOKING_TYPE.ONE_DAY)}
                  />{' '}
                  {t('bookingOneDay')}
                </label>
                <label className="booking-type-option">
                  <input
                    type="radio"
                    name="bookingType"
                    value={BOOKING_TYPE.DATE_RANGE}
                    checked={bookingType === BOOKING_TYPE.DATE_RANGE}
                    onChange={() => setBookingType(BOOKING_TYPE.DATE_RANGE)}
                  />{' '}
                  {t('bookingDateRange')}
                </label>
                {SPECIFIC_DATE_BOOKING_ENABLED && (
                  <label className="booking-type-option">
                    <input
                      type="radio"
                      name="bookingType"
                      value={BOOKING_TYPE.SPECIFIC_DATES}
                      checked={bookingType === BOOKING_TYPE.SPECIFIC_DATES}
                      onChange={() => setBookingType(BOOKING_TYPE.SPECIFIC_DATES)}
                    />{' '}
                    {t('bookingSpecificDates')}
                  </label>
                )}
              </div>
            </div>

            <div className="booking-form-group">
              <label htmlFor="booking-duration-minutes">{t('bookingDurationMinutes')}</label>
              <input
                id="booking-duration-minutes"
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
              <p><strong>{t('bookingSelectedLabel')}:</strong> {formattedSelectedRange}</p>
              <p><strong>{t('bookingDurationLabel')}:</strong> {durationDays} {t(durationDays === 1 ? 'bookingDaySingular' : 'bookingDayPlural')}</p>
              <p><strong>{t('bookingDailyRateLabel')}:</strong> {dailyRate > 0 ? t('bookingRatePerDay', { rate: formatMoney(dailyRate) }) : t('priceOnRequest')}</p>
              <p><strong>{t('bookingEstimatedCostLabel')}:</strong> {dailyRate > 0 ? formatMoney(estimatedTotal) : t('priceOnRequest')}</p>
              <p className="hint-subtext" id="booking-provider-availability-help">
                {t('bookingProviderChoiceHelp')}
                {SPECIFIC_DATE_BOOKING_ENABLED && bookingType === BOOKING_TYPE.SPECIFIC_DATES
                  ? ` ${t('bookingSpecificDatesHelp')}`
                  : bookingType === BOOKING_TYPE.DATE_RANGE
                    ? ` ${t('bookingRangeHelp')}`
                    : ''}
              </p>
            </div>

            {dateLoading && <p className="booking-subtitle">{t('bookingLoadingAvailability')}</p>}
          </div>
        </>
      );
    }

    if (step === 2) {
      return (
        <>
          <div className="booking-time-panel">
            <div className="booking-hint-card" style={{ marginTop: 0 }}>
              <p><strong>{t('bookingSelectedLabel')}:</strong> {formattedSelectedRange}</p>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setStep(1)}>
                {t('bookingChangeDate')}
              </button>
            </div>
            {slotLoading ? (
              <p className="booking-subtitle">{t('bookingLoadingSlots')}</p>
            ) : availableSlots.length === 0 ? (
              <p className="booking-subtitle">{t('bookingNoCommonSlots')}</p>
            ) : (
              <div className="time-slots">
                {availableSlots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    className={`time-slot ${selectedTime === slot.time ? 'selected' : ''}`}
                    onClick={() => setSelectedTime(slot.time)}
                    aria-pressed={selectedTime === slot.time}
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
              <label htmlFor="booking-service-type">{t('bookingServiceType')}</label>
              <select
                id="booking-service-type"
                className="booking-input"
                value={selectedServiceTypeKey}
                onChange={(event) => setSelectedServiceTypeKey(event.target.value)}
              >
                <option value="" disabled>{t('bookingChooseServiceType')}</option>
                {providerServiceTypes.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </div>
          )}

          {providerServiceTypes.length === 1 && (
            <div className="booking-form-group">
              <label>{t('bookingServiceType')}</label>
              <input className="booking-input" value={providerServiceTypes[0].label} readOnly aria-readonly="true" />
            </div>
          )}

          <div className="booking-form-group">
            <label htmlFor="booking-job-title">{t('bookingJobTitle')}</label>
            <input
              id="booking-job-title"
              className="booking-input"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              placeholder={t('bookingJobTitlePlaceholder')}
            />
          </div>

          <div className="booking-form-group">
            <label htmlFor="booking-job-details">{t('bookingJobDetailsLocation')}</label>
            <textarea
              id="booking-job-details"
              className="booking-textarea"
              rows={5}
              value={jobDetails}
              onChange={(event) => setJobDetails(event.target.value)}
              placeholder={t('bookingJobDetailsPlaceholder')}
            />
          </div>

          <div className="booking-hint-card">
            <p><strong>{t('bookingSummaryBooking')}:</strong> {formattedSelectedRange}</p>
            <p><strong>{t('bookingSummaryTime')}:</strong> {selectedTime || t('bookingNotSelected')}</p>
            <p><strong>{t('bookingSummaryEstimated')}:</strong> {dailyRate > 0 ? formatMoney(estimatedTotal) : t('priceOnRequest')}</p>
            <p className="hint-subtext">
              {t('bookingEstimateDisclaimer')}
            </p>
            <p className="hint-subtext">
              {t('bookingAcceptanceDisclaimer')}
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
        <h3>{t('bookingRequestSent')}</h3>
        <p>{t('bookingRequestSuccess')}</p>
      </div>
    );
  };

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="booking-overlay" onClick={onClose}>
      <div
        className="booking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
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
          <button className="booking-close" type="button" onClick={onClose} aria-label={t('bookingCloseAria')}>
            X
          </button>

          <div className="booking-header">
            <h2 id="booking-modal-title" className="booking-title">{t('bookingRequestServiceTitle')}</h2>
            <p className="booking-subtitle">
              {step === 4
                ? t('bookingAllSet')
                : step === 3
                  ? t('bookingReviewBeforeSending')
                  : t('bookingChooseSchedule')}
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
                {t('bookingBack')}
              </button>
            )}

            {step < 4 && (
              <button
                className="booking-btn booking-btn-primary"
                type="button"
                onClick={handleNext}
                disabled={!canProceed() || submitting || dateLoading || slotLoading}
              >
                {submitting ? t('bookingSending') : step === 3 ? t('bookingSendRequest') : t('bookingContinue')}
              </button>
            )}

            {step === 4 && (
              <button className="booking-btn booking-btn-primary" type="button" onClick={onClose}>
                {t('bookingClose')}
              </button>
            )}
          </div>
        </section>
      </div>
    </div>,
    document.body
  );
}

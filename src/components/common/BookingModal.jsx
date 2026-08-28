import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DayButton, DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  LocationIcon,
  UserIcon,
} from './Icons';
import { isAuthenticated, serviceProfileAPI, serviceRequestAPI } from '../../services/api';
import { BOOKING_TYPE, SPECIFIC_DATE_BOOKING_ENABLED } from '../../constants/domain';
import { useLanguage } from '../../context/LanguageContext';
import './BookingModal.css';

const BookingRangeInteractionContext = createContext(null);

function BookingRangeDayButton(props) {
  const interaction = useContext(BookingRangeInteractionContext);

  return (
    <DayButton
      {...props}
      onPointerDown={(event) => {
        props.onPointerDown?.(event);
        interaction?.onPointerDown?.(props.day.date, props.modifiers, event);
      }}
      onPointerEnter={(event) => {
        props.onPointerEnter?.(event);
        interaction?.onPointerEnter?.(props.day.date, props.modifiers, event);
      }}
      onPointerUp={(event) => {
        props.onPointerUp?.(event);
        interaction?.onPointerUp?.(props.day.date, props.modifiers, event);
      }}
    />
  );
}

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value) => {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const getDateRange = (startDate, endDate) => {
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  if (!start || !end || end < start) return [];

  const dates = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    dates.push(formatDateInput(cursor));
  }
  return dates;
};

const formatMoney = (amount) => `₱${Number(amount || 0).toLocaleString('en-PH', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})}`;

export default function BookingModal({ provider, onClose }) {
  const { t, language } = useLanguage();
  const locale = language === 'ceb' ? 'ceb-PH' : 'en-PH';
  const [today] = useState(() => new Date());
  const bookingWindowStart = today;
  const bookingWindowEnd = useMemo(() => addDays(today, 60), [today]);

  const [step, setStep] = useState(1);
  const [bookingType, setBookingType] = useState(BOOKING_TYPE.ONE_DAY);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDates, setSelectedDates] = useState([]);
  const [rangeAnchor, setRangeAnchor] = useState('');
  const dragAnchorRef = useRef('');
  const isRangeDraggingRef = useRef(false);
  const rangeDragMovedRef = useRef(false);
  const suppressRangeClickRef = useRef(false);
  const [calendarMonth, setCalendarMonth] = useState(today);
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState(120);

  const [availableDates, setAvailableDates] = useState([]);
  const [dateLoading, setDateLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotLoading, setSlotLoading] = useState(false);

  const [selectedTime, setSelectedTime] = useState('');
  const [selectedServiceTypeKey, setSelectedServiceTypeKey] = useState('');
  const [jobDetails, setJobDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const timelineStages = useMemo(() => ([
    { label: t('bookingTimelineScheduleLabel'), description: t('bookingTimelineScheduleDescription'), icon: CalendarIcon },
    { label: t('bookingTimelineTimeLabel'), description: t('bookingTimelineTimeDescription'), icon: ClockIcon },
    { label: t('bookingTimelineDetailsLabel'), description: t('bookingTimelineDetailsDescription'), icon: UserIcon },
  ]), [t]);

  const providerServiceTypes = useMemo(() => {
    const raw = Array.isArray(provider?.serviceTypes) ? provider.serviceTypes : [];
    return raw.filter((item) => item && item.key && item.label);
  }, [provider?.serviceTypes]);

  const dailyRate = Number(provider?.dailyRate ?? provider?.startingPrice ?? 0);
  const availableDateSet = useMemo(() => new Set(availableDates), [availableDates]);

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
  const estimatedTotal = dailyRate * durationDays;

  const isRangeContinuous = useMemo(() => {
    if (bookingType !== BOOKING_TYPE.DATE_RANGE || !startDate || !endDate) return true;
    const dates = getDateRange(startDate, endDate);
    return dates.length > 0 && dates.every((value) => availableDateSet.has(value));
  }, [availableDateSet, bookingType, endDate, startDate]);

  const safeProvider = {
    name: provider?.name || t('serviceProvider'),
    profession: provider?.profession || provider?.categories?.[0] || provider?.tags?.[0] || t('bookingDefaultProfession'),
    location: provider?.location || 'Toledo City',
    description: provider?.aboutMe || provider?.bio || provider?.description || '',
  };

  const initials = safeProvider.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const formattedSelectedRange = useMemo(() => {
    if (bookingType === BOOKING_TYPE.SPECIFIC_DATES) {
      if (resolvedBookingDates.length === 0) return t('bookingNoDatesSelected');
      return resolvedBookingDates
        .map((value) => parseDateInput(value)?.toLocaleDateString(locale, { month: 'short', day: 'numeric' }))
        .filter(Boolean)
        .join(' · ');
    }

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
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [onClose]);

  useEffect(() => {
    const finishPointerInteraction = () => {
      if (isRangeDraggingRef.current && rangeDragMovedRef.current) {
        suppressRangeClickRef.current = true;
        setRangeAnchor('');
      }
      isRangeDraggingRef.current = false;
      dragAnchorRef.current = '';
      rangeDragMovedRef.current = false;
    };

    window.addEventListener('pointerup', finishPointerInteraction);
    window.addEventListener('pointercancel', finishPointerInteraction);
    return () => {
      window.removeEventListener('pointerup', finishPointerInteraction);
      window.removeEventListener('pointercancel', finishPointerInteraction);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

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

        if (!mounted) return;

        if (response.success) {
          const dates = Array.isArray(response.data?.dates) ? response.data.dates : [];
          setAvailableDates(dates);

          if (dates.length === 0) {
            setStartDate('');
            setEndDate('');
            setSelectedDates([]);
            return;
          }

          const firstAvailable = dates[0];
          const firstAvailableDate = parseDateInput(firstAvailable);
          if (firstAvailableDate) setCalendarMonth(firstAvailableDate);

          setStartDate((current) => (dates.includes(current) ? current : firstAvailable));
          setEndDate((current) => (dates.includes(current) ? current : firstAvailable));
          setSelectedDates((current) => {
            const valid = current.filter((value) => dates.includes(value));
            return valid.length > 0 ? valid : [firstAvailable];
          });
        }
      } catch (error) {
        if (!mounted) return;
        setAvailableDates([]);
        setStartDate('');
        setEndDate('');
        setSelectedDates([]);
        setSubmitError(error.message || t('bookingLoadDatesFailed'));
      } finally {
        if (mounted) setDateLoading(false);
      }
    };

    loadAvailableDates();
    return () => { mounted = false; };
  }, [bookingWindowEnd, bookingWindowStart, estimatedDurationMinutes, provider?.id, t]);

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

    setSelectedServiceTypeKey((current) => (
      providerServiceTypes.some((item) => item.key === current) ? current : ''
    ));
  }, [providerServiceTypes]);

  useEffect(() => {
    let mounted = true;

    const loadSlots = async () => {
      if (!provider?.id || resolvedBookingDates.length === 0) {
        setAvailableSlots([]);
        setSelectedTime('');
        return;
      }

      if (bookingType === BOOKING_TYPE.DATE_RANGE && !isRangeContinuous) {
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

        if (!mounted) return;

        if (response.success) {
          const slots = response.data?.slots || [];
          setAvailableSlots(slots);
          setSelectedTime((current) => (slots.some((slot) => slot.time === current) ? current : ''));
        }
      } catch (error) {
        if (!mounted) return;
        setAvailableSlots([]);
        setSelectedTime('');
        setSubmitError(error.message || t('bookingLoadSlotsFailed'));
      } finally {
        if (mounted) setSlotLoading(false);
      }
    };

    loadSlots();
    return () => { mounted = false; };
  }, [bookingType, endDate, estimatedDurationMinutes, isRangeContinuous, provider?.id, resolvedBookingDates, startDate, t]);

  const applyContinuousRange = (anchorKey, targetKey) => {
    if (!anchorKey || !targetKey) return false;

    const fromKey = anchorKey <= targetKey ? anchorKey : targetKey;
    const toKey = anchorKey <= targetKey ? targetKey : anchorKey;
    const candidateDates = getDateRange(fromKey, toKey);

    if (
      candidateDates.length === 0
      || candidateDates.some((dateKey) => !availableDateSet.has(dateKey))
    ) {
      setSubmitError(t('bookingRangeUnavailable'));
      return false;
    }

    setStartDate(fromKey);
    setEndDate(toKey);
    setSelectedDates(candidateDates);
    setSubmitError('');
    return true;
  };

  const handleRangeDayClick = (date, modifiers = {}) => {
    if (bookingType !== BOOKING_TYPE.DATE_RANGE || modifiers.disabled) return;

    if (suppressRangeClickRef.current) {
      suppressRangeClickRef.current = false;
      return;
    }

    const key = formatDateInput(date);
    setSubmitError('');

    if (!rangeAnchor) {
      setRangeAnchor(key);
      setStartDate(key);
      setEndDate(key);
      setSelectedDates([key]);
      return;
    }

    if (applyContinuousRange(rangeAnchor, key)) {
      setRangeAnchor('');
    }
  };

  const handleRangePointerDown = (date, modifiers = {}, event) => {
    if (
      bookingType !== BOOKING_TYPE.DATE_RANGE
      || modifiers.disabled
      || (typeof event?.button === 'number' && event.button !== 0)
    ) {
      return;
    }

    dragAnchorRef.current = formatDateInput(date);
    isRangeDraggingRef.current = true;
    rangeDragMovedRef.current = false;
  };

  const handleRangePointerEnter = (date, modifiers = {}) => {
    if (
      bookingType !== BOOKING_TYPE.DATE_RANGE
      || !isRangeDraggingRef.current
      || modifiers.disabled
      || !dragAnchorRef.current
    ) {
      return;
    }

    const targetKey = formatDateInput(date);
    if (targetKey === dragAnchorRef.current) return;

    rangeDragMovedRef.current = true;
    applyContinuousRange(dragAnchorRef.current, targetKey);
  };

  const handleRangePointerUp = (date, modifiers = {}) => {
    if (bookingType !== BOOKING_TYPE.DATE_RANGE || !isRangeDraggingRef.current) return;

    if (!modifiers.disabled && rangeDragMovedRef.current && dragAnchorRef.current) {
      applyContinuousRange(dragAnchorRef.current, formatDateInput(date));
      suppressRangeClickRef.current = true;
      setRangeAnchor('');
    }

    isRangeDraggingRef.current = false;
    dragAnchorRef.current = '';
    rangeDragMovedRef.current = false;
  };

  const handleBookingTypeChange = (nextType) => {
    const fallbackDate = availableDates.includes(startDate)
      ? startDate
      : (availableDates[0] || '');

    setBookingType(nextType);
    setSubmitError('');
    setSelectedTime('');
    setRangeAnchor('');
    isRangeDraggingRef.current = false;
    dragAnchorRef.current = '';
    rangeDragMovedRef.current = false;
    suppressRangeClickRef.current = false;

    if (nextType === BOOKING_TYPE.ONE_DAY) {
      setStartDate(fallbackDate);
      setEndDate(fallbackDate);
      setSelectedDates(fallbackDate ? [fallbackDate] : []);
      return;
    }

    setStartDate('');
    setEndDate('');
    setSelectedDates([]);
  };

  const handleCalendarSelect = (value) => {
    setSubmitError('');

    if (bookingType === BOOKING_TYPE.ONE_DAY) {
      const key = value ? formatDateInput(value) : '';
      setStartDate(key);
      setEndDate(key);
      setSelectedDates(key ? [key] : []);
      return;
    }

    if (bookingType === BOOKING_TYPE.SPECIFIC_DATES) {
      const keys = Array.isArray(value) ? value.map(formatDateInput).sort() : [];
      setSelectedDates(keys);
      setStartDate(keys[0] || '');
      setEndDate(keys[keys.length - 1] || '');
      return;
    }

    const fromKey = value?.from ? formatDateInput(value.from) : '';
    const toKey = value?.to ? formatDateInput(value.to) : fromKey;

    if (!fromKey) {
      setStartDate('');
      setEndDate('');
      return;
    }

    const candidateDates = getDateRange(fromKey, toKey);
    if (candidateDates.some((dateKey) => !availableDateSet.has(dateKey))) {
      setStartDate(fromKey);
      setEndDate(fromKey);
      setSubmitError(t('bookingRangeUnavailable'));
      return;
    }

    setStartDate(fromKey);
    setEndDate(toKey);
  };

  const dayPickerMode = bookingType === BOOKING_TYPE.ONE_DAY
    ? 'single'
    : bookingType === BOOKING_TYPE.SPECIFIC_DATES
      ? 'multiple'
      : undefined;

  const selectedForCalendar = bookingType === BOOKING_TYPE.ONE_DAY
    ? parseDateInput(startDate)
    : bookingType === BOOKING_TYPE.SPECIFIC_DATES
      ? selectedDates.map(parseDateInput).filter(Boolean)
      : undefined;

  const rangeModifiers = bookingType === BOOKING_TYPE.DATE_RANGE
    ? {
        selected: (date) => {
          const key = formatDateInput(date);
          return Boolean(startDate && endDate && key >= startDate && key <= endDate);
        },
        range_start: (date) => Boolean(startDate && formatDateInput(date) === startDate),
        range_end: (date) => Boolean(endDate && formatDateInput(date) === endDate),
        range_middle: (date) => {
          const key = formatDateInput(date);
          return Boolean(startDate && endDate && key > startDate && key < endDate);
        },
      }
    : {};

  const canProceed = () => {
    if (step === 1) {
      if (bookingType === BOOKING_TYPE.SPECIFIC_DATES) return resolvedBookingDates.length > 0;
      if (!startDate) return false;
      if (bookingType !== BOOKING_TYPE.DATE_RANGE) return true;
      return Boolean(endDate) && isRangeContinuous;
    }

    if (step === 2) return Boolean(selectedTime);

    if (step === 3) {
      const hasValidServiceTypeSelection = providerServiceTypes.length <= 1 || Boolean(selectedServiceTypeKey);
      return hasValidServiceTypeSelection && jobDetails.trim().length > 0;
    }

    return true;
  };

  const handleNext = async () => {
    if (step < 3) {
      setStep((current) => Math.min(current + 1, 4));
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

    if (bookingType === BOOKING_TYPE.DATE_RANGE && !isRangeContinuous) {
      setSubmitError(t('bookingRangeUnavailable'));
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const response = await serviceRequestAPI.createRequest({
        providerId: provider.userId,
        serviceProfileId: provider.id,
        serviceTypeKey: selectedServiceTypeKey || null,
        bookingType,
        dates: resolvedBookingDates,
        startDate: resolvedBookingDates[0] || startDate,
        endDate: resolvedBookingDates[resolvedBookingDates.length - 1] || endDate || startDate,
        startTime: selectedTime,
        scheduledDate: startDate,
        scheduledTime: selectedTime,
        estimatedDurationMinutes: Number(estimatedDurationMinutes),
        jobDetails: jobDetails.trim(),
      });

      if (response.success) setStep(4);
    } catch (error) {
      setSubmitError(error.message || t('bookingSubmitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const renderCalendar = () => (
    <div className="booking-calendar booking-day-picker">
      <div className="booking-calendar-intro">
        <div>
          <span className="booking-calendar-kicker">{t('bookingSelectedLabel')}</span>
          <strong>{formattedSelectedRange}</strong>
        </div>
        <div className="booking-calendar-legend" aria-label="Calendar legend">
          <span><i className="available-dot"></i> Available</span>
          <span><i className="selected-dot"></i> Selected</span>
        </div>
      </div>

      <BookingRangeInteractionContext.Provider
        value={bookingType === BOOKING_TYPE.DATE_RANGE ? {
          onPointerDown: handleRangePointerDown,
          onPointerEnter: handleRangePointerEnter,
          onPointerUp: handleRangePointerUp,
        } : null}
      >
      <DayPicker
        mode={dayPickerMode}
        selected={selectedForCalendar}
        onSelect={bookingType === BOOKING_TYPE.DATE_RANGE ? undefined : handleCalendarSelect}
        onDayClick={bookingType === BOOKING_TYPE.DATE_RANGE ? handleRangeDayClick : undefined}
        components={{ DayButton: BookingRangeDayButton }}
        month={calendarMonth}
        onMonthChange={setCalendarMonth}
        startMonth={bookingWindowStart}
        endMonth={bookingWindowEnd}
        disabled={(date) => !availableDateSet.has(formatDateInput(date))}
        modifiers={{
          available: (date) => availableDateSet.has(formatDateInput(date)),
          ...rangeModifiers,
        }}
        modifiersClassNames={{
          available: 'rdp-available',
          selected: 'rdp-selected',
          range_start: 'rdp-range_start',
          range_middle: 'rdp-range_middle',
          range_end: 'rdp-range_end',
        }}
        showOutsideDays
        fixedWeeks
        animate
      />
      </BookingRangeInteractionContext.Provider>

      {dateLoading && (
        <div className="booking-calendar-loading" role="status">
          <span className="spinner-small"></span>
          <span>{t('bookingLoadingAvailability')}</span>
        </div>
      )}
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
                    onChange={() => handleBookingTypeChange(BOOKING_TYPE.ONE_DAY)}
                  />
                  <span>{t('bookingOneDay')}</span>
                </label>
                <label className="booking-type-option">
                  <input
                    type="radio"
                    name="bookingType"
                    value={BOOKING_TYPE.DATE_RANGE}
                    checked={bookingType === BOOKING_TYPE.DATE_RANGE}
                    onChange={() => handleBookingTypeChange(BOOKING_TYPE.DATE_RANGE)}
                  />
                  <span>{t('bookingDateRange')}</span>
                </label>
                {SPECIFIC_DATE_BOOKING_ENABLED && (
                  <label className="booking-type-option">
                    <input
                      type="radio"
                      name="bookingType"
                      value={BOOKING_TYPE.SPECIFIC_DATES}
                      checked={bookingType === BOOKING_TYPE.SPECIFIC_DATES}
                      onChange={() => handleBookingTypeChange(BOOKING_TYPE.SPECIFIC_DATES)}
                    />
                    <span>{t('bookingSpecificDates')}</span>
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
          </div>
        </>
      );
    }

    if (step === 2) {
      return (
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
            <p className="hint-subtext">{t('bookingEstimateDisclaimer')}</p>
            <p className="hint-subtext">{t('bookingAcceptanceDisclaimer')}</p>
          </div>
        </form>
      );
    }

    return (
      <div className="booking-success">
        <div className="success-icon"><CheckIcon /></div>
        <h3>{t('bookingRequestSent')}</h3>
        <p>{t('bookingRequestSuccess')}</p>
      </div>
    );
  };

  if (typeof document === 'undefined') return null;

  const statusIndex = step >= 4 ? 2 : Math.max(step - 1, 0);

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
            <p className="booking-provider-location"><LocationIcon /> {safeProvider.location}</p>
            {safeProvider.description && (
              <p className="booking-provider-bio">{safeProvider.description}</p>
            )}
          </div>

          <div className="booking-stepper">
            {timelineStages.map((stage, index) => {
              const Icon = stage.icon;
              const state = index < statusIndex ? 'completed' : index === statusIndex ? 'active' : '';
              return (
                <div key={stage.label} className={`booking-stage ${state}`}>
                  <div className={`stage-indicator ${state}`}><Icon /></div>
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
          <button className="booking-close" type="button" onClick={onClose} aria-label={t('bookingCloseAria')}>×</button>

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
              <button className="booking-btn booking-btn-outline" type="button" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={submitting}>
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
    document.body,
  );
}

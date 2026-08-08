import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const getPricingUnitLabel = (pricingUnit) => {
  const normalized = String(pricingUnit || 'per_day').toLowerCase();
  if (normalized === 'per_job') return 'per job';
  if (normalized === 'per_hour') return 'per hour';
  return 'per day';
};

const calculateEstimatedTotal = ({ pricingUnit, baseRate, durationDays, durationMinutes }) => {
  const rate = Number(baseRate || 0);
  const days = Number(durationDays || 0);
  const minutes = Number(durationMinutes || 0);
  const normalizedUnit = String(pricingUnit || 'per_day').toLowerCase();

  if (!Number.isFinite(rate) || rate <= 0) return 0;
  if (normalizedUnit === 'per_job') return rate;
  if (normalizedUnit === 'per_hour') {
    const totalHours = (minutes / 60) * Math.max(1, days);
    return Number((rate * totalHours).toFixed(2));
  }
  return Number((rate * Math.max(1, days)).toFixed(2));
};

export default function BookingModal({ provider, onClose }) {
  const bookingWindow = useMemo(() => {
    const providerMaxAdvance = Number(provider?.maxAdvanceBookingDays);
    const normalizedMaxAdvance = Number.isFinite(providerMaxAdvance)
      ? Math.min(Math.max(Math.round(providerMaxAdvance), 1), 180)
      : 60;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = addDays(start, normalizedMaxAdvance);

    return {
      startDate: start,
      endDate: end,
      fromDate: formatDateInput(start),
      toDate: formatDateInput(end),
    };
  }, [provider?.maxAdvanceBookingDays]);

  const [currentMonth, setCurrentMonth] = useState(bookingWindow.startDate.getMonth());
  const [currentYear, setCurrentYear] = useState(bookingWindow.startDate.getFullYear());
  const [step, setStep] = useState(1);

  const [bookingType, setBookingType] = useState('one_day');
  const [startDate, setStartDate] = useState(bookingWindow.fromDate);
  const [endDate, setEndDate] = useState(bookingWindow.fromDate);
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState(120);
  const [debouncedDurationMinutes, setDebouncedDurationMinutes] = useState(120);

  const [availableDatesByMonth, setAvailableDatesByMonth] = useState({});
  const [dateLoading, setDateLoading] = useState(false);
  const [dateError, setDateError] = useState('');
  const [dateReloadToken, setDateReloadToken] = useState(0);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [slotError, setSlotError] = useState('');
  const [slotReloadToken, setSlotReloadToken] = useState(0);

  const [selectedTime, setSelectedTime] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDetails, setJobDetails] = useState('');

  const [dragAnchorDate, setDragAnchorDate] = useState('');
  const [dragPreviewDate, setDragPreviewDate] = useState('');
  const [isDraggingRange, setIsDraggingRange] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const dateRequestSequenceRef = useRef(0);
  const slotRequestSequenceRef = useRef(0);
  const suppressDayClickRef = useRef(false);
  const startDateRef = useRef(startDate);
  const endDateRef = useRef(endDate);
  const bookingTypeRef = useRef(bookingType);

  const rateValue = Number(provider?.dailyRate ?? provider?.startingPrice ?? 0);
  const pricingUnit = String(provider?.pricingUnit || 'per_day').toLowerCase();
  const pricingUnitLabel = getPricingUnitLabel(pricingUnit);
  const normalizedDurationMinutes = useMemo(() => {
    const duration = Number(estimatedDurationMinutes || 0);
    if (!Number.isFinite(duration)) return 0;
    return Math.max(30, Math.min(1440, Math.round(duration)));
  }, [estimatedDurationMinutes]);

  const durationDays = useMemo(() => {
    if (!startDate) return 0;
    return getDurationDays(startDate, bookingType === 'multi_day' ? endDate : startDate);
  }, [bookingType, endDate, startDate]);
  const estimatedTotal = useMemo(() => (
    calculateEstimatedTotal({
      pricingUnit,
      baseRate: rateValue,
      durationDays,
      durationMinutes: normalizedDurationMinutes,
    })
  ), [durationDays, normalizedDurationMinutes, pricingUnit, rateValue]);

  const currentMonthKey = useMemo(
    () => `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`,
    [currentMonth, currentYear],
  );

  const availableDateSet = useMemo(() => {
    const dateSet = new Set();
    Object.values(availableDatesByMonth).forEach((dates) => {
      (Array.isArray(dates) ? dates : []).forEach((date) => dateSet.add(date));
    });
    return dateSet;
  }, [availableDatesByMonth]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedDurationMinutes(normalizedDurationMinutes);
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [normalizedDurationMinutes]);

  useEffect(() => {
    startDateRef.current = startDate;
    endDateRef.current = endDate;
    bookingTypeRef.current = bookingType;
  }, [bookingType, endDate, startDate]);

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

  const activeRange = useMemo(() => {
    if (bookingType !== 'multi_day') {
      return {
        start: startDate,
        end: startDate,
        preview: false,
      };
    }

    if (isDraggingRange && dragAnchorDate && dragPreviewDate) {
      return {
        start: dragPreviewDate < dragAnchorDate ? dragPreviewDate : dragAnchorDate,
        end: dragPreviewDate < dragAnchorDate ? dragAnchorDate : dragPreviewDate,
        preview: true,
      };
    }

    return {
      start: startDate,
      end: endDate || startDate,
      preview: false,
    };
  }, [bookingType, dragAnchorDate, dragPreviewDate, endDate, isDraggingRange, startDate]);

  const isContinuousMultiDayRange = useMemo(() => {
    if (bookingType !== 'multi_day') return true;
    return isRangeContinuous(startDate, endDate);
  }, [bookingType, endDate, isRangeContinuous, startDate]);

  const statusIndex = step >= 4 ? 2 : Math.max(step - 1, 0);

  const safeProvider = {
    name: provider?.name || 'Service Provider',
    profession: provider?.profession || provider?.tags?.[0] || 'Community Services',
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
    const selectedStart = activeRange.start;
    const selectedEnd = activeRange.end;

    if (!selectedStart) return 'No date selected';

    const start = parseDateInput(selectedStart);
    if (!start) return 'No date selected';

    const startLabel = start.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    if (bookingType !== 'multi_day' || !selectedEnd || selectedEnd === selectedStart) {
      return startLabel;
    }

    const end = parseDateInput(selectedEnd);
    if (!end) return startLabel;

    const endLabel = end.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    const suffix = activeRange.preview ? ' (preview)' : '';
    return `${startLabel} to ${endLabel}${suffix}`;
  }, [activeRange.end, activeRange.preview, activeRange.start, bookingType]);

  const canGoToPrevMonth = useMemo(() => {
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    return prevYear > bookingWindow.startDate.getFullYear()
      || (prevYear === bookingWindow.startDate.getFullYear() && prevMonth >= bookingWindow.startDate.getMonth());
  }, [bookingWindow.startDate, currentMonth, currentYear]);

  const canGoToNextMonth = useMemo(() => {
    return currentYear < bookingWindow.endDate.getFullYear()
      || (currentYear === bookingWindow.endDate.getFullYear() && currentMonth < bookingWindow.endDate.getMonth());
  }, [bookingWindow.endDate, currentMonth, currentYear]);

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
        setAvailableDatesByMonth({});
        setDateError('');
        return;
      }

      const monthStart = new Date(currentYear, currentMonth, 1);
      const monthEnd = new Date(currentYear, currentMonth + 1, 0);
      const boundedStart = monthStart < bookingWindow.startDate ? bookingWindow.startDate : monthStart;
      const boundedEnd = monthEnd > bookingWindow.endDate ? bookingWindow.endDate : monthEnd;

      if (boundedEnd < boundedStart) {
        setAvailableDatesByMonth((prev) => ({
          ...prev,
          [currentMonthKey]: [],
        }));
        return;
      }

      const requestSequence = ++dateRequestSequenceRef.current;
      setDateLoading(true);
      setDateError('');

      try {
        const response = await serviceProfileAPI.getAvailableDates(provider.id, {
          fromDate: formatDateInput(boundedStart),
          toDate: formatDateInput(boundedEnd),
          duration: debouncedDurationMinutes,
        });

        if (requestSequence !== dateRequestSequenceRef.current) {
          return;
        }

        if (response.success) {
          const dates = Array.isArray(response.data?.dates) ? response.data.dates : [];
          setAvailableDatesByMonth((prev) => ({
            ...prev,
            [currentMonthKey]: dates,
          }));

          if (dates.length > 0) {
            const firstDate = dates[0];
            const parsedFirstDate = parseDateInput(firstDate);
            const hasCurrentStartDate = startDateRef.current && dates.includes(startDateRef.current);
            const nextDate = hasCurrentStartDate ? startDateRef.current : firstDate;
            const nextEndDate = bookingTypeRef.current === 'multi_day' && endDateRef.current && dates.includes(endDateRef.current)
              ? endDateRef.current
              : nextDate;

            setStartDate(nextDate);
            setEndDate(nextEndDate);

            if (!hasCurrentStartDate && parsedFirstDate) {
              setCurrentMonth(parsedFirstDate.getMonth());
              setCurrentYear(parsedFirstDate.getFullYear());
            }
          }
        }
      } catch (error) {
        if (requestSequence !== dateRequestSequenceRef.current) {
          return;
        }

        setAvailableDatesByMonth((prev) => ({
          ...prev,
          [currentMonthKey]: [],
        }));
        setDateError(error.message || 'Unable to load available dates.');
      } finally {
        if (requestSequence === dateRequestSequenceRef.current) {
          setDateLoading(false);
        }
      }
    };

    loadAvailableDates();
  }, [
    bookingWindow.endDate,
    bookingWindow.startDate,
    currentMonth,
    currentMonthKey,
    currentYear,
    debouncedDurationMinutes,
    provider?.id,
    dateReloadToken,
  ]);

  useEffect(() => {
    if (bookingType === 'one_day') {
      setEndDate(startDate);
      setDragAnchorDate('');
      setDragPreviewDate('');
      setIsDraggingRange(false);
    }
  }, [bookingType, startDate]);

  useEffect(() => {
    const loadSlots = async () => {
      if (!provider?.id || !startDate) {
        setAvailableSlots([]);
        setSelectedTime('');
        setSlotError('');
        return;
      }

      if (bookingType === 'multi_day' && !isContinuousMultiDayRange) {
        setAvailableSlots([]);
        setSelectedTime('');
        setSlotError('Selected date range has unavailable day(s). Please choose a continuous available range.');
        return;
      }

      const requestSequence = ++slotRequestSequenceRef.current;
      setSlotLoading(true);
      setSlotError('');

      try {
        const response = await serviceProfileAPI.getAvailableSlots(provider.id, {
          date: startDate,
          endDate: bookingType === 'multi_day' ? endDate : null,
          bookingType,
          duration: debouncedDurationMinutes,
        });

        if (requestSequence !== slotRequestSequenceRef.current) {
          return;
        }

        if (response.success) {
          const slots = response.data?.slots || [];
          setAvailableSlots(slots);

          setSelectedTime((prevSelected) => {
            if (slots.length === 0) return '';
            return slots.some((slot) => slot.time === prevSelected) ? prevSelected : slots[0].time;
          });
        }
      } catch (error) {
        if (requestSequence !== slotRequestSequenceRef.current) {
          return;
        }

        setAvailableSlots([]);
        setSelectedTime('');
        setSlotError(error.message || 'Unable to load available time slots.');
      } finally {
        if (requestSequence === slotRequestSequenceRef.current) {
          setSlotLoading(false);
        }
      }
    };

    loadSlots();
  }, [provider?.id, startDate, endDate, bookingType, debouncedDurationMinutes, isContinuousMultiDayRange, slotReloadToken]);

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
    if (!day || !activeRange.start) return false;

    const key = getDateKeyForDay(day);
    if (bookingType !== 'multi_day') {
      return key === activeRange.start;
    }

    return key >= activeRange.start && key <= activeRange.end;
  }, [activeRange.end, activeRange.start, bookingType, getDateKeyForDay]);

  const getRangeClassForDay = useCallback((day) => {
    if (!day || bookingType !== 'multi_day' || !activeRange.start) {
      return '';
    }

    const key = getDateKeyForDay(day);
    if (key < activeRange.start || key > activeRange.end) {
      return '';
    }

    if (activeRange.start === activeRange.end) {
      return 'selected';
    }

    if (key === activeRange.start) {
      return `range-start ${activeRange.preview ? 'range-preview-edge' : ''}`.trim();
    }

    if (key === activeRange.end) {
      return `range-end ${activeRange.preview ? 'range-preview-edge' : ''}`.trim();
    }

    return activeRange.preview ? 'in-range range-preview' : 'in-range';
  }, [activeRange.end, activeRange.preview, activeRange.start, bookingType, getDateKeyForDay]);

  const commitDraggedRange = useCallback((targetDate) => {
    if (!dragAnchorDate || !targetDate) {
      setIsDraggingRange(false);
      return;
    }

    const nextStart = targetDate < dragAnchorDate ? targetDate : dragAnchorDate;
    const nextEnd = targetDate < dragAnchorDate ? dragAnchorDate : targetDate;

    if (!isRangeContinuous(nextStart, nextEnd)) {
      setSubmitError('');
      setSlotError('Selected date range has unavailable day(s). Please choose a continuous available range.');
      setStartDate(nextStart);
      setEndDate(nextStart);
    } else {
      setSlotError('');
      setStartDate(nextStart);
      setEndDate(nextEnd);
    }

    setIsDraggingRange(false);
    setDragAnchorDate('');
    setDragPreviewDate('');
    suppressDayClickRef.current = true;
  }, [dragAnchorDate, isRangeContinuous]);

  useEffect(() => {
    if (!isDraggingRange) {
      return undefined;
    }

    const handleMouseUp = () => {
      const fallbackTarget = dragPreviewDate || dragAnchorDate;
      commitDraggedRange(fallbackTarget);
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [commitDraggedRange, dragAnchorDate, dragPreviewDate, isDraggingRange]);

  const handleSelectDay = useCallback((day) => {
    if (!day) return;

    if (suppressDayClickRef.current) {
      suppressDayClickRef.current = false;
      return;
    }

    const dateKey = getDateKeyForDay(day);
    if (!availableDateSet.has(dateKey)) {
      return;
    }

    setSubmitError('');
    setSlotError('');

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
      setSlotError('Selected date range has unavailable day(s). Please choose a continuous available range.');
      setStartDate(dateKey);
      setEndDate(dateKey);
      return;
    }

    setStartDate(nextStart);
    setEndDate(nextEnd);
  }, [availableDateSet, bookingType, endDate, getDateKeyForDay, isRangeContinuous, startDate]);

  const handleDayMouseDown = useCallback((day) => {
    if (bookingType !== 'multi_day' || !day) {
      return;
    }

    const dateKey = getDateKeyForDay(day);
    if (!availableDateSet.has(dateKey)) {
      return;
    }

    setSubmitError('');
    setSlotError('');
    setDragAnchorDate(dateKey);
    setDragPreviewDate(dateKey);
    setIsDraggingRange(true);
  }, [availableDateSet, bookingType, getDateKeyForDay]);

  const handleDayMouseEnter = useCallback((day) => {
    if (!isDraggingRange || bookingType !== 'multi_day' || !day) {
      return;
    }

    const dateKey = getDateKeyForDay(day);
    if (availableDateSet.has(dateKey)) {
      setDragPreviewDate(dateKey);
    }
  }, [availableDateSet, bookingType, getDateKeyForDay, isDraggingRange]);

  const handleDayMouseUp = useCallback((day) => {
    if (!isDraggingRange || bookingType !== 'multi_day' || !day) {
      return;
    }

    const dateKey = getDateKeyForDay(day);
    if (availableDateSet.has(dateKey)) {
      commitDraggedRange(dateKey);
    } else {
      commitDraggedRange(dragPreviewDate || dragAnchorDate);
    }
  }, [availableDateSet, bookingType, commitDraggedRange, dragAnchorDate, dragPreviewDate, getDateKeyForDay, isDraggingRange]);

  const getProceedState = () => {
    if (step === 1) {
      if (dateLoading) return { enabled: false, reason: 'Loading available dates...' };
      if (dateError) return { enabled: false, reason: 'Fix date availability loading first.' };
      if (!startDate) return { enabled: false, reason: 'Select an available date to continue.' };
      if (bookingType !== 'multi_day') return { enabled: true, reason: '' };
      if (!endDate) return { enabled: false, reason: 'Select an end date to continue.' };
      if (!isContinuousMultiDayRange) return { enabled: false, reason: 'Choose a continuous available date range.' };
      return { enabled: true, reason: '' };
    }

    if (step === 2) {
      if (slotLoading) return { enabled: false, reason: 'Loading available time slots...' };
      if (slotError) return { enabled: false, reason: 'Fix slot availability loading first.' };
      if (availableSlots.length === 0) return { enabled: false, reason: 'No slots available for this schedule.' };
      if (!selectedTime) return { enabled: false, reason: 'Pick a time slot to continue.' };
      return { enabled: true, reason: '' };
    }

    if (step === 3) {
      if (jobTitle.trim().length === 0) {
        return { enabled: false, reason: 'Add a job title to continue.' };
      }
      if (jobDetails.trim().length === 0) {
        return { enabled: false, reason: 'Add job details to continue.' };
      }
      return { enabled: true, reason: '' };
    }

    return { enabled: true, reason: '' };
  };

  const proceedState = getProceedState();

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
        bookingType,
        startDate,
        endDate: bookingType === 'multi_day' ? endDate : startDate,
        startTime: selectedTime,
        scheduledDate: startDate,
        scheduledTime: selectedTime,
        estimatedDurationMinutes: Number(normalizedDurationMinutes),
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
          const rangeClass = available ? getRangeClassForDay(cell) : '';

          return (
            <button
              key={`day-${cell}`}
              type="button"
              className={`calendar-day ${available ? 'available' : 'unavailable'} ${selected ? 'selected' : ''} ${rangeClass}`}
              onMouseDown={() => handleDayMouseDown(cell)}
              onMouseEnter={() => handleDayMouseEnter(cell)}
              onMouseUp={() => handleDayMouseUp(cell)}
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
                onBlur={() => setEstimatedDurationMinutes(normalizedDurationMinutes)}
              />
            </div>

            <div className="booking-hint-card" style={{ marginTop: 0 }}>
              <p><strong>Selected:</strong> {formattedSelectedRange}</p>
              <p><strong>Duration:</strong> {durationDays} day(s)</p>
              <p><strong>Rate:</strong> {formatMoney(rateValue)} {pricingUnitLabel}</p>
              <p><strong>Estimated service cost:</strong> {formatMoney(estimatedTotal)}</p>
              <p className="hint-subtext">
                Select available dates only. For multi-day bookings, click two dates or drag to preview and set a continuous range.
              </p>
            </div>

            {dateLoading && <p className="booking-subtitle">Loading provider availability...</p>}
            {dateError && (
              <div className="booking-inline-error">
                <p>{dateError}</p>
                <button
                  type="button"
                  className="booking-inline-retry"
                  onClick={() => setDateReloadToken((prev) => prev + 1)}
                >
                  Retry loading dates
                </button>
              </div>
            )}
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

            {slotError && (
              <div className="booking-inline-error">
                <p>{slotError}</p>
                <button
                  type="button"
                  className="booking-inline-retry"
                  onClick={() => setSlotReloadToken((prev) => prev + 1)}
                >
                  Retry loading slots
                </button>
              </div>
            )}
          </div>
        </>
      );
    }

    if (step === 3) {
      return (
        <form className="booking-form" onSubmit={(event) => event.preventDefault()}>
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
              The displayed amount is an estimate based on the provider pricing unit. Final price may vary depending on scope.
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
                disabled={!proceedState.enabled || submitting}
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

          {!proceedState.enabled && step < 4 && !submitting && (
            <p className="booking-action-hint">{proceedState.reason}</p>
          )}
        </section>
      </div>
    </div>
  );
}

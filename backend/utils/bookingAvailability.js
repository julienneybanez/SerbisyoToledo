const BLOCKING_STATUSES = ['accepted', 'on_the_way', 'in_progress'];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

const formatDateOnly = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toSqlTime = (hours, minutes) => `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

const normalizeSqlTimeString = (value) => {
  if (!value) return null;

  const str = String(value).trim();

  if (/^\d{2}:\d{2}:\d{2}$/.test(str)) {
    return str;
  }

  if (/^\d{2}:\d{2}$/.test(str)) {
    return `${str}:00`;
  }

  return null;
};

const parseTimeInputToSql = (value) => {
  if (!value) return null;

  const str = String(value).trim();
  const normalized = normalizeSqlTimeString(str);
  if (normalized) {
    return normalized;
  }

  // 12-hour input such as "9:00 AM"
  const match12h = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match12h) {
    return null;
  }

  let hour = Number(match12h[1]);
  const minute = Number(match12h[2]);
  const period = match12h[3].toUpperCase();

  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    return null;
  }

  if (period === 'AM') {
    if (hour === 12) hour = 0;
  } else if (hour !== 12) {
    hour += 12;
  }

  return toSqlTime(hour, minute);
};

const timeToMinutes = (sqlTime) => {
  const time = normalizeSqlTimeString(sqlTime);
  if (!time) return null;

  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const minutesToSqlTime = (totalMinutes) => {
  const safeMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return toSqlTime(hours, minutes);
};

const calculateDurationDays = (startDate, endDate) => {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (!start || !end) return null;

  const diffDays = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  return diffDays > 0 ? diffDays : null;
};

const dateRangeOverlaps = (existingStart, existingEnd, requestedStart, requestedEnd) => {
  return existingStart <= requestedEnd && existingEnd >= requestedStart;
};

const timeRangesOverlap = (existingStartMinutes, existingEndMinutes, requestedStartMinutes, requestedEndMinutes) => {
  return existingStartMinutes < requestedEndMinutes && existingEndMinutes > requestedStartMinutes;
};

const dayOfWeekFromDate = (dateString) => {
  const date = parseDateOnly(dateString);
  if (!date) return null;
  return date.getUTCDay();
};

const ensureAvailabilitySettings = async (connection, serviceProfileId) => {
  const [existing] = await connection.query(
    `SELECT id, allow_same_day_booking, min_advance_notice_minutes, max_advance_booking_days
     FROM provider_availability_settings
     WHERE service_profile_id = ?
     LIMIT 1`,
    [serviceProfileId]
  );

  if (existing.length > 0) {
    return existing[0];
  }

  await connection.query(
    `INSERT INTO provider_availability_settings
     (service_profile_id, allow_same_day_booking, min_advance_notice_minutes, max_advance_booking_days)
     VALUES (?, FALSE, 720, 60)`,
    [serviceProfileId]
  );

  return {
    allow_same_day_booking: 0,
    min_advance_notice_minutes: 720,
    max_advance_booking_days: 60,
  };
};

const getConfirmedBookingsForDate = async (connection, providerId, dateString, excludeRequestId = null) => {
  const params = [providerId, dateString, dateString, ...BLOCKING_STATUSES];
  let sql = `
    SELECT id, start_date, end_date, start_time, estimated_duration_minutes, scheduled_date, scheduled_time
    FROM service_requests
    WHERE provider_id = ?
      AND COALESCE(start_date, scheduled_date) <= ?
      AND COALESCE(end_date, scheduled_date) >= ?
      AND status IN (?, ?, ?)`;

  if (excludeRequestId != null) {
    sql += ' AND id <> ?';
    params.push(excludeRequestId);
  }

  const [rows] = await connection.query(sql, params);
  return rows;
};

const isExceptionBlockingWholeDay = (exception) => {
  const type = String(exception.exception_type || '').toLowerCase();
  const hasTimeBlock = Boolean(exception.start_time && exception.end_time);
  return ['unavailable', 'booked', 'vacation'].includes(type) && !hasTimeBlock;
};

const getAvailabilityWindowsForDate = async (connection, serviceProfileId, dateString) => {
  const dayOfWeek = dayOfWeekFromDate(dateString);
  if (dayOfWeek == null) {
    return [];
  }

  const [weeklyRows] = await connection.query(
    `SELECT start_time, end_time, is_available
     FROM provider_weekly_availability
     WHERE service_profile_id = ? AND day_of_week = ?
     ORDER BY start_time ASC`,
    [serviceProfileId, dayOfWeek]
  );

  let windows = weeklyRows
    .filter((row) => Boolean(row.is_available))
    .map((row) => ({
      startMinutes: timeToMinutes(row.start_time),
      endMinutes: timeToMinutes(row.end_time),
    }))
    .filter((row) => row.startMinutes != null && row.endMinutes != null && row.endMinutes > row.startMinutes);

  const [exceptions] = await connection.query(
    `SELECT start_time, end_time, exception_type
     FROM provider_availability_exceptions
     WHERE service_profile_id = ? AND exception_date = ?
     ORDER BY start_time ASC`,
    [serviceProfileId, dateString]
  );

  if (exceptions.some(isExceptionBlockingWholeDay)) {
    return [];
  }

  const specificAvailable = exceptions
    .filter((row) => String(row.exception_type).toLowerCase() === 'available' && row.start_time && row.end_time)
    .map((row) => ({
      startMinutes: timeToMinutes(row.start_time),
      endMinutes: timeToMinutes(row.end_time),
    }))
    .filter((row) => row.startMinutes != null && row.endMinutes != null && row.endMinutes > row.startMinutes);

  if (specificAvailable.length > 0) {
    windows = specificAvailable;
  }

  // Subtract explicit unavailable windows.
  const unavailableWindows = exceptions
    .filter((row) => ['unavailable', 'vacation', 'booked'].includes(String(row.exception_type).toLowerCase()) && row.start_time && row.end_time)
    .map((row) => ({
      startMinutes: timeToMinutes(row.start_time),
      endMinutes: timeToMinutes(row.end_time),
    }))
    .filter((row) => row.startMinutes != null && row.endMinutes != null && row.endMinutes > row.startMinutes);

  if (unavailableWindows.length === 0) {
    return windows;
  }

  const result = [];

  for (const window of windows) {
    let segments = [window];

    for (const blocked of unavailableWindows) {
      const nextSegments = [];

      for (const segment of segments) {
        if (blocked.endMinutes <= segment.startMinutes || blocked.startMinutes >= segment.endMinutes) {
          nextSegments.push(segment);
          continue;
        }

        if (blocked.startMinutes > segment.startMinutes) {
          nextSegments.push({
            startMinutes: segment.startMinutes,
            endMinutes: blocked.startMinutes,
          });
        }

        if (blocked.endMinutes < segment.endMinutes) {
          nextSegments.push({
            startMinutes: blocked.endMinutes,
            endMinutes: segment.endMinutes,
          });
        }
      }

      segments = nextSegments;
    }

    result.push(...segments.filter((segment) => segment.endMinutes > segment.startMinutes));
  }

  return result;
};

const checkScheduleConflict = async (
  connection,
  {
    providerId,
    requestedStartDate,
    requestedEndDate,
    requestedStartTime,
    requestedDurationMinutes,
    excludeRequestId = null,
  }
) => {
  const requestedStart = parseDateOnly(requestedStartDate);
  const requestedEnd = parseDateOnly(requestedEndDate);

  if (!requestedStart || !requestedEnd) {
    return { conflict: true, reason: 'Invalid schedule range' };
  }

  const [rows] = await connection.query(
    `SELECT id, booking_type, status,
            COALESCE(start_date, scheduled_date) AS effective_start_date,
            COALESCE(end_date, scheduled_date) AS effective_end_date,
            COALESCE(start_time, NULL) AS effective_start_time,
            estimated_duration_minutes,
            scheduled_time
     FROM service_requests
     WHERE provider_id = ?
       AND COALESCE(start_date, scheduled_date) <= ?
       AND COALESCE(end_date, scheduled_date) >= ?
       AND status IN (?, ?, ?)
       ${excludeRequestId != null ? 'AND id <> ?' : ''}`,
    excludeRequestId != null
      ? [providerId, requestedEndDate, requestedStartDate, ...BLOCKING_STATUSES, excludeRequestId]
      : [providerId, requestedEndDate, requestedStartDate, ...BLOCKING_STATUSES]
  );

  const requestStartMinutes = timeToMinutes(requestedStartTime);
  const requestDuration = Number(requestedDurationMinutes || 0);
  const requestEndMinutes = requestStartMinutes != null && requestDuration > 0
    ? requestStartMinutes + requestDuration
    : null;

  for (const row of rows) {
    const existingStart = parseDateOnly(row.effective_start_date);
    const existingEnd = parseDateOnly(row.effective_end_date);

    if (!existingStart || !existingEnd) {
      continue;
    }

    const existingStartIso = formatDateOnly(existingStart);
    const existingEndIso = formatDateOnly(existingEnd);
    const requestedStartIso = formatDateOnly(requestedStart);
    const requestedEndIso = formatDateOnly(requestedEnd);

    if (!dateRangeOverlaps(existingStartIso, existingEndIso, requestedStartIso, requestedEndIso)) {
      continue;
    }

    const existingStartTime = parseTimeInputToSql(row.effective_start_time || row.scheduled_time);
    const existingStartMinutes = timeToMinutes(existingStartTime);
    const existingDuration = Number(row.estimated_duration_minutes || 0);
    const existingEndMinutes = existingStartMinutes != null && existingDuration > 0
      ? existingStartMinutes + existingDuration
      : null;

    const bothSingleDay = existingStartIso === existingEndIso && requestedStartIso === requestedEndIso;
    const sameDay = existingStartIso === requestedStartIso;

    if (bothSingleDay && sameDay && existingStartMinutes != null && existingEndMinutes != null && requestStartMinutes != null && requestEndMinutes != null) {
      if (timeRangesOverlap(existingStartMinutes, existingEndMinutes, requestStartMinutes, requestEndMinutes)) {
        return { conflict: true, conflictRequestId: row.id };
      }
      continue;
    }

    // Any overlapping date range conflicts for multi-day or unknown-time bookings.
    return { conflict: true, conflictRequestId: row.id };
  }

  return { conflict: false };
};

const getAvailableSlotsForDate = async (
  connection,
  {
    serviceProfileId,
    providerId,
    date,
    durationMinutes,
    slotStepMinutes = 60,
    excludeRequestId = null,
  }
) => {
  const normalizedDate = formatDateOnly(parseDateOnly(date));
  const windows = await getAvailabilityWindowsForDate(connection, serviceProfileId, normalizedDate);
  if (windows.length === 0) {
    return [];
  }

  const settings = await ensureAvailabilitySettings(connection, serviceProfileId);

  const now = new Date();
  const dayStartUtc = parseDateOnly(normalizedDate);
  const dayDiff = Math.floor((dayStartUtc.getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / MS_PER_DAY);

  if (dayDiff < 0) {
    return [];
  }

  const allowSameDay = Boolean(settings.allow_same_day_booking);
  if (!allowSameDay && dayDiff === 0) {
    return [];
  }

  const maxAdvanceDays = Number(settings.max_advance_booking_days || 60);
  if (dayDiff > maxAdvanceDays) {
    return [];
  }

  const duration = Number(durationMinutes || 0);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 24 * 60) {
    return [];
  }

  const bookings = await getConfirmedBookingsForDate(connection, providerId, normalizedDate, excludeRequestId);

  const bookingRanges = bookings.map((row) => {
    const parsed = parseTimeInputToSql(row.start_time || row.scheduled_time);
    const startMinutes = timeToMinutes(parsed);
    const bookingDuration = Number(row.estimated_duration_minutes || 0);

    if (startMinutes == null || bookingDuration <= 0) {
      return { fullDay: true };
    }

    return {
      fullDay: false,
      startMinutes,
      endMinutes: startMinutes + bookingDuration,
    };
  });

  const minAdvanceMinutes = Number(settings.min_advance_notice_minutes || 0);

  const slots = [];

  for (const window of windows) {
    for (let start = window.startMinutes; start + duration <= window.endMinutes; start += slotStepMinutes) {
      const end = start + duration;

      const slotDate = new Date(Date.UTC(
        dayStartUtc.getUTCFullYear(),
        dayStartUtc.getUTCMonth(),
        dayStartUtc.getUTCDate(),
        Math.floor(start / 60),
        start % 60,
        0,
        0
      ));

      const diffMinutes = Math.floor((slotDate.getTime() - now.getTime()) / (60 * 1000));
      if (diffMinutes < minAdvanceMinutes) {
        continue;
      }

      const hasConflict = bookingRanges.some((range) => {
        if (range.fullDay) return true;
        return timeRangesOverlap(range.startMinutes, range.endMinutes, start, end);
      });

      if (!hasConflict) {
        slots.push({
          time: minutesToSqlTime(start),
          endTime: minutesToSqlTime(end),
        });
      }
    }
  }

  return slots;
};

module.exports = {
  BLOCKING_STATUSES,
  parseDateOnly,
  formatDateOnly,
  parseTimeInputToSql,
  timeToMinutes,
  minutesToSqlTime,
  calculateDurationDays,
  checkScheduleConflict,
  ensureAvailabilitySettings,
  getAvailabilityWindowsForDate,
  getAvailableSlotsForDate,
};

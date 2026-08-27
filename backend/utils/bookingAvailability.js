const BLOCKING_STATUSES = ['accepted', 'on_the_way', 'in_progress'];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const requestDatesTableSupport = new WeakMap();

const supportsRequestDatesTable = async (connection) => {
  if (!connection || typeof connection.query !== 'function') {
    return false;
  }

  if (requestDatesTableSupport.has(connection)) {
    return requestDatesTableSupport.get(connection);
  }

  try {
    const [rows] = await connection.query(
      `SELECT COUNT(*) AS table_count
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_name = 'service_request_dates'`
    );
    const supported = Number(rows?.[0]?.table_count || 0) > 0;
    requestDatesTableSupport.set(connection, supported);
    return supported;
  } catch {
    requestDatesTableSupport.set(connection, false);
    return false;
  }
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

const getDurationMinutesFromScheduledTimestamps = (startValue, endValue) => {
  const start = startValue instanceof Date ? startValue : new Date(startValue);
  const end = endValue instanceof Date ? endValue : new Date(endValue);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  const diffMinutes = Math.round((end.getTime() - start.getTime()) / (60 * 1000));
  return diffMinutes > 0 ? diffMinutes : 0;
};

const getEffectiveBookingDurationMinutes = (row = {}) => {
  // A multi-day request repeats the same service duration on each selected date.
  // Never infer a per-day duration from scheduled_start_at -> scheduled_end_at,
  // because that span may cover several calendar days.
  const fromEstimate = Number(row.estimated_duration_minutes || 0);
  if (Number.isFinite(fromEstimate) && fromEstimate > 0) {
    return fromEstimate;
  }

  const fromTimestamps = getDurationMinutesFromScheduledTimestamps(row.scheduled_start_at, row.scheduled_end_at);
  return fromTimestamps > 0 ? fromTimestamps : 0;
};

const ensureAvailabilitySchema = async (connection) => {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS provider_availability_settings (
      id INT PRIMARY KEY AUTO_INCREMENT,
      service_profile_id INT NOT NULL UNIQUE,
      allow_same_day_booking BOOLEAN NOT NULL DEFAULT FALSE,
      min_advance_notice_minutes INT NOT NULL DEFAULT 720,
      max_advance_booking_days INT NOT NULL DEFAULT 60,
      availability_status VARCHAR(255) NOT NULL DEFAULT 'available',
      show_availability_status BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS provider_weekly_availability (
      id INT PRIMARY KEY AUTO_INCREMENT,
      service_profile_id INT NOT NULL,
      day_of_week TINYINT NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE,
      UNIQUE KEY uniq_provider_weekly_block (service_profile_id, day_of_week, start_time, end_time)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS provider_availability_exceptions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      service_profile_id INT NOT NULL,
      exception_date DATE NOT NULL,
      start_time TIME NULL,
      end_time TIME NULL,
      exception_type ENUM('available', 'unavailable', 'booked', 'vacation') NOT NULL,
      reason VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE,
      INDEX idx_provider_exception_lookup (service_profile_id, exception_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
};

const ensureAvailabilitySettings = async (connection, serviceProfileId) => {
  await ensureAvailabilitySchema(connection);

  const [existing] = await connection.query(
    `SELECT id,
            allow_same_day_booking,
            min_advance_notice_minutes,
            max_advance_booking_days,
            availability_status,
            show_availability_status
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
     (
       service_profile_id,
       allow_same_day_booking,
       min_advance_notice_minutes,
       max_advance_booking_days,
       availability_status,
       show_availability_status
     )
     VALUES (?, FALSE, 720, 60, 'available', TRUE)`,
    [serviceProfileId]
  );

  return {
    allow_same_day_booking: 0,
    min_advance_notice_minutes: 720,
    max_advance_booking_days: 60,
    availability_status: 'available',
    show_availability_status: 1,
  };
};

const getConfirmedBookingsForDate = async (connection, providerId, dateString, excludeRequestId = null) => {
  const exactDateStorage = await supportsRequestDatesTable(connection);
  const params = [providerId, dateString, ...BLOCKING_STATUSES];

  let sql;

  if (exactDateStorage) {
    sql = `
      SELECT sr.id,
             sr.start_time,
             sr.estimated_duration_minutes,
             sr.scheduled_start_at,
             sr.scheduled_end_at
      FROM service_requests sr
      JOIN service_request_dates srd ON srd.service_request_id = sr.id
      WHERE sr.provider_id = ?
        AND srd.service_date = ?
        AND sr.status IN (?, ?, ?)`;
  } else {
    params.splice(2, 0, dateString);
    sql = `
      SELECT sr.id,
             sr.start_time,
             sr.estimated_duration_minutes,
             sr.scheduled_start_at,
             sr.scheduled_end_at
      FROM service_requests sr
      WHERE sr.provider_id = ?
        AND COALESCE(sr.start_date, DATE(sr.scheduled_start_at)) <= ?
        AND COALESCE(sr.end_date, DATE(sr.scheduled_end_at)) >= ?
        AND sr.status IN (?, ?, ?)`;
  }

  if (excludeRequestId != null) {
    sql += ' AND sr.id <> ?';
    params.push(excludeRequestId);
  }

  const [rows] = await connection.query(sql, params);
  return rows;
};

const getBookingRowStartTime = (row = {}) => {
  const explicit = parseTimeInputToSql(row.start_time);
  if (explicit) return explicit;

  if (row.scheduled_start_at instanceof Date) {
    const hh = String(row.scheduled_start_at.getUTCHours()).padStart(2, '0');
    const mm = String(row.scheduled_start_at.getUTCMinutes()).padStart(2, '0');
    const ss = String(row.scheduled_start_at.getUTCSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  if (typeof row.scheduled_start_at === 'string' && row.scheduled_start_at.length >= 16) {
    return parseTimeInputToSql(row.scheduled_start_at.slice(11, 19));
  }

  return null;
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
      // Exact provider-selected availability should surface as one client-facing
      // start-time option, rather than being expanded into hourly starts.
      explicitStartOnly: true,
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

        // A provider-selected exact slot is atomic. If a blocking window overlaps
        // it, remove the option rather than inventing a new start time.
        if (segment.explicitStartOnly) {
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

const checkScheduleConflictForDates = async (
  connection,
  {
    providerId,
    dates,
    requestedStartTime,
    requestedDurationMinutes,
    excludeRequestId = null,
  }
) => {
  const normalizedDates = normalizeBookingDates({
    bookingType: 'specific_dates',
    dates,
  });
  const normalizedStartTime = parseTimeInputToSql(requestedStartTime);
  const requestStartMinutes = timeToMinutes(normalizedStartTime);
  const requestDuration = Number(requestedDurationMinutes || 0);
  const requestEndMinutes = requestStartMinutes != null && requestDuration > 0
    ? requestStartMinutes + requestDuration
    : null;

  if (normalizedDates.length === 0 || requestStartMinutes == null || requestEndMinutes == null) {
    return { conflict: true, reason: 'Invalid booking dates, time, or duration' };
  }

  for (const date of normalizedDates) {
    const rows = await getConfirmedBookingsForDate(
      connection,
      providerId,
      date,
      excludeRequestId
    );

    for (const row of rows) {
      const existingStartMinutes = timeToMinutes(getBookingRowStartTime(row));
      const existingDuration = getEffectiveBookingDurationMinutes(row);
      const existingEndMinutes = existingStartMinutes != null && existingDuration > 0
        ? existingStartMinutes + existingDuration
        : null;

      // Unknown stored timing is treated conservatively as occupied.
      if (existingStartMinutes == null || existingEndMinutes == null) {
        return { conflict: true, conflictRequestId: row.id, date };
      }

      if (timeRangesOverlap(
        existingStartMinutes,
        existingEndMinutes,
        requestStartMinutes,
        requestEndMinutes
      )) {
        return { conflict: true, conflictRequestId: row.id, date };
      }
    }
  }

  return { conflict: false };
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
  const dates = normalizeBookingDates({
    bookingType: 'date_range',
    startDate: requestedStartDate,
    endDate: requestedEndDate || requestedStartDate,
  });

  return checkScheduleConflictForDates(connection, {
    providerId,
    dates,
    requestedStartTime,
    requestedDurationMinutes,
    excludeRequestId,
  });
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
  const parsedDate = parseDateOnly(date);
  if (!parsedDate) {
    return [];
  }

  const normalizedDate = formatDateOnly(parsedDate);
  const settings = await ensureAvailabilitySettings(connection, serviceProfileId);

  if (String(settings.availability_status || 'available').toLowerCase() === 'unavailable') {
    return [];
  }

  const windows = await getAvailabilityWindowsForDate(connection, serviceProfileId, normalizedDate);
  if (windows.length === 0) {
    return [];
  }

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
    const startMinutes = timeToMinutes(getBookingRowStartTime(row));
    const bookingDuration = getEffectiveBookingDurationMinutes(row);

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
    const candidateStarts = window.explicitStartOnly
      ? [window.startMinutes]
      : (() => {
          const starts = [];
          for (let start = window.startMinutes; start + duration <= window.endMinutes; start += slotStepMinutes) {
            starts.push(start);
          }
          return starts;
        })();

    for (const start of candidateStarts) {
      const end = start + duration;
      if (end > window.endMinutes) {
        continue;
      }

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

const normalizeBookingDates = ({ bookingType = 'one_day', startDate, endDate, dates = [] } = {}) => {
  const normalizedType = String(bookingType || 'one_day').trim().toLowerCase();

  if (normalizedType === 'specific_dates') {
    return Array.from(new Set(
      (Array.isArray(dates) ? dates : [])
        .map((value) => String(value || '').trim())
        .filter((value) => parseDateOnly(value))
    )).sort();
  }

  const parsedStart = parseDateOnly(startDate);
  if (!parsedStart) return [];

  if (normalizedType !== 'date_range' && normalizedType !== 'multi_day') {
    return [formatDateOnly(parsedStart)];
  }

  const parsedEnd = parseDateOnly(endDate || startDate);
  if (!parsedEnd || parsedEnd < parsedStart) return [];

  const result = [];
  for (const cursor = new Date(parsedStart); cursor <= parsedEnd; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    result.push(formatDateOnly(cursor));
  }
  return result;
};

const intersectSlotsByTime = (slotsByDate = []) => {
  const normalized = Array.isArray(slotsByDate)
    ? slotsByDate.filter((slots) => Array.isArray(slots))
    : [];

  if (normalized.length === 0 || normalized.some((slots) => slots.length === 0)) {
    return [];
  }

  const commonTimes = new Set(normalized[0].map((slot) => slot.time));
  for (const slots of normalized.slice(1)) {
    const times = new Set(slots.map((slot) => slot.time));
    for (const time of Array.from(commonTimes)) {
      if (!times.has(time)) commonTimes.delete(time);
    }
  }

  return normalized[0].filter((slot) => commonTimes.has(slot.time));
};

const getCommonAvailableSlotsForDates = async (
  connection,
  {
    serviceProfileId,
    providerId,
    dates,
    durationMinutes,
    slotStepMinutes = 60,
    excludeRequestId = null,
  }
) => {
  const normalizedDates = normalizeBookingDates({
    bookingType: 'specific_dates',
    dates,
  });

  if (normalizedDates.length === 0) {
    return [];
  }

  const slotsByDate = [];
  for (const date of normalizedDates) {
    const slots = await getAvailableSlotsForDate(connection, {
      serviceProfileId,
      providerId,
      date,
      durationMinutes,
      slotStepMinutes,
      excludeRequestId,
    });
    slotsByDate.push(slots);
    if (slots.length === 0) {
      return [];
    }
  }

  return intersectSlotsByTime(slotsByDate);
};

const isScheduleAvailableForDates = async (
  connection,
  {
    serviceProfileId,
    providerId,
    dates,
    startTime,
    durationMinutes,
    excludeRequestId = null,
  }
) => {
  const normalizedStartTime = parseTimeInputToSql(startTime);
  const normalizedDuration = Number(durationMinutes || 0);
  const normalizedDates = Array.from(new Set(
    (Array.isArray(dates) ? dates : [])
      .map((value) => String(value || '').trim())
      .filter((value) => parseDateOnly(value))
  )).sort();

  if (!normalizedStartTime || normalizedDates.length === 0) {
    return { available: false, reason: 'invalid_dates', message: 'Invalid booking dates or start time.' };
  }

  if (!Number.isInteger(normalizedDuration) || normalizedDuration <= 0 || normalizedDuration > 24 * 60) {
    return { available: false, reason: 'invalid_duration', message: 'Invalid booking duration.' };
  }

  for (const date of normalizedDates) {
    const slots = await getAvailableSlotsForDate(connection, {
      serviceProfileId,
      providerId,
      date,
      durationMinutes: normalizedDuration,
      slotStepMinutes: 60,
      excludeRequestId,
    });

    if (!slots.some((slot) => slot.time === normalizedStartTime)) {
      return {
        available: false,
        reason: 'slot_unavailable',
        date,
        message: `The selected time is not available on ${date}.`,
      };
    }
  }

  return { available: true };
};

const isScheduleAvailableForRange = async (
  connection,
  {
    serviceProfileId,
    providerId,
    startDate,
    endDate,
    startTime,
    durationMinutes,
    excludeRequestId = null,
  }
) => {
  const parsedStart = parseDateOnly(startDate);
  const parsedEnd = parseDateOnly(endDate);
  const normalizedStartTime = parseTimeInputToSql(startTime);
  const normalizedDuration = Number(durationMinutes || 0);

  if (!parsedStart || !parsedEnd || parsedEnd < parsedStart || !normalizedStartTime) {
    return {
      available: false,
      reason: 'invalid_range',
      message: 'Invalid booking schedule range.',
    };
  }

  if (!Number.isInteger(normalizedDuration) || normalizedDuration <= 0 || normalizedDuration > 24 * 60) {
    return {
      available: false,
      reason: 'invalid_duration',
      message: 'Invalid booking duration.',
    };
  }

  const settings = await ensureAvailabilitySettings(connection, serviceProfileId);

  if (String(settings.availability_status || 'available').toLowerCase() === 'unavailable') {
    return {
      available: false,
      reason: 'provider_unavailable',
      message: 'This service provider is currently unavailable for new bookings.',
    };
  }

  // Backward compatibility: if a provider has not configured any weekly windows
  // or date exceptions yet, keep legacy behavior and allow schedule creation.
  await ensureAvailabilitySchema(connection);
  const [availabilityConfigRows] = await connection.query(
    `SELECT
       (SELECT COUNT(*) FROM provider_weekly_availability WHERE service_profile_id = ?) AS weekly_count,
       (SELECT COUNT(*) FROM provider_availability_exceptions WHERE service_profile_id = ?) AS exception_count`,
    [serviceProfileId, serviceProfileId]
  );

  const availabilityConfig = availabilityConfigRows[0] || {};
  const weeklyCount = Number(availabilityConfig.weekly_count || 0);
  const exceptionCount = Number(availabilityConfig.exception_count || 0);

  if (weeklyCount === 0 && exceptionCount === 0) {
    return {
      available: true,
      reason: 'availability_not_configured',
    };
  }

  for (let cursor = new Date(parsedStart); cursor <= parsedEnd; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = formatDateOnly(cursor);
    const slots = await getAvailableSlotsForDate(connection, {
      serviceProfileId,
      providerId,
      date,
      durationMinutes: normalizedDuration,
      slotStepMinutes: 60,
      excludeRequestId,
    });

    if (!slots.some((slot) => slot.time === normalizedStartTime)) {
      return {
        available: false,
        reason: 'slot_unavailable',
        date,
        message: `The selected time is not available on ${date}.`,
      };
    }
  }

  return {
    available: true,
  };
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
  checkScheduleConflictForDates,
  supportsRequestDatesTable,
  ensureAvailabilitySettings,
  getAvailabilityWindowsForDate,
  getAvailableSlotsForDate,
  normalizeBookingDates,
  intersectSlotsByTime,
  getCommonAvailableSlotsForDates,
  isScheduleAvailableForDates,
  isScheduleAvailableForRange,
};

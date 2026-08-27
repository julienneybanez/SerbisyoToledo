// @ts-check

export const USER_ROLE = Object.freeze({
  CLIENT: 'client',
  PROVIDER: 'tradesperson',
  ADMIN: 'admin',
});

export const USER_ROLES = Object.freeze(Object.values(USER_ROLE));

export const REQUEST_STATUS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  ON_THE_WAY: 'on_the_way',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
});

export const BOOKING_TYPE = Object.freeze({
  ONE_DAY: 'one_day',
  DATE_RANGE: 'date_range',
  SPECIFIC_DATES: 'specific_dates',
});

// Specific-date selection is now part of the canonical booking contract.
// Persistence becomes fully active as soon as the service_request_dates
// database migration is applied; the backend refuses to silently flatten dates.
export const SPECIFIC_DATE_BOOKING_ENABLED = true;

/** @param {unknown} value */
export const isUserRole = (value) => (
  typeof value === 'string' && USER_ROLES.includes(value)
);

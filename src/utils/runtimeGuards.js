// @ts-check

import { isUserRole } from '../constants/domain';

/** @param {unknown} value */
export const isRecord = (value) => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

/**
 * Normalize the user object persisted in localStorage.
 * Numeric-string IDs from older sessions are accepted but normalized to numbers.
 *
 * @param {unknown} value
 * @returns {(Record<string, unknown> & { id: number, userType: string }) | null}
 */
export const normalizeStoredUser = (value) => {
  if (!isRecord(value)) return null;

  const id = Number(value.id);
  if (!Number.isInteger(id) || id <= 0 || !isUserRole(value.userType)) {
    return null;
  }

  return {
    ...value,
    id,
    userType: value.userType,
  };
};

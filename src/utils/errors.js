// @ts-check

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, code?: string | null, errors?: unknown[] }} [options]
   */
  constructor(message, { status = 0, code = null, errors = [] } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = Array.isArray(errors) ? errors : [];
  }
}

/**
 * @param {unknown} error
 * @param {string} fallback
 */
export const getErrorMessage = (error, fallback) => {
  if (error instanceof Error && error.message) return error.message;

  if (
    error
    && typeof error === 'object'
    && 'message' in error
    && typeof error.message === 'string'
    && error.message
  ) {
    return error.message;
  }

  return fallback;
};

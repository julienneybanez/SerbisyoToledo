// @ts-check

/**
 * Documentation-only contracts for the current JavaScript codebase.
 * These remain JSDoc so runtime behavior and the build stack stay JavaScript-only.
 */

/** @typedef {'client' | 'tradesperson' | 'admin'} UserRole */

/**
 * @typedef {Object} CurrentUser
 * @property {number} id
 * @property {string} fullName
 * @property {string} email
 * @property {UserRole} userType
 * @property {string | null | undefined} profileImage
 * @property {boolean | undefined} isVerified
 * @property {boolean | undefined} emailVerified
 */

/**
 * @typedef {Object} ServiceProfileDTO
 * @property {number} id
 * @property {number} userId
 * @property {string} name
 * @property {string | null} location
 * @property {number | null} startingPrice
 * @property {string} pricingUnit
 * @property {string | null} description
 * @property {number | null} rating
 * @property {number} reviews
 * @property {string[]} categories
 * @property {Array<{key: string, label: string}>} serviceTypes
 * @property {string[]} skills
 */

/**
 * Current request endpoints still expose database-style snake_case fields.
 * This remains documented as-is until the later dedicated DTO-normalization refactor.
 *
 * @typedef {Object} ServiceRequestDTO
 * @property {number} id
 * @property {string} status
 * @property {string} job_title
 * @property {string} job_details
 * @property {string | null} start_date
 * @property {string | null} end_date
 * @property {string | null} start_time
 * @property {string | undefined} provider_name
 * @property {string | undefined} client_name
 * @property {boolean | number | undefined} provider_completed
 * @property {boolean | number | undefined} client_completed
 */

/**
 * @template T
 * @typedef {Object} ApiEnvelope
 * @property {boolean} success
 * @property {T} [data]
 * @property {string} [message]
 * @property {string | null} [code]
 */

export {};

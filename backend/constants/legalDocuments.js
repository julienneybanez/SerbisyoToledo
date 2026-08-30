// Server-authoritative legal document versions and consent registries.
// The browser must never decide which version is authoritative — it may
// only display these values; the backend always writes from here.
const TERMS_VERSION = '1.0';
const PRIVACY_NOTICE_VERSION = '1.0';
const VERIFICATION_CONSENT_VERSION = '1.0';

const LEGAL_ACCEPTANCE_TYPES = Object.freeze({
  TERMS: 'terms',
  PRIVACY_NOTICE: 'privacy_notice',
  VERIFICATION_DATA_CONSENT: 'verification_data_consent',
});

const LEGAL_CONTEXTS = Object.freeze({
  REGISTRATION: 'registration',
  PROVIDER_VERIFICATION: 'provider_verification',
});

const LEGAL_ACCEPTANCE_TYPE_VALUES = new Set(Object.values(LEGAL_ACCEPTANCE_TYPES));
const LEGAL_CONTEXT_VALUES = new Set(Object.values(LEGAL_CONTEXTS));

module.exports = {
  TERMS_VERSION,
  PRIVACY_NOTICE_VERSION,
  VERIFICATION_CONSENT_VERSION,
  LEGAL_ACCEPTANCE_TYPES,
  LEGAL_CONTEXTS,
  LEGAL_ACCEPTANCE_TYPE_VALUES,
  LEGAL_CONTEXT_VALUES,
};

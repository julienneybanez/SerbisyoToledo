// Canonical notification type registry. notifications.type is VARCHAR(64) —
// this list is the single source of truth, replacing the old growing ENUM.
const NOTIFICATION_TYPES = Object.freeze({
  REQUEST_RECEIVED: 'request_received',
  REQUEST_ACCEPTED: 'request_accepted',
  REQUEST_DECLINED: 'request_declined',
  REQUEST_CANCELLED: 'request_cancelled',
  PROVIDER_ON_WAY: 'provider_on_way',
  SERVICE_COMPLETED: 'service_completed',
  COMPLETION_CONFIRMED: 'completion_confirmed',
  REVIEW_RECEIVED: 'review_received',
  VERIFICATION_APPROVED: 'verification_approved',
  VERIFICATION_REJECTED: 'verification_rejected',
  CREDENTIAL_APPROVED: 'credential_approved',
  CREDENTIAL_REJECTED: 'credential_rejected',
  CREDENTIAL_EXPIRED: 'credential_expired',
  RESCHEDULE_PROPOSED: 'reschedule_proposed',
  RESCHEDULE_ACCEPTED: 'reschedule_accepted',
  RESCHEDULE_DECLINED: 'reschedule_declined',
  MESSAGE_RECEIVED: 'message_received',
  PHONE_SHARE_REQUESTED: 'phone_share_requested',
  PHONE_SHARED: 'phone_shared',
  PHONE_SHARE_DECLINED: 'phone_share_declined',
});

const NOTIFICATION_TYPE_VALUES = new Set(Object.values(NOTIFICATION_TYPES));

const isValidNotificationType = (type) => NOTIFICATION_TYPE_VALUES.has(String(type || ''));

module.exports = {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_VALUES,
  isValidNotificationType,
};

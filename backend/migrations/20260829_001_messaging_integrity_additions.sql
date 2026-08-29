-- Additive communication/integrity migration for the messaging pass.
-- This is intentionally not the later full SerbisyoToledo schema redesign.

START TRANSACTION;

-- Plain "ADD COLUMN IF NOT EXISTS" was rejected as a syntax error against the
-- target MySQL instance, so this uses the portable information_schema/PREPARE
-- idiom instead to stay idempotent across MySQL versions.
SET @service_location_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'service_requests' AND column_name = 'service_location'
);
SET @service_location_ddl = IF(
  @service_location_exists > 0,
  'SELECT 1',
  'ALTER TABLE service_requests ADD COLUMN service_location VARCHAR(500) DEFAULT NULL'
);
PREPARE service_location_stmt FROM @service_location_ddl;
EXECUTE service_location_stmt;
DEALLOCATE PREPARE service_location_stmt;

ALTER TABLE reviews
  MODIFY COLUMN rating DECIMAL(2,1) NOT NULL;

ALTER TABLE verification_requests
  MODIFY COLUMN certifications_data LONGBLOB NULL,
  MODIFY COLUMN certifications_mime VARCHAR(100) NULL;

CREATE TABLE IF NOT EXISTS conversations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  service_request_id INT NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_conversation_request
    FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
  INDEX idx_conversation_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  conversation_id INT NOT NULL,
  sender_id INT NOT NULL,
  message_text VARCHAR(2000) NOT NULL,
  read_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_message_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_message_sender
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_message_conversation_created (conversation_id, created_at),
  INDEX idx_message_unread (conversation_id, read_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_request_contact_shares (
  id INT PRIMARY KEY AUTO_INCREMENT,
  service_request_id INT NOT NULL,
  requester_id INT NOT NULL,
  owner_user_id INT NOT NULL,
  contact_type ENUM('phone') NOT NULL DEFAULT 'phone',
  status ENUM('pending','shared','declined','revoked') NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_contact_share_request
    FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_contact_share_requester
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_contact_share_owner
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY uniq_request_contact_direction (service_request_id, requester_id, owner_user_id, contact_type),
  INDEX idx_contact_share_owner_status (owner_user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_request_archives (
  service_request_id INT NOT NULL,
  user_id INT NOT NULL,
  archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (service_request_id, user_id),
  CONSTRAINT fk_archive_request
    FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_archive_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE notifications
  MODIFY COLUMN type ENUM(
    'request_received','request_accepted','request_declined','request_cancelled',
    'provider_on_way','service_completed','completion_confirmed','review_received',
    'verification_approved','verification_rejected',
    'credential_approved','credential_rejected','credential_expired',
    'reschedule_proposed','reschedule_accepted','reschedule_declined',
    'discussion_requested','discussion_accepted','phone_revealed',
    'message_received','phone_share_requested','phone_shared','phone_share_declined'
  ) NOT NULL;

COMMIT;

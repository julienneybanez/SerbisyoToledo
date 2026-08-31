-- ============================================================================
-- SerbisyoToledo — Canonical Baseline Schema (Database Design V3.1)
-- ============================================================================
-- Target: MySQL 9.4, InnoDB, utf8mb4 / utf8mb4_unicode_ci.
-- Must run inside an ALREADY-SELECTED, already-empty schema. Deliberately
-- contains no CREATE DATABASE / DROP DATABASE / USE statement so it works
-- under a restricted per-database MySQL user (e.g. Railway's grant model).
-- Every table declares its own ENGINE/CHARSET/COLLATE so the schema is
-- self-describing regardless of the target database's own defaults.
-- ============================================================================

SET NAMES utf8mb4;

-- ----------------------------------------------------------------------------
-- 1. users
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id                          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  full_name                   VARCHAR(255)     NOT NULL,
  email                       VARCHAR(255)     NOT NULL,
  password                    VARCHAR(255)     NOT NULL,
  user_type                   ENUM('client','tradesperson','admin') NOT NULL DEFAULT 'client',
  phone                       VARCHAR(20)      NULL,
  address                     TEXT             NULL,
  bio                         TEXT             NULL,
  profession                  VARCHAR(255)     NULL,
  profile_photo_url           VARCHAR(500)     NULL,
  profile_photo_public_id     VARCHAR(255)     NULL,
  -- Compatibility columns: active code still reads these as a fallback for
  -- accounts photographed before the Cloudinary migration and still writes
  -- NULL to them whenever a canonical profile_photo_url is saved. Do not
  -- remove without first removing every backend read/write reference.
  profile_image                VARCHAR(500)     NULL,
  profile_photo                LONGBLOB         NULL,
  is_verified                 BOOLEAN          NOT NULL DEFAULT FALSE,
  is_active                   BOOLEAN          NOT NULL DEFAULT TRUE,
  email_verified              BOOLEAN          NOT NULL DEFAULT FALSE,
  verification_token          VARCHAR(255)     NULL,
  verification_token_expires  TIMESTAMP        NULL,
  is_online                   BOOLEAN          NOT NULL DEFAULT FALSE,
  last_seen_at                DATETIME         NULL,
  created_at                  TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_user_type (user_type),
  KEY idx_users_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. password_reset_tokens
-- ----------------------------------------------------------------------------
CREATE TABLE password_reset_tokens (
  id            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id       BIGINT UNSIGNED  NOT NULL,
  token_hash    VARCHAR(255)     NOT NULL,
  expires_at    TIMESTAMP        NOT NULL,
  used_at       TIMESTAMP        NULL,
  created_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_password_reset_token_hash (token_hash),
  KEY idx_password_reset_user_id (user_id),
  KEY idx_password_reset_expires_at (expires_at),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. person_languages
-- ----------------------------------------------------------------------------
CREATE TABLE person_languages (
  user_id        BIGINT UNSIGNED  NOT NULL,
  language_code  ENUM('en','ceb','fil') NOT NULL,
  PRIMARY KEY (user_id, language_code),
  CONSTRAINT fk_person_language_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. service_profiles
-- ----------------------------------------------------------------------------
CREATE TABLE service_profiles (
  id                       INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  user_id                  BIGINT UNSIGNED NOT NULL,
  barangay_address         VARCHAR(255)   NOT NULL,
  starting_price           DECIMAL(10,2)  NOT NULL,
  description              TEXT           NULL,
  about_me                 TEXT           NULL,
  response_time            VARCHAR(100)   NULL,
  banner_image_url         VARCHAR(500)   NULL,
  banner_image_public_id   VARCHAR(255)   NULL,
  is_published             BOOLEAN        NOT NULL DEFAULT FALSE,
  taxonomy_needs_review    BOOLEAN        NOT NULL DEFAULT FALSE,
  created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_profiles_user (user_id),
  KEY idx_service_profiles_barangay (barangay_address),
  KEY idx_service_profiles_is_published (is_published),
  KEY idx_service_profiles_taxonomy_review (taxonomy_needs_review),
  CONSTRAINT fk_service_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. service_profile_categories
-- ----------------------------------------------------------------------------
CREATE TABLE service_profile_categories (
  service_profile_id  INT UNSIGNED  NOT NULL,
  category_key        VARCHAR(80)   NOT NULL,
  PRIMARY KEY (service_profile_id, category_key),
  KEY idx_service_profile_categories_key (category_key),
  CONSTRAINT fk_spc_profile FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. service_profile_types
-- ----------------------------------------------------------------------------
CREATE TABLE service_profile_types (
  service_profile_id  INT UNSIGNED  NOT NULL,
  service_type_key    VARCHAR(120)  NOT NULL,
  PRIMARY KEY (service_profile_id, service_type_key),
  KEY idx_service_profile_types_key (service_type_key),
  CONSTRAINT fk_spt_profile FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. provider_skills
-- ----------------------------------------------------------------------------
CREATE TABLE provider_skills (
  user_id      BIGINT UNSIGNED  NOT NULL,
  skill_label  VARCHAR(120)     NOT NULL,
  PRIMARY KEY (user_id, skill_label),
  FULLTEXT KEY ftx_provider_skills_label (skill_label),
  CONSTRAINT fk_provider_skill_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. provider_availability_settings
-- ----------------------------------------------------------------------------
CREATE TABLE provider_availability_settings (
  id                          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  service_profile_id          INT UNSIGNED  NOT NULL,
  allow_same_day_booking      BOOLEAN       NOT NULL DEFAULT FALSE,
  min_advance_notice_minutes  INT           NOT NULL DEFAULT 720,
  max_advance_booking_days    INT           NOT NULL DEFAULT 60,
  availability_status         ENUM('available','unavailable') NOT NULL DEFAULT 'available',
  show_availability_status    BOOLEAN       NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_availability_settings_profile (service_profile_id),
  CONSTRAINT fk_availability_settings_profile FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 9. provider_available_slots
-- ----------------------------------------------------------------------------
CREATE TABLE provider_available_slots (
  id                   BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  service_profile_id   INT UNSIGNED     NOT NULL,
  available_date       DATE             NOT NULL,
  start_time           TIME             NOT NULL,
  end_time             TIME             NOT NULL,
  created_at           TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_available_slot (service_profile_id, available_date, start_time, end_time),
  KEY idx_available_slots_profile_date (service_profile_id, available_date),
  CONSTRAINT fk_available_slot_profile FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE,
  CONSTRAINT chk_available_slot_time_order CHECK (end_time > start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 10. provider_availability_blackouts
-- ----------------------------------------------------------------------------
CREATE TABLE provider_availability_blackouts (
  id                   BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  service_profile_id   INT UNSIGNED     NOT NULL,
  blackout_date        DATE             NOT NULL,
  start_time           TIME             NULL,
  end_time             TIME             NULL,
  reason               VARCHAR(255)     NULL,
  created_at           TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_blackouts_profile_date (service_profile_id, blackout_date),
  CONSTRAINT fk_blackout_profile FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE,
  CONSTRAINT chk_blackout_time_shape CHECK (
    (start_time IS NULL AND end_time IS NULL)
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 11. provider_credentials
-- ----------------------------------------------------------------------------
CREATE TABLE provider_credentials (
  id                     INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  service_profile_id     INT UNSIGNED  NOT NULL,
  credential_name        VARCHAR(255)  NOT NULL,
  credential_type        ENUM('professional_license','tesda_certification','safety_training',
                            'technical_certification','government_accreditation',
                            'manufacturer_certification','training_certificate','other') NOT NULL,
  issuing_organization   VARCHAR(255)  NULL,
  credential_id          VARCHAR(120)  NULL,
  issue_date             DATE          NULL,
  expiration_date        DATE          NULL,
  does_not_expire        BOOLEAN       NOT NULL DEFAULT FALSE,
  credential_url         VARCHAR(500)  NULL,
  related_skills         JSON          NULL,
  document_url           VARCHAR(500)  NULL,
  document_public_id     VARCHAR(255)  NULL,
  verification_status    ENUM('unverified','pending','verified','rejected','expired') NOT NULL DEFAULT 'unverified',
  verification_notes     TEXT          NULL,
  reviewed_by            BIGINT UNSIGNED NULL,
  reviewed_at            TIMESTAMP     NULL,
  created_at             TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_credentials_profile_status (service_profile_id, verification_status),
  CONSTRAINT fk_credential_profile FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_credential_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 12. verification_requests
-- ----------------------------------------------------------------------------
CREATE TABLE verification_requests (
  id                     INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id                BIGINT UNSIGNED NOT NULL,
  full_name              VARCHAR(255)  NOT NULL,
  phone_number           VARCHAR(50)   NOT NULL,
  address                TEXT          NOT NULL,
  service_description    TEXT          NOT NULL,
  government_id_data     LONGBLOB      NOT NULL,
  government_id_mime     VARCHAR(100)  NOT NULL,
  certifications_data    LONGBLOB      NULL,
  certifications_mime    VARCHAR(100)  NULL,
  status                 ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  is_active_pending       TINYINT(1) GENERATED ALWAYS AS (CASE WHEN status = 'pending' THEN 1 ELSE NULL END) STORED,
  rejection_reason        TEXT          NULL,
  admin_notes              TEXT          NULL,
  reviewed_by               BIGINT UNSIGNED NULL,
  reviewed_at                TIMESTAMP     NULL,
  created_at                  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_verification_active_pending (user_id, is_active_pending),
  KEY idx_verification_user_status (user_id, status),
  CONSTRAINT fk_verification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_verification_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 13. legal_acceptances
-- ----------------------------------------------------------------------------
-- Authoritative evidence of an affirmative consent/acceptance action.
-- Retention-safe: legal evidence must not disappear because an account is
-- later suspended/deactivated (suspension never hard-deletes), so this
-- table uses RESTRICT on user_id and verification_request_id. An accidental
-- hard-delete fails loudly instead of silently erasing consent evidence;
-- a verification request referenced by consent cannot be hard-deleted.
-- Suspension and deactivation remain unaffected.
-- No IP address / browser fingerprint / device fingerprint columns are
-- collected — not required for this capstone consent system.
--
-- Uniqueness note: MySQL unique indexes treat NULL as distinct-from-NULL,
-- so a plain UNIQUE(..., verification_request_id) would NOT actually stop
-- duplicate registration-context rows (verification_request_id is always
-- NULL for those). verification_request_key is a generated, NOT NULL
-- column that substitutes 0 for NULL, so registration-context duplicates
-- (which all resolve to key 0) are correctly rejected, while each real
-- verification request keeps its own distinct key and may have its own
-- verification_data_consent row.
CREATE TABLE legal_acceptances (
  id                        BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id                   BIGINT UNSIGNED  NOT NULL,
  acceptance_type           VARCHAR(64)      NOT NULL,
  document_version          VARCHAR(32)      NOT NULL,
  context                   VARCHAR(64)      NOT NULL,
  verification_request_id   INT UNSIGNED     NULL,
  verification_request_key INT UNSIGNED     GENERATED ALWAYS AS (COALESCE(verification_request_id, 0)) STORED NOT NULL,
  accepted_at               TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at                TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_legal_acceptance_event (user_id, acceptance_type, document_version, context, verification_request_key),
  KEY idx_legal_acceptance_user_type (user_id, acceptance_type),
  KEY idx_legal_acceptance_verification_request (verification_request_id),
  CONSTRAINT fk_legal_acceptance_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_legal_acceptance_verification FOREIGN KEY (verification_request_id) REFERENCES verification_requests(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 14. service_requests
-- ----------------------------------------------------------------------------
CREATE TABLE service_requests (
  id                            INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  client_id                     BIGINT UNSIGNED NOT NULL,
  provider_id                   BIGINT UNSIGNED NOT NULL,
  service_profile_id            INT UNSIGNED   NOT NULL,
  service_type_key              VARCHAR(120)   NOT NULL,
  service_type_label            VARCHAR(255)   NULL,
  job_details                   TEXT           NOT NULL,
  service_location              VARCHAR(500)   NOT NULL,
  booking_type                  ENUM('one_day','multi_day') NOT NULL DEFAULT 'one_day',
  start_date                    DATE           NOT NULL,
  end_date                      DATE           NOT NULL,
  duration_days                 INT            NOT NULL DEFAULT 1,
  multi_day_mode                ENUM('continuous','specific_dates') NOT NULL DEFAULT 'continuous',
  start_time                    TIME           NOT NULL,
  estimated_duration_minutes    INT            NOT NULL,
  pricing_unit_snapshot         ENUM('per_job','per_hour','per_day') NOT NULL,
  daily_rate_snapshot           DECIMAL(10,2)  NOT NULL,
  estimated_total               DECIMAL(10,2)  NULL,
  status                        ENUM('pending','accepted','declined','on_the_way',
                                  'in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
  decline_reason                 TEXT           NULL,
  cancelled_by                    BIGINT UNSIGNED NULL,
  cancellation_reason              VARCHAR(64)    NULL,
  cancellation_reason_other         VARCHAR(500)   NULL,
  cancelled_at                       TIMESTAMP      NULL,
  provider_completed                  BOOLEAN        NOT NULL DEFAULT FALSE,
  provider_completed_at                TIMESTAMP      NULL,
  client_completed                       BOOLEAN        NOT NULL DEFAULT FALSE,
  client_completed_at                     TIMESTAMP      NULL,
  created_at                                TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                                 TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sr_client_type_status (client_id, service_type_key, status),
  KEY idx_sr_provider_status (provider_id, status),
  KEY idx_sr_client_status (client_id, status),
  CONSTRAINT fk_sr_client FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_sr_provider FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_sr_profile FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE RESTRICT,
  CONSTRAINT fk_sr_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_sr_duration CHECK (estimated_duration_minutes > 0),
  CONSTRAINT chk_sr_daily_rate CHECK (daily_rate_snapshot >= 0),
  CONSTRAINT chk_sr_estimated_total CHECK (estimated_total IS NULL OR estimated_total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 15. service_request_dates
-- ----------------------------------------------------------------------------
CREATE TABLE service_request_dates (
  id                   BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  service_request_id   INT UNSIGNED     NOT NULL,
  service_date         DATE             NOT NULL,
  created_at           TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_srd_request_date (service_request_id, service_date),
  KEY idx_srd_date (service_date),
  CONSTRAINT fk_srd_request FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 16. service_request_reschedules
-- ----------------------------------------------------------------------------
CREATE TABLE service_request_reschedules (
  id                                    BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  service_request_id                    INT UNSIGNED     NOT NULL,
  original_start_date                   DATE             NULL,
  original_end_date                     DATE             NULL,
  original_start_time                   TIME             NULL,
  proposed_start_date                   DATE             NOT NULL,
  proposed_end_date                     DATE             NOT NULL,
  proposed_start_time                   TIME             NOT NULL,
  proposed_estimated_duration_minutes   INT              NOT NULL,
  proposed_multi_day_mode               ENUM('continuous','specific_dates') NULL,
  proposed_by                           BIGINT UNSIGNED  NOT NULL,
  reschedule_reason                     VARCHAR(1000)    NOT NULL,
  reschedule_status                     ENUM('pending','accepted','declined') NOT NULL DEFAULT 'pending',
  pending_marker                        TINYINT(1) GENERATED ALWAYS AS (CASE WHEN reschedule_status = 'pending' THEN 1 ELSE NULL END) STORED,
  responded_by                          BIGINT UNSIGNED  NULL,
  responded_at                          TIMESTAMP        NULL,
  created_at                            TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                            TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reschedule_pending (service_request_id, pending_marker),
  KEY idx_reschedule_request_status (service_request_id, reschedule_status),
  CONSTRAINT fk_reschedule_request FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reschedule_proposed_by FOREIGN KEY (proposed_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reschedule_responded_by FOREIGN KEY (responded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 17. service_request_reschedule_dates
-- ----------------------------------------------------------------------------
CREATE TABLE service_request_reschedule_dates (
  id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  reschedule_id   BIGINT UNSIGNED  NOT NULL,
  proposed_date   DATE             NOT NULL,
  created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reschedule_date (reschedule_id, proposed_date),
  CONSTRAINT fk_reschedule_date_parent FOREIGN KEY (reschedule_id) REFERENCES service_request_reschedules(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 18. service_request_status_history
-- ----------------------------------------------------------------------------
CREATE TABLE service_request_status_history (
  id                    BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  service_request_id    INT UNSIGNED     NOT NULL,
  from_status           VARCHAR(20)      NULL,
  to_status             VARCHAR(20)      NOT NULL,
  changed_by            BIGINT UNSIGNED  NULL,
  reason                VARCHAR(500)     NULL,
  record_source         ENUM('live','seeded') NOT NULL DEFAULT 'live',
  created_at            TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_status_history_request_created (service_request_id, created_at),
  CONSTRAINT fk_status_history_request FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE RESTRICT,
  CONSTRAINT fk_status_history_actor FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 19. conversations
-- ----------------------------------------------------------------------------
CREATE TABLE conversations (
  id                    INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  service_request_id    INT UNSIGNED  NOT NULL,
  created_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_conversation_request (service_request_id),
  KEY idx_conversation_updated (updated_at),
  CONSTRAINT fk_conversation_request FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 20. messages
-- ----------------------------------------------------------------------------
CREATE TABLE messages (
  id                BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  conversation_id    INT UNSIGNED     NOT NULL,
  sender_id           BIGINT UNSIGNED  NOT NULL,
  message_text         VARCHAR(2000)    NOT NULL,
  read_at              TIMESTAMP        NULL,
  created_at            TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_message_conversation_created (conversation_id, created_at),
  KEY idx_message_conversation_read (conversation_id, read_at),
  CONSTRAINT fk_message_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_message_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 21. service_request_contact_shares
-- ----------------------------------------------------------------------------
CREATE TABLE service_request_contact_shares (
  id                     INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  service_request_id     INT UNSIGNED  NOT NULL,
  requester_user_id      BIGINT UNSIGNED NOT NULL,
  owner_user_id          BIGINT UNSIGNED NOT NULL,
  contact_type           ENUM('phone') NOT NULL DEFAULT 'phone',
  status                 ENUM('pending','shared','declined','revoked') NOT NULL DEFAULT 'pending',
  requested_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at           TIMESTAMP     NULL,
  updated_at             TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_contact_share_direction (service_request_id, requester_user_id, owner_user_id, contact_type),
  KEY idx_contact_share_owner_status (owner_user_id, status),
  CONSTRAINT fk_contact_share_request FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE RESTRICT,
  CONSTRAINT fk_contact_share_requester FOREIGN KEY (requester_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_contact_share_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_contact_share_parties_differ CHECK (requester_user_id <> owner_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 22. service_request_archives
-- ----------------------------------------------------------------------------
CREATE TABLE service_request_archives (
  service_request_id   INT UNSIGNED  NOT NULL,
  user_id               BIGINT UNSIGNED NOT NULL,
  archived_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (service_request_id, user_id),
  CONSTRAINT fk_archive_request FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_archive_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 23. portfolio_items
-- ----------------------------------------------------------------------------
CREATE TABLE portfolio_items (
  id                   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  service_request_id    INT UNSIGNED  NOT NULL,
  image_url              VARCHAR(500)  NULL,
  image_public_id         VARCHAR(255)  NULL,
  caption                 VARCHAR(255)  NULL,
  is_published              BOOLEAN       NOT NULL DEFAULT TRUE,
  is_featured                BOOLEAN       NOT NULL DEFAULT FALSE,
  display_order                INT           NOT NULL DEFAULT 0,
  created_at                    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_portfolio_request (service_request_id),
  CONSTRAINT fk_portfolio_request FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 24. reviews
-- ----------------------------------------------------------------------------
CREATE TABLE reviews (
  id                   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  service_request_id    INT UNSIGNED  NOT NULL,
  rating                  DECIMAL(2,1)  NOT NULL,
  comment                  TEXT          NULL,
  created_at                TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_review_request (service_request_id),
  CONSTRAINT fk_review_request FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE RESTRICT,
  CONSTRAINT chk_review_rating_range CHECK (rating BETWEEN 1.0 AND 5.0),
  CONSTRAINT chk_review_rating_half_star CHECK (MOD(rating * 2, 1) = 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 25. notifications
-- ----------------------------------------------------------------------------
CREATE TABLE notifications (
  id                    BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id                BIGINT UNSIGNED  NOT NULL,
  type                    VARCHAR(64)      NOT NULL,
  title                    VARCHAR(255)     NOT NULL,
  message                   TEXT             NOT NULL,
  related_request_id         INT UNSIGNED     NULL,
  is_read                     BOOLEAN          NOT NULL DEFAULT FALSE,
  created_at                    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user_read (user_id, is_read),
  KEY idx_notifications_user_type (user_id, type),
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_notification_request FOREIGN KEY (related_request_id) REFERENCES service_requests(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 26. user_reports
--
-- This is the modern Admin Reports contract used by the active backend.
-- Historical Railway production also carries legacy-only compatibility
-- columns (report_status, action_taken, priority, resolution_notes,
-- moderation_notes, screenshot_data, screenshot_mime, handled_at) that
-- reconcile-production-schema.js preserves without dropping. Those legacy
-- columns are intentionally omitted from this fresh baseline because no
-- active code path reads or writes them. Historical screenshot blobs
-- (screenshot_data/screenshot_mime) remain in production as compatibility
-- data; migrating them to Cloudinary URLs is a separate, explicit follow-up.
-- ----------------------------------------------------------------------------
CREATE TABLE user_reports (
  id                   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  reporter_id           BIGINT UNSIGNED NOT NULL,
  reported_user_id       BIGINT UNSIGNED NOT NULL,
  request_id              INT UNSIGNED    NULL,
  reason                    VARCHAR(255)    NOT NULL,
  description                 TEXT            NULL,
  screenshot_url                VARCHAR(500)    NULL,
  status                          ENUM('pending','investigating','resolved','dismissed') NOT NULL DEFAULT 'pending',
  handled_by                       BIGINT UNSIGNED NULL,
  resolution                        TEXT            NULL,
  created_at                          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                           TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_report_unique (request_id, reporter_id, reported_user_id),
  KEY idx_reports_status (status),
  KEY idx_reports_reported_status (reported_user_id, status),
  CONSTRAINT fk_report_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_report_reported_user FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_report_request FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE SET NULL,
  CONSTRAINT fk_report_handled_by FOREIGN KEY (handled_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 27. schema_migrations
-- ----------------------------------------------------------------------------
CREATE TABLE schema_migrations (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  filename      VARCHAR(255)  NOT NULL,
  applied_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_schema_migrations_filename (filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- VIEW: service_profile_stats (no join fan-out — independent aggregate
-- subqueries joined 1:1 by service_profile_id)
-- ----------------------------------------------------------------------------
CREATE VIEW service_profile_stats AS
SELECT
  sp.id AS service_profile_id,
  COALESCE(review_stats.rating, 0)        AS rating,
  COALESCE(review_stats.reviews_count, 0)  AS reviews_count,
  COALESCE(job_stats.jobs_completed, 0)     AS jobs_completed
FROM service_profiles sp
LEFT JOIN (
  SELECT sr.service_profile_id,
         AVG(r.rating) AS rating,
         COUNT(*)       AS reviews_count
  FROM reviews r
  JOIN service_requests sr ON sr.id = r.service_request_id
  GROUP BY sr.service_profile_id
) review_stats ON review_stats.service_profile_id = sp.id
LEFT JOIN (
  SELECT service_profile_id,
         COUNT(*) AS jobs_completed
  FROM service_requests
  WHERE status = 'completed'
  GROUP BY service_profile_id
) job_stats ON job_stats.service_profile_id = sp.id;

-- ----------------------------------------------------------------------------
-- Register this migration.
-- ----------------------------------------------------------------------------
INSERT INTO schema_migrations (filename) VALUES ('0000_baseline_canonical_schema.sql');

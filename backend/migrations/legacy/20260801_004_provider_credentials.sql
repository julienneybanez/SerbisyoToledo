-- Stage 1 Migration 004
-- Provider licenses and certifications with admin review metadata.

CREATE TABLE IF NOT EXISTS provider_credentials (
  id INT PRIMARY KEY AUTO_INCREMENT,
  service_profile_id INT NOT NULL,
  credential_name VARCHAR(255) NOT NULL,
  credential_type ENUM(
    'professional_license',
    'tesda_certification',
    'safety_training',
    'technical_certification',
    'government_accreditation',
    'manufacturer_certification',
    'training_certificate',
    'other'
  ) NOT NULL,
  issuing_organization VARCHAR(255) NOT NULL,
  credential_id VARCHAR(120) NULL,
  issue_date DATE NULL,
  expiration_date DATE NULL,
  does_not_expire BOOLEAN NOT NULL DEFAULT FALSE,
  credential_url VARCHAR(500) NULL,
  related_skills JSON NULL,
  document_url VARCHAR(500) NULL,
  document_public_id VARCHAR(255) NULL,
  document_data LONGBLOB NULL,
  document_mime VARCHAR(100) NULL,
  verification_status ENUM('unverified', 'pending', 'verified', 'rejected', 'expired') NOT NULL DEFAULT 'unverified',
  verification_notes TEXT NULL,
  reviewed_by INT NULL,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_provider_credentials_profile
    FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_provider_credentials_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_provider_credentials_profile (service_profile_id),
  INDEX idx_provider_credentials_status (verification_status),
  INDEX idx_provider_credentials_expiration (expiration_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rollback guidance:
-- DROP TABLE IF EXISTS provider_credentials;

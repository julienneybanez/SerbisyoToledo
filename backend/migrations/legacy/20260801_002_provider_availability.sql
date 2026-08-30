-- Stage 1 Migration 002
-- Provider weekly availability, exceptions, and booking window settings.

CREATE TABLE IF NOT EXISTS provider_availability_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  service_profile_id INT NOT NULL UNIQUE,
  allow_same_day_booking BOOLEAN NOT NULL DEFAULT FALSE,
  min_advance_notice_minutes INT NOT NULL DEFAULT 720,
  max_advance_booking_days INT NOT NULL DEFAULT 60,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_provider_availability_settings_profile
    FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE,
  INDEX idx_provider_availability_settings_profile (service_profile_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS provider_weekly_availability (
  id INT PRIMARY KEY AUTO_INCREMENT,
  service_profile_id INT NOT NULL,
  day_of_week TINYINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_provider_weekly_availability_profile
    FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE,
  CONSTRAINT chk_provider_weekly_day CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT chk_provider_weekly_time CHECK (end_time > start_time),
  UNIQUE KEY uniq_provider_weekly_block (service_profile_id, day_of_week, start_time, end_time),
  INDEX idx_provider_weekly_lookup (service_profile_id, day_of_week)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS provider_availability_exceptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  service_profile_id INT NOT NULL,
  exception_date DATE NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  exception_type ENUM('available', 'unavailable', 'booked', 'vacation') NOT NULL,
  reason VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_provider_exceptions_profile
    FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE,
  CONSTRAINT chk_provider_exception_time CHECK (
    (start_time IS NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  ),
  INDEX idx_provider_exception_lookup (service_profile_id, exception_date),
  INDEX idx_provider_exception_type (exception_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rollback guidance:
-- DROP TABLE IF EXISTS provider_availability_exceptions;
-- DROP TABLE IF EXISTS provider_weekly_availability;
-- DROP TABLE IF EXISTS provider_availability_settings;

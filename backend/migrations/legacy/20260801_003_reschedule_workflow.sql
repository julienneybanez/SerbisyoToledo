-- Stage 1 Migration 003
-- Rescheduling workflow table preserving original and proposed schedules.

CREATE TABLE IF NOT EXISTS service_request_reschedules (
  id INT PRIMARY KEY AUTO_INCREMENT,
  service_request_id INT NOT NULL,
  original_start_date DATE NOT NULL,
  original_end_date DATE NOT NULL,
  original_start_time TIME NULL,
  proposed_start_date DATE NOT NULL,
  proposed_end_date DATE NOT NULL,
  proposed_start_time TIME NULL,
  proposed_by INT NOT NULL,
  reschedule_reason TEXT NULL,
  reschedule_status ENUM('pending', 'accepted', 'declined', 'cancelled') NOT NULL DEFAULT 'pending',
  responded_by INT NULL,
  responded_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reschedule_request
    FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_reschedule_proposed_by
    FOREIGN KEY (proposed_by) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reschedule_responded_by
    FOREIGN KEY (responded_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_reschedule_request (service_request_id),
  INDEX idx_reschedule_status (reschedule_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rollback guidance:
-- DROP TABLE IF EXISTS service_request_reschedules;

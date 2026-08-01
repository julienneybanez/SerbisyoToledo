const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const getConnectionConfig = () => {
  const databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.DB_URL;

  if (databaseUrl) {
    try {
      const parsedUrl = new URL(databaseUrl);
      return {
        host: parsedUrl.hostname,
        port: parsedUrl.port ? Number(parsedUrl.port) : 3306,
        user: decodeURIComponent(parsedUrl.username || ''),
        password: decodeURIComponent(parsedUrl.password || ''),
      };
    } catch (error) {
      console.warn('⚠️  Invalid DATABASE_URL provided for DB initialization. Falling back to local config.', error.message);
    }
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  };
};

async function initializeDatabase() {
  let connection;
  
  try {
    const databaseName = process.env.DB_NAME || 'serbisyo_toledo';

    // First, connect without specifying a database
    connection = await mysql.createConnection(getConnectionConfig());

    console.log('Connected to MySQL server');

    // Create database if it doesn't exist
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${databaseName}`
    );
    console.log('✅ Database created/verified');

    // Use the database
    await connection.query(`USE ${databaseName}`);

    // Create users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        user_type ENUM('client', 'tradesperson', 'admin') NOT NULL DEFAULT 'client',
        preferred_services VARCHAR(255) DEFAULT NULL,
        profession VARCHAR(255) DEFAULT NULL,
        skills JSON DEFAULT NULL,
        profile_image VARCHAR(500) DEFAULT NULL,
        profile_photo_url VARCHAR(500) DEFAULT NULL,
        profile_photo_public_id VARCHAR(255) DEFAULT NULL,
        phone VARCHAR(20) DEFAULT NULL,
        address TEXT DEFAULT NULL,
        bio TEXT DEFAULT NULL,
        is_verified BOOLEAN DEFAULT FALSE,
        email_verified BOOLEAN DEFAULT FALSE,
        verification_token VARCHAR(255) DEFAULT NULL,
        verification_token_expires TIMESTAMP NULL DEFAULT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_user_type (user_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Users table created/verified');

    // Update existing user_type ENUM to include admin (if table exists)
    try {
      await connection.query(`
        ALTER TABLE users MODIFY COLUMN user_type ENUM('client', 'tradesperson', 'admin') NOT NULL DEFAULT 'client'
      `);
      console.log('✅ User type ENUM updated to include admin');
    } catch {
      // Ignore if already updated
    }

    // Add email verification columns if they don't exist
    const verificationColumns = [
      { name: 'email_verified', definition: 'BOOLEAN DEFAULT FALSE' },
      { name: 'verification_token', definition: 'VARCHAR(255) DEFAULT NULL' },
      { name: 'verification_token_expires', definition: 'TIMESTAMP NULL DEFAULT NULL' }
    ];

    for (const col of verificationColumns) {
      try {
        await connection.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.definition}`);
        console.log(`✅ Added column: ${col.name}`);
      } catch {
        // Column already exists
      }
    }

    // Create refresh_tokens table for JWT refresh tokens
    await connection.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        token VARCHAR(500) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_token (token(255)),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Refresh tokens table created/verified');

    // Create password_reset_tokens table for forgot password flow
    await connection.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_password_reset_user_id (user_id),
        INDEX idx_password_reset_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Password reset tokens table created/verified');

    // Create service_profiles table for service provider profiles
    await connection.query(`
      CREATE TABLE IF NOT EXISTS service_profiles (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL UNIQUE,
        full_name VARCHAR(255) NOT NULL,
        barangay_address VARCHAR(255) NOT NULL,
        starting_price DECIMAL(10, 2) NOT NULL,
        service_categories JSON NOT NULL,
        banner_image LONGBLOB DEFAULT NULL,
        banner_image_url VARCHAR(500) DEFAULT NULL,
        banner_image_public_id VARCHAR(255) DEFAULT NULL,
        description TEXT DEFAULT NULL,
        rating DECIMAL(3, 1) DEFAULT 5.0,
        reviews_count INT DEFAULT 0,
        online BOOLEAN DEFAULT FALSE,
        is_published BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_barangay (barangay_address),
        INDEX idx_is_published (is_published)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Service profiles table created/verified');

    // Create service_requests table for booking/request management
    await connection.query(`
      CREATE TABLE IF NOT EXISTS service_requests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        client_id INT NOT NULL,
        provider_id INT NOT NULL,
        service_profile_id INT NOT NULL,
        job_title VARCHAR(255) NOT NULL,
        job_details TEXT NOT NULL,
        scheduled_date DATE NOT NULL,
        scheduled_time VARCHAR(50) NOT NULL,
        status ENUM('pending', 'accepted', 'declined', 'on_the_way', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
        decline_reason TEXT DEFAULT NULL,
        discussion_requested BOOLEAN DEFAULT FALSE,
        discussion_accepted BOOLEAN DEFAULT FALSE,
        provider_phone_revealed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE,
        INDEX idx_client_id (client_id),
        INDEX idx_provider_id (provider_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Service requests table created/verified');

    // Create notifications table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        type ENUM('request_received', 'request_accepted', 'request_declined', 'provider_on_way', 'service_completed', 'discussion_requested', 'discussion_accepted', 'phone_revealed', 'completion_confirmed', 'review_received', 'verification_approved', 'verification_rejected') NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        related_request_id INT DEFAULT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (related_request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_is_read (is_read),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Notifications table created/verified');

    // Create portfolio_items table for service provider portfolio
    await connection.query(`
      CREATE TABLE IF NOT EXISTS portfolio_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        service_profile_id INT NOT NULL,
        image_url VARCHAR(500) DEFAULT NULL,
        image_public_id VARCHAR(255) DEFAULT NULL,
        image_data LONGBLOB DEFAULT NULL,
        caption VARCHAR(255) NOT NULL,
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE,
        INDEX idx_profile_id (service_profile_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Portfolio items table created/verified');

    // Create reviews table for service provider reviews
    await connection.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT PRIMARY KEY AUTO_INCREMENT,
        service_profile_id INT NOT NULL,
        client_id INT NOT NULL,
        service_request_id INT DEFAULT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_profile_id (service_profile_id),
        INDEX idx_client_id (client_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Reviews table created/verified');

    // Create verification_requests table for provider verification workflow
    await connection.query(`
      CREATE TABLE IF NOT EXISTS verification_requests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        phone_number VARCHAR(50) NOT NULL,
        address TEXT NOT NULL,
        service_description TEXT NOT NULL,
        government_id_data LONGBLOB NOT NULL,
        government_id_mime VARCHAR(100) DEFAULT 'application/octet-stream',
        certifications_data LONGBLOB NOT NULL,
        certifications_mime VARCHAR(100) DEFAULT 'application/octet-stream',
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        rejection_reason TEXT DEFAULT NULL,
        admin_notes TEXT DEFAULT NULL,
        reviewed_by INT DEFAULT NULL,
        reviewed_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_verification_user_id (user_id),
        INDEX idx_verification_status (status),
        UNIQUE KEY uniq_user_pending_request (user_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Verification requests table created/verified');

    // Create user_reports table for complaint workflow
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_reports (
        id INT PRIMARY KEY AUTO_INCREMENT,
        request_id INT NOT NULL,
        reporter_id INT NOT NULL,
        reported_user_id INT NOT NULL,
        reason VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        screenshot_data LONGBLOB DEFAULT NULL,
        screenshot_mime VARCHAR(100) DEFAULT NULL,
        status ENUM('pending', 'under_review', 'dismissed', 'resolved', 'banned') DEFAULT 'pending',
        priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
        resolution_notes TEXT DEFAULT NULL,
        handled_by INT DEFAULT NULL,
        handled_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (handled_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_report_status (status),
        INDEX idx_report_reporter (reporter_id),
        INDEX idx_report_reported_user (reported_user_id),
        UNIQUE KEY uniq_request_reporter_reported (request_id, reporter_id, reported_user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ User reports table created/verified');

    // Add about_me column to service_profiles if it doesn't exist
    try {
      await connection.query(`ALTER TABLE service_profiles ADD COLUMN about_me TEXT DEFAULT NULL`);
      console.log('✅ Added about_me column to service_profiles');
    } catch {
      // Column already exists
    }

    // Add response_time column to service_profiles if it doesn't exist
    try {
      await connection.query(`ALTER TABLE service_profiles ADD COLUMN response_time VARCHAR(100) DEFAULT 'Within 24 hours'`);
      console.log('✅ Added response_time column to service_profiles');
    } catch {
      // Column already exists
    }

    // Add jobs_completed column to service_profiles if it doesn't exist
    try {
      await connection.query(`ALTER TABLE service_profiles ADD COLUMN jobs_completed INT DEFAULT 0`);
      console.log('✅ Added jobs_completed column to service_profiles');
    } catch {
      // Column already exists
    }

    // Add profile_photo LONGBLOB column to users if it doesn't exist
    try {
      await connection.query(`ALTER TABLE users ADD COLUMN profile_photo LONGBLOB DEFAULT NULL`);
      console.log('✅ Added profile_photo column to users');
    } catch {
      // Column already exists
    }

    // Add Cloudinary profile photo URL/public ID columns if they don't exist
    try {
      await connection.query(`ALTER TABLE users ADD COLUMN profile_photo_url VARCHAR(500) DEFAULT NULL`);
      console.log('✅ Added profile_photo_url column to users');
    } catch {
      // Column already exists
    }

    try {
      await connection.query(`ALTER TABLE users ADD COLUMN profile_photo_public_id VARCHAR(255) DEFAULT NULL`);
      console.log('✅ Added profile_photo_public_id column to users');
    } catch {
      // Column already exists
    }

    // Add Cloudinary banner image URL/public ID columns if they don't exist
    try {
      await connection.query(`ALTER TABLE service_profiles ADD COLUMN banner_image_url VARCHAR(500) DEFAULT NULL`);
      console.log('✅ Added banner_image_url column to service_profiles');
    } catch {
      // Column already exists
    }

    try {
      await connection.query(`ALTER TABLE service_profiles ADD COLUMN banner_image_public_id VARCHAR(255) DEFAULT NULL`);
      console.log('✅ Added banner_image_public_id column to service_profiles');
    } catch {
      // Column already exists
    }

    // Add Cloudinary portfolio image public ID column if it doesn't exist
    try {
      await connection.query(`ALTER TABLE portfolio_items ADD COLUMN image_public_id VARCHAR(255) DEFAULT NULL`);
      console.log('✅ Added image_public_id column to portfolio_items');
    } catch {
      // Column already exists
    }

    // Add provider_completed and client_completed columns for two-way completion confirmation
    try {
      await connection.query(`ALTER TABLE service_requests ADD COLUMN provider_completed BOOLEAN DEFAULT FALSE`);
      console.log('✅ Added provider_completed column to service_requests');
    } catch {
      // Column already exists
    }

    try {
      await connection.query(`ALTER TABLE service_requests ADD COLUMN client_completed BOOLEAN DEFAULT FALSE`);
      console.log('✅ Added client_completed column to service_requests');
    } catch {
      // Column already exists
    }

    // Add decline_reason column to service_requests if it doesn't exist
    try {
      await connection.query(`ALTER TABLE service_requests ADD COLUMN decline_reason TEXT DEFAULT NULL`);
      console.log('✅ Added decline_reason column to service_requests');
    } catch {
      // Column already exists
    }

    // Update reviews rating column to DECIMAL to support half-stars
    try {
      await connection.query(`ALTER TABLE reviews MODIFY COLUMN rating DECIMAL(2,1) NOT NULL`);
      console.log('✅ Updated reviews rating column to DECIMAL(2,1) for half-star support');
    } catch {
      // Already updated or error
    }

    // Add unique constraint on service_request_id in reviews to prevent duplicate reviews
    try {
      await connection.query(`ALTER TABLE reviews ADD UNIQUE INDEX idx_unique_request_review (service_request_id)`);
      console.log('✅ Added unique index on service_request_id in reviews');
    } catch {
      // Already exists
    }

    // Update notification type ENUM to include new types
    try {
      await connection.query(`
        ALTER TABLE notifications MODIFY COLUMN type ENUM(
          'request_received', 'request_accepted', 'request_declined', 
          'provider_on_way', 'service_completed', 'discussion_requested', 
          'discussion_accepted', 'phone_revealed', 'completion_confirmed',
          'review_received', 'verification_approved', 'verification_rejected'
        ) NOT NULL
      `);
      console.log('✅ Updated notification type ENUM with new types');
    } catch {
      // Already updated
    }

    // Stage 1 booking fields for one-day and multi-day support
    const serviceRequestColumns = [
      'booking_type ENUM(\'one_day\', \'multi_day\') NOT NULL DEFAULT \'one_day\'',
      'start_date DATE NULL',
      'end_date DATE NULL',
      'start_time TIME NULL',
      'estimated_duration_minutes INT NULL',
      'duration_days INT NULL',
      'daily_rate_snapshot DECIMAL(10,2) NULL',
      'estimated_total DECIMAL(10,2) NULL',
      'cancelled_by INT NULL',
      'cancellation_reason VARCHAR(120) NULL',
      'cancellation_reason_other TEXT NULL',
      'cancelled_at TIMESTAMP NULL DEFAULT NULL',
    ];

    for (const col of serviceRequestColumns) {
      try {
        const [columnName] = col.split(' ');
        await connection.query(`ALTER TABLE service_requests ADD COLUMN ${col}`);
        console.log(`✅ Added column: service_requests.${columnName}`);
      } catch {
        // Column already exists
      }
    }

    try {
      await connection.query(
        'ALTER TABLE service_requests ADD CONSTRAINT fk_service_requests_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL'
      );
      console.log('✅ Added fk_service_requests_cancelled_by');
    } catch {
      // FK already exists
    }

    // Backfill date range fields from legacy scheduled_date
    try {
      await connection.query(`
        UPDATE service_requests
        SET
          start_date = COALESCE(start_date, scheduled_date),
          end_date = COALESCE(end_date, scheduled_date),
          duration_days = COALESCE(duration_days, 1)
      `);
    } catch {
      // Ignore backfill errors on partial schemas
    }

    // Provider availability settings table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS provider_availability_settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        service_profile_id INT NOT NULL UNIQUE,
        allow_same_day_booking BOOLEAN NOT NULL DEFAULT FALSE,
        min_advance_notice_minutes INT NOT NULL DEFAULT 720,
        max_advance_booking_days INT NOT NULL DEFAULT 60,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Provider weekly availability table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS provider_weekly_availability (
        id INT PRIMARY KEY AUTO_INCREMENT,
        service_profile_id INT NOT NULL,
        day_of_week TINYINT NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        is_available BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE,
        UNIQUE KEY uniq_provider_weekly_block (service_profile_id, day_of_week, start_time, end_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Provider availability exceptions table
    await connection.query(`
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
        FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE,
        INDEX idx_provider_exception_lookup (service_profile_id, exception_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Reschedule workflow table
    await connection.query(`
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
        FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (proposed_by) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (responded_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Provider credentials table
    await connection.query(`
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
        FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Portfolio enhancements
    const portfolioColumns = [
      'service_request_id INT NULL',
      'job_title VARCHAR(255) NULL',
      'job_description TEXT NULL',
      'service_category VARCHAR(120) NULL',
      'completed_at DATETIME NULL',
      'is_published BOOLEAN NOT NULL DEFAULT TRUE',
      'is_featured BOOLEAN NOT NULL DEFAULT FALSE',
      'completed_through_platform BOOLEAN NOT NULL DEFAULT FALSE',
      'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    ];

    for (const col of portfolioColumns) {
      try {
        const [columnName] = col.split(' ');
        await connection.query(`ALTER TABLE portfolio_items ADD COLUMN ${col}`);
        console.log(`✅ Added column: portfolio_items.${columnName}`);
      } catch {
        // Column already exists
      }
    }

    try {
      await connection.query(
        'ALTER TABLE portfolio_items ADD CONSTRAINT fk_portfolio_items_service_request FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE SET NULL'
      );
      console.log('✅ Added fk_portfolio_items_service_request');
    } catch {
      // FK already exists
    }

    // Provider languages table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS provider_languages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        service_profile_id INT NOT NULL,
        language_code ENUM('ceb', 'en', 'fil') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE,
        UNIQUE KEY uniq_provider_language (service_profile_id, language_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('\n🎉 Database initialization complete!');
    console.log('You can now start the server with: npm run dev');

  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initializeDatabase();

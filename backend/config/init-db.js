const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function initializeDatabase() {
  let connection;
  
  try {
    // First, connect without specifying a database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });

    console.log('Connected to MySQL server');

    // Create database if it doesn't exist
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'serbisyo_toledo'}`
    );
    console.log('✅ Database created/verified');

    // Use the database
    await connection.query(`USE ${process.env.DB_NAME || 'serbisyo_toledo'}`);

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
    } catch (err) {
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
      } catch (err) {
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
        type ENUM('request_received', 'request_accepted', 'request_declined', 'provider_on_way', 'service_completed', 'discussion_requested', 'discussion_accepted', 'phone_revealed') NOT NULL,
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

    // Add about_me column to service_profiles if it doesn't exist
    try {
      await connection.query(`ALTER TABLE service_profiles ADD COLUMN about_me TEXT DEFAULT NULL`);
      console.log('✅ Added about_me column to service_profiles');
    } catch (err) {
      // Column already exists
    }

    // Add response_time column to service_profiles if it doesn't exist
    try {
      await connection.query(`ALTER TABLE service_profiles ADD COLUMN response_time VARCHAR(100) DEFAULT 'Within 24 hours'`);
      console.log('✅ Added response_time column to service_profiles');
    } catch (err) {
      // Column already exists
    }

    // Add jobs_completed column to service_profiles if it doesn't exist
    try {
      await connection.query(`ALTER TABLE service_profiles ADD COLUMN jobs_completed INT DEFAULT 0`);
      console.log('✅ Added jobs_completed column to service_profiles');
    } catch (err) {
      // Column already exists
    }

    // Add profile_photo LONGBLOB column to users if it doesn't exist
    try {
      await connection.query(`ALTER TABLE users ADD COLUMN profile_photo LONGBLOB DEFAULT NULL`);
      console.log('✅ Added profile_photo column to users');
    } catch (err) {
      // Column already exists
    }

    // Add provider_completed and client_completed columns for two-way completion confirmation
    try {
      await connection.query(`ALTER TABLE service_requests ADD COLUMN provider_completed BOOLEAN DEFAULT FALSE`);
      console.log('✅ Added provider_completed column to service_requests');
    } catch (err) {
      // Column already exists
    }

    try {
      await connection.query(`ALTER TABLE service_requests ADD COLUMN client_completed BOOLEAN DEFAULT FALSE`);
      console.log('✅ Added client_completed column to service_requests');
    } catch (err) {
      // Column already exists
    }

    // Update reviews rating column to DECIMAL to support half-stars
    try {
      await connection.query(`ALTER TABLE reviews MODIFY COLUMN rating DECIMAL(2,1) NOT NULL`);
      console.log('✅ Updated reviews rating column to DECIMAL(2,1) for half-star support');
    } catch (err) {
      // Already updated or error
    }

    // Add unique constraint on service_request_id in reviews to prevent duplicate reviews
    try {
      await connection.query(`ALTER TABLE reviews ADD UNIQUE INDEX idx_unique_request_review (service_request_id)`);
      console.log('✅ Added unique index on service_request_id in reviews');
    } catch (err) {
      // Already exists
    }

    // Update notification type ENUM to include new types
    try {
      await connection.query(`
        ALTER TABLE notifications MODIFY COLUMN type ENUM(
          'request_received', 'request_accepted', 'request_declined', 
          'provider_on_way', 'service_completed', 'discussion_requested', 
          'discussion_accepted', 'phone_revealed', 'completion_confirmed',
          'review_received'
        ) NOT NULL
      `);
      console.log('✅ Updated notification type ENUM with new types');
    } catch (err) {
      // Already updated
    }

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

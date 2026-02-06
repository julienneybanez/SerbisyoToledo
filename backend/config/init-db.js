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

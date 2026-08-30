const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const getConnectionConfig = () => {
  const databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.DB_URL;

  if (databaseUrl) {
    try {
      const parsedUrl = new URL(databaseUrl);
      const databaseName = process.env.DB_NAME || parsedUrl.pathname.replace(/^\//, '') || 'serbisyo_toledo';

      return {
        host: parsedUrl.hostname,
        port: parsedUrl.port ? Number(parsedUrl.port) : 3306,
        user: decodeURIComponent(parsedUrl.username || ''),
        password: decodeURIComponent(parsedUrl.password || ''),
        database: databaseName,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      };
    } catch (error) {
      console.warn('⚠️  Invalid DATABASE_URL provided for admin seed. Falling back to local config.', error.message);
    }
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'serbisyo_toledo',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  };
};

async function seedAdmin() {
  let connection;
  
  try {
    connection = await mysql.createConnection(getConnectionConfig());

    console.log('Connected to database');

    // The canonical baseline schema already declares user_type as
    // ENUM('client','tradesperson','admin'), so no legacy ALTER TABLE
    // migration is needed here.

    // Admin credentials — no hard-coded fallback secrets. Both ADMIN_EMAIL
    // and ADMIN_PASSWORD must be provided via environment variables so a
    // weak, publicly-known default password is never seeded anywhere.
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      console.error('❌ ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required to seed an admin account.');
      console.error('   Example: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD="a-strong-password" node config/seed-admin.js');
      process.exitCode = 1;
      return;
    }

    if (process.env.ADMIN_PASSWORD.length < 12) {
      console.error('❌ ADMIN_PASSWORD must be at least 12 characters long.');
      process.exitCode = 1;
      return;
    }

    const adminData = {
      fullName: process.env.ADMIN_FULL_NAME || 'Admin User',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      userType: 'admin'
    };

    // Check if admin already exists
    const [existing] = await connection.query(
      'SELECT id, user_type FROM users WHERE email = ?',
      [adminData.email]
    );

    if (existing.length > 0) {
      // Admin exists, check if user_type needs updating
      if (!existing[0].user_type || existing[0].user_type !== 'admin') {
        await connection.query(
          `UPDATE users
           SET user_type = ?,
               email_verified = TRUE,
               verification_token = NULL,
               verification_token_expires = NULL,
               is_active = TRUE
           WHERE email = ?`,
          [adminData.userType, adminData.email]
        );
        console.log('\n✅ Admin account user_type updated successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`   Email: ${adminData.email}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      } else {
        await connection.query(
          `UPDATE users
           SET email_verified = TRUE,
               verification_token = NULL,
               verification_token_expires = NULL,
               is_active = TRUE
           WHERE email = ?`,
          [adminData.email]
        );
        console.log('⚠️  Admin account already exists and is configured correctly');
        console.log(`   Email: ${adminData.email}`);
      }
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminData.password, salt);

    // Insert admin user
    await connection.query(
      `INSERT INTO users (
         full_name,
         email,
         password,
         user_type,
         is_verified,
         email_verified,
         verification_token,
         verification_token_expires,
         is_active
       )
       VALUES (?, ?, ?, ?, TRUE, TRUE, NULL, NULL, TRUE)`,
      [adminData.fullName, adminData.email, hashedPassword, adminData.userType]
    );

    console.log('\n✅ Admin account created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email: ${adminData.email}`);
    console.log('   Password: (the value you provided via ADMIN_PASSWORD)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  Please change the password after first login!\n');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Error: Could not connect to MySQL database.');
      console.error('   Please make sure XAMPP MySQL is running.');
    } else {
      console.error('❌ Error creating admin:', error.message);
      console.error('Full error:', error);
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

seedAdmin();

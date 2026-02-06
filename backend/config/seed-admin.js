const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

async function seedAdmin() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'serbisyo_toledo'
    });

    console.log('Connected to database');

    // First, ensure the ENUM includes 'admin'
    console.log('Updating user_type ENUM to include admin...');
    try {
      await connection.query(`
        ALTER TABLE users 
        MODIFY COLUMN user_type ENUM('client', 'tradesperson', 'admin') NOT NULL
      `);
      console.log('✅ ENUM updated successfully');
    } catch (enumError) {
      // ENUM might already be updated, continue
      console.log('ℹ️  ENUM already includes admin or table structure is correct');
    }

    // Admin credentials
    const adminData = {
      fullName: 'Admin User',
      email: 'admin@serbisyotoledo.com',
      password: 'admin123', // Change this in production!
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
          'UPDATE users SET user_type = ? WHERE email = ?',
          [adminData.userType, adminData.email]
        );
        console.log('\n✅ Admin account user_type updated successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`   Email:    ${adminData.email}`);
        console.log(`   Password: (unchanged)`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      } else {
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
      `INSERT INTO users (full_name, email, password, user_type, is_verified, is_active) 
       VALUES (?, ?, ?, ?, true, true)`,
      [adminData.fullName, adminData.email, hashedPassword, adminData.userType]
    );

    console.log('\n✅ Admin account created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email:    ${adminData.email}`);
    console.log(`   Password: ${adminData.password}`);
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

const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const getPoolConfig = () => {
  const databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.DB_URL;

  if (databaseUrl) {
    try {
      const parsedUrl = new URL(databaseUrl);
      const databaseName = parsedUrl.pathname.replace(/^\//, '');

      return {
        host: parsedUrl.hostname,
        port: parsedUrl.port ? Number(parsedUrl.port) : 3306,
        user: decodeURIComponent(parsedUrl.username || ''),
        password: decodeURIComponent(parsedUrl.password || ''),
        database: databaseName,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      };
    } catch (error) {
      console.warn('⚠️  Invalid DATABASE_URL provided. Falling back to local environment variables.', error.message);
    }
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'serbisyo_toledo',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };
};

// Create connection pool
const pool = mysql.createPool(getPoolConfig());

pool.getPoolConfig = getPoolConfig;

module.exports = pool;

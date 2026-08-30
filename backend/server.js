const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const { validateEmailConfiguration } = require('./utils/emailService');
const { assertJwtConfiguration } = require('./utils/jwt');
const { requireCsrfForCookieAuth } = require('./middleware/csrf');
const configureSocket = require('./realtime/socket');

// Load environment variables
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const emailConfig = validateEmailConfiguration();

try {
  assertJwtConfiguration();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}

if (!emailConfig.valid) {
  if (isProduction) {
    console.error(`❌ ${emailConfig.message}`);
    process.exit(1);
  }

  console.warn(`⚠️ ${emailConfig.message}`);
}

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const serviceProfileRoutes = require('./routes/serviceProfiles');
const serviceRequestRoutes = require('./routes/serviceRequests');
const notificationRoutes = require('./routes/notifications');
const userRoutes = require('./routes/user');
const assistantRoutes = require('./routes/assistant');
const messageRoutes = require('./routes/messages');

// Import database connection
const db = require('./config/database');

const app = express();

if (isProduction || process.env.RAILWAY_STATIC_URL) {
  app.set('trust proxy', 1);
}

const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175'
];

if (process.env.FRONTEND_URL) {
  defaultOrigins.push(process.env.FRONTEND_URL.trim());
}

if (process.env.VERCEL_URL) {
  defaultOrigins.push(`https://${process.env.VERCEL_URL.trim()}`);
}

if (process.env.RAILWAY_STATIC_URL) {
  defaultOrigins.push(`https://${process.env.RAILWAY_STATIC_URL.trim()}`);
}

const allowedOrigins = Array.from(new Set(
  (process.env.CORS_ORIGIN || defaultOrigins.join(','))
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
));

// Middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requireCsrfForCookieAuth);

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to SerbisyoToledo API' });
});

app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 AS ok');
    res.json({
      success: true,
      message: 'API is healthy',
      database: rows[0]?.ok === 1 ? 'connected' : 'unknown'
    });
  } catch {
    res.status(503).json({
      success: false,
      message: 'API is unavailable',
      database: 'disconnected'
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/service-profiles', serviceProfileRoutes);
app.use('/api/service-requests', serviceRequestRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/user', userRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/messages', messageRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  void next;
  console.error('Unhandled error:', err);

  if (err.message === 'Origin not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'Request origin is not allowed.'
    });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'Uploaded file is too large.'
    });
  }

  if (err.message && err.message.toLowerCase().includes('only image')) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  res.status(500).json({
    success: false,
    message: 'Something went wrong!'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

const createHttpServer = () => {
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });
  configureSocket(io);
  app.set('io', io);
  return server;
};

if (require.main === module) {
  const server = createHttpServer();

  // Test database connection and start the HTTP + Socket.IO server.
  db.getConnection()
    .then((connection) => {
      console.log('✅ Database connected successfully');
      connection.release();

      server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📍 API URL: http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('❌ Database connection failed:', err.message);
      if (isProduction) {
        console.error('❌ Refusing to start without database connection in production.');
        process.exit(1);
      }

      console.log('⚠️  Starting server without database connection (development only)...');

      server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📍 API URL: http://localhost:${PORT}`);
      });
    });
}

module.exports = app;
module.exports.createHttpServer = createHttpServer;

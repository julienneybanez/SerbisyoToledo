const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const serviceProfileRoutes = require('./routes/serviceProfiles');
const serviceRequestRoutes = require('./routes/serviceRequests');
const notificationRoutes = require('./routes/notifications');
const userRoutes = require('./routes/user');

// Import database connection
const db = require('./config/database');

const app = express();
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
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'API is unavailable',
      database: 'disconnected',
      error: error.message
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
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

// Test database connection and start server
db.getConnection()
  .then((connection) => {
    console.log('✅ Database connected successfully');
    connection.release();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 API URL: http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err.message);
    console.log('⚠️  Starting server without database connection...');
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 API URL: http://localhost:${PORT}`);
    });
  });

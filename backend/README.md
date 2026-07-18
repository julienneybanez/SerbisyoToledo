# SerbisyoToledo Backend API

Backend API for the SerbisyoToledo local services platform built with Node.js, Express, and MySQL.

## Prerequisites

- Node.js (v18 or higher)
- MySQL Server (v8.0 or higher)
- npm or yarn

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Copy the example env file and update with your MySQL credentials:

```bash
cp .env.example .env
```

Edit `.env` and update:
- `DB_PASSWORD` - Your MySQL root password (or user password)
- `JWT_SECRET` - Change to a secure random string in production
- `FRONTEND_URL` - Frontend URL used in verification and password reset links. Set this to the deployed Vercel URL in production.
- `CORS_ORIGIN` - Comma-separated allowed frontend origins. Include your Vercel domain in production.
- `PASSWORD_RESET_TOKEN_EXP_MINUTES` - Reset token expiry in minutes (recommended 15-30)
- SMTP settings for email sending:
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_SECURE` (`true` for SSL port 465, else `false`)
  - `SMTP_USER`
  - `SMTP_PASS`
  - `SMTP_FROM_NAME`
  - `SMTP_FROM_EMAIL`

Optional (legacy) vars also supported:
- `EMAIL_USER`
- `EMAIL_PASS`

Optional (recommended for reliable image delivery):
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

### Deployment Notes

For a Vercel frontend and Railway backend:

- Set `VITE_API_URL` in Vercel to your Railway API base URL, for example `https://your-app.up.railway.app/api`.
- Set `FRONTEND_URL` in Railway to your Vercel frontend URL, for example `https://your-app.vercel.app`.
- Set `CORS_ORIGIN` in Railway to your Vercel origin so the browser can reach the API.
- Keep the SMTP credentials only in Railway so email sending stays server-side.

Important: Keep `CLOUDINARY_API_SECRET` in backend/server environment only. Never expose it in frontend code.

### 3. Initialize Database

Make sure MySQL is running, then run:

```bash
node config/init-db.js
```

This will:
- Create the `serbisyo_toledo` database
- Create the `users` table with all required fields
- Create the `refresh_tokens` table
- Create the `password_reset_tokens` table

### 3.1 Migrate Existing Images to Cloudinary (optional)

After setting Cloudinary backend env vars, run:

```bash
npm run migrate:cloudinary
```

This uploads existing DB-stored images (service banners, portfolio images, profile photos) to Cloudinary and stores secure URLs.

### 4. Start the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The API will be available at `http://localhost:5000`

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/forgot-password` | Request password reset link |
| POST | `/api/auth/reset-password/:token` | Reset password using token |
| GET | `/api/auth/me` | Get current user profile (protected) |
| POST | `/api/auth/logout` | Logout user (protected) |
| PUT | `/api/auth/update-profile` | Update user profile (protected) |

### Register User

**POST** `/api/auth/register`

Request body:
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "userType": "client",
  "preferredServices": "plumbing"
}
```

For tradesperson:
```json
{
  "fullName": "Jane Smith",
  "email": "jane@example.com",
  "password": "password123",
  "userType": "tradesperson",
  "profession": "Electrician",
  "skills": ["wiring", "installation", "troubleshooting"]
}
```

### Login User

**POST** `/api/auth/login`

Request body:
```json
{
  "email": "john@example.com",
  "password": "password123",
  "loginAs": "client"
}
```

### Get Current User (Protected)

**GET** `/api/auth/me`

Headers:
```
Authorization: Bearer <your_jwt_token>
```

## Database Schema

### Users Table

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key, auto-increment |
| full_name | VARCHAR(255) | User's full name |
| email | VARCHAR(255) | Unique email address |
| password | VARCHAR(255) | Hashed password |
| user_type | ENUM | 'client' or 'tradesperson' |
| preferred_services | VARCHAR(255) | For clients only |
| profession | VARCHAR(255) | For tradesperson only |
| skills | JSON | Array of skills for tradesperson |
| profile_image | VARCHAR(500) | Profile image URL |
| phone | VARCHAR(20) | Phone number |
| address | TEXT | User address |
| bio | TEXT | User biography |
| is_verified | BOOLEAN | Email verification status |
| is_active | BOOLEAN | Account active status |
| created_at | TIMESTAMP | Account creation date |
| updated_at | TIMESTAMP | Last update date |

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [] // Validation errors (if applicable)
}
```

## Success Responses

All success responses follow this format:

```json
{
  "success": true,
  "message": "Success message",
  "data": {} // Response data
}
```

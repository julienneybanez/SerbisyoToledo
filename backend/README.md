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

### 3. Initialize Database

Make sure MySQL is running, then run:

```bash
node config/init-db.js
```

This will:
- Create the `serbisyo_toledo` database
- Create the `users` table with all required fields
- Create the `refresh_tokens` table

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

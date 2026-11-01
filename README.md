# RailReserve 🚆

[![Live Demo](https://img.shields.io/badge/Live%20Demo-railreserve-lightgreen?style=for-the-badge&logo=render)](https://railreserve-react-app.onrender.com/)

> **Live Deployment:** [https://railreserve-react-app.onrender.com/](https://railreserve-react-app.onrender.com/)

RailReserve is a full-stack railway reservation web application built with Node.js, Express, PostgreSQL (Prisma ORM), React, and Stripe. It handles end-to-end train seat reservations with features like concurrency locking, real-time seat availability, distance-based fare computation logic, payment processing via Stripe API, and administrative train/booking management.

---

## 📑 Table of Contents

- [Features](#-features)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [System Architecture & Booking Flow](#-system-architecture--booking-flow)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Configuration](#environment-configuration)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [API Documentation](#-api-documentation)
- [Security & Reliability](#-security--reliability)
- [Testing](#-testing)
- [Database Migrations & Schema](#-database-migrations--schema)

---

## 🌟 Features

### 👤 User Capabilities
- **Train Search & Auto-complete**: Search trains by source, destination station, train number, and departure date.
- **Dynamic Seat Selection & Reservation Lock**: Interactive coach layout selection with a 10-minute pessimistic lock to prevent double booking.
- **Dynamic Fare Computation**: Accurate fare calculations based on route distance, coach class, and intermediate halts.
- **Stripe Checkout**: Integrated card payments via Stripe Elements with payment intent verification.
- **Booking Management**: View past and upcoming bookings, ticket PNR status, seat numbers, and journey details.
- **Auto-Cancellation & Expiry**: Background cron automatically cancels unconfirmed reservations and releases seats.

### 🛠️ Admin Capabilities
- **Dashboard Overview**: Metrics on total users, total active trains, and confirmed bookings.
- **Train Management**: Add, update, and soft-delete trains, configure running days, halts, and coaches.
- **Booking & Refund Management**: Paginated view of all bookings across the platform with one-click refund handling that automatically releases reserved seats.

---

## 🛠️ Architecture & Tech Stack

### Frontend
- **Framework**: React 18 (SPA)
- **Routing**: React Router v6
- **UI Styling**: Bootstrap 5, Custom CSS
- **HTTP Client**: Axios with automatic 401 logout interceptor
- **Payments**: `@stripe/react-stripe-js` & `@stripe/stripe-js`
- **Error Handling**: React Error Boundaries

### Backend
- **Runtime**: Node.js v20+ / Express.js
- **ORM & DB**: Prisma ORM v7 with `@prisma/adapter-pg` over PostgreSQL (Neon)
- **Authentication**: JWT stored in `httpOnly`, `SameSite=Lax` secure cookies
- **Security**: Helmet, Express Rate Limiting (auth, booking, and search limiters), CORS whitelist
- **Payments**: Stripe Node SDK & Webhooks

---

## 🔄 System Architecture & Booking Flow

```
1. Search Train  ──►  2. Select Coach & Reserve
                             │
                             ▼ (10-min pessimistic DB lock on seats)
                      3. Fill Passenger Details & Confirm
                             │
                             ▼ (Creates PENDING booking + Stripe PaymentIntent)
                      4. Complete Stripe Payment
                             │
                             ▼
                      5. Verify Payment & Finalize
                             │
                             ├─► Success: Booking CONFIRMED, Seats locked
                             └─► Failure/Expired: Booking CANCELLED, Seats released
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v20 or higher
- **PostgreSQL**: Local instance or cloud database (e.g., NeonDB)
- **Stripe Account**: For test API keys

### Environment Configuration

#### Backend (`backend/.env`)
Create a `.env` file in the `backend/` directory:

```env
# Database
DATABASE_URL="postgresql://user:password@host/neondb?sslmode=require"
DIRECT_URL="postgresql://user:password@host/neondb?sslmode=require"

# Server
PORT=5000
CLIENT_ORIGIN="http://localhost:3000"

# Authentication
JWT_SECRET="enter-secret-jwt-key"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Admin Seed Account
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin_secure_password"
ADMIN_EMAIL="admin@railreserve.com"
ADMIN_PHONE="9999999999"
```

#### Frontend (`frontend/.env`)
Create a `.env` file in the `frontend/` directory (optional for defaults):

```env
REACT_APP_API_URL="http://localhost:5000/api"
REACT_APP_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

---

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Push schema to database:
   ```bash
   npx prisma db push
   ```
4. Seed initial stations, trains, and admin account:
   ```bash
   npm run seed
   ```
5. Start development server:
   ```bash
   npm run dev
   # or for production:
   npm start
   ```

---

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the React development server:
   ```bash
   npm start
   ```
4. Access the web app at `http://localhost:3000`.

---

## 📡 API Documentation

### Public / Auth Endpoints
| Method | Endpoint | Description | Rate Limit |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new user account | 10 req / 15 min |
| `POST` | `/api/auth/login` | Login user & receive JWT cookie | 10 req / 15 min |
| `POST` | `/api/auth/logout` | Clear auth cookie | - |
| `GET` | `/api/auth/me` | Fetch authenticated session | - |
| `GET` | `/api/trains/search` | Search trains by station & date | 60 req / min |
| `GET` | `/api/stations` | List / autocomplete stations | 60 req / min |

### User Booking Endpoints (Protected)
| Method | Endpoint | Description | Rate Limit |
|---|---|---|---|
| `POST` | `/api/bookings/reserve` | Lock seats for 10 minutes | 30 req / 15 min |
| `POST` | `/api/bookings/confirm` | Create pending booking & init payment | 30 req / 15 min |
| `POST` | `/api/bookings/verify-payment` | Verify Stripe PaymentIntent & confirm | 30 req / 15 min |
| `GET` | `/api/bookings/my` | View all user bookings | - |

### Admin Endpoints (Protected)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/dashboard` | Platform metrics and stats |
| `GET` | `/api/admin/bookings` | Paginated booking list (`?page=1&limit=50`) |
| `POST` | `/api/bookings/refund` | Trigger Stripe refund & release seats |
| `POST` | `/api/admin/trains` | Create a new train with halts & coaches |
| `DELETE` | `/api/admin/trains/:id` | Remove train and related routes |

---

## 🔒 Security & Reliability

- **Race Condition Prevention**: Seat allocation locks the specific coach record using transactional row-level queries (`SELECT ... FOR UPDATE`), preventing concurrent double-booking.
- **Fail-Fast Environment Check**: App refuses to boot if critical keys (`DATABASE_URL`, `JWT_SECRET`, etc.) are missing.
- **Multi-tiered Rate Limiting**: Dedicated rate limiters for authentication, booking creation, and high-frequency train searching.
- **Input Validation & Sanitization**: Passenger names, ages, and travel dates undergo strict server-side validation against injection and negative/out-of-bound values.
- **Session Auto-Logout**: Frontend Axios interceptor detects `401 Unauthorized` responses and immediately transitions to a logged-out state.
- **Fail-Safe Background Cleanup**: Minute-by-minute cleaner expires stale seat reservations and marks unconfirmed bookings as `CANCELLED`.

---

## 🧪 Testing

### Backend Tests
Runs native Node.js test runner (`node --test`):
```bash
cd backend
npm test
```

### Frontend Tests
Runs Jest + React Testing Library:
```bash
cd frontend
npm test -- --watchAll=false
```

---

## 🗄️ Database Migrations & Schema

Prisma v7 uses `prisma.config.ts` for database connection resolution:
- Sync schema with database:
  ```bash
  npx prisma db push
  ```
- Launch visual database browser:
  ```bash
  npx prisma studio
  ```

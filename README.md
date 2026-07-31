# Due Date Loan Payment Alert System

An end-to-end MFI (Microfinance Institution) loan tracking, repayment schedule generation, automated notification reminder engine, and portfolio risk management platform.

Live Production URL: [https://loan-reminder-one.vercel.app](https://loan-reminder-one.vercel.app)

---

## 🌟 Overview & Feature Highlights

- **Role-Based Access Control (RBAC)**: Server-enforced route guarding for 4 distinct roles: `ADMIN`, `LOAN_OFFICER`, `CREDIT_MANAGER`, and `BORROWER`.
- **Borrower & Account Management**: Complete borrower registration, photo profiles, risk scoring (`LOW`, `MEDIUM`, `HIGH`), and default password activation via email.
- **Loan Lifecycle & Schedule Math**: Auto-generates equal installment schedules with flat interest calculation, grace period handling, and status management (`ACTIVE`, `PAID`, `OVERDUE`, `DEFAULTED`).
- **Repayment Tracking**: Earliest-installment allocation math supporting partial/full payments via Cash, Mobile Money, or Bank Transfer.
- **Automated Reminder Engine**: Idempotent daily cron scheduler running at `07:00 Africa/Kigali`. Dispatches automated Email/SMS notifications for 7-day, 3-day, 1-day advance alerts, daily overdue warnings, and daily morning admin briefings.
- **Portfolio at Risk (PAR) & Financial Metrics**: Real-time calculation of PAR30, PAR60, PAR90, collection rates, total portfolio balance, and visual health indicators (🟢🟡🟠🔴).
- **Loan Messaging System**: Real-time loan-specific messaging between Borrowers and their assigned Loan Officers.
- **Audit Logs & Security**: Comprehensive audit logging of all system actions (`CREATE`, `UPDATE`, `DELETE`, `PAYMENT`) with actor tracking, bcrypt password hashing, and rate-limited authentication.
- **Data Export & Settings**: CSV streaming export for loans, and configurable notification threshold windows.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Vite + React 19 + TypeScript
- **Styling**: Vanilla CSS + Tailwind CSS (Custom Dark/Light Theme System)
- **Icons & UI**: Lucide SVG Icons, Centralized UI Primitives
- **Routing**: React Router DOM v7

### Backend
- **Runtime & Server**: Node.js + Fastify
- **Database & ORM**: PostgreSQL via Prisma ORM
- **Authentication**: JWT (`@fastify/jwt`) & bcrypt password hashing
- **Job Scheduling**: `node-cron` & `luxon` (Africa/Kigali timezone explicit binding)
- **Notification Services**: Axios HTTP integration with Notify API (`notifyapi.qa.afrisinc.com`)

---

## 🚀 Quick Start / Local Setup

### 1. Prerequisites
- Node.js (v18+)
- PostgreSQL database instance

### 2. Environment Setup

#### Backend `.env` (`backend/.env`)
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/loan_reminder?schema=public"
JWT_SECRET="super-secret-key-12345-loan-reminder"
FRONTEND_URL="http://localhost:5173"
NOTIFY_KEY="sk_96f46c734e00e32639d9699535abb22bf77aad8f84fa99ea8b237ab468a7cdf9"
NOTIFY_API_URL="https://notify-api.afrisinc.com/api/notify/send"
```

#### Frontend `.env` (`frontend/.env`)
```env
VITE_API_URL="http://localhost:3000"
```

### 3. Installation & Database Migration

```bash
# Clone the repository
git clone https://github.com/gabbrenn/loan_reminder.git
cd loan_reminder

# Setup Backend
cd backend
npm install
npx prisma db push
npx tsx prisma/seed.ts

# Setup Frontend
cd ../frontend
npm install
```

### 4. Running Locally

```bash
# Start Backend (Terminal 1)
cd backend
npm run dev

# Start Frontend (Terminal 2)
cd frontend
npm run dev
```

---

## 🔑 Default Credentials (Seeded Account)

| Role | Email | Password | Access Rights |
|---|---|---|---|
| **Admin** | `admin@loanreminder.com` | `Admin123!` | Full System Administration, User Management, Audit Logs, Settings |

*(New Loan Officers, Credit Managers, and Borrowers receive automated password activation links via email upon creation).*

---

## 🧪 Testing & System Navigation

For a comprehensive step-by-step walkthrough detailing how to test every role, loan lifecycle action, payment recording, messaging feature, and manual reminder trigger, refer to [TESTING_GUIDE.md](TESTING_GUIDE.md).

```bash
# Run Backend Integration Test Suite (65 tests)
cd backend
npm test
```

---

## 📚 API Architecture & Endpoints

| Resource | Endpoint | Methods | Access Roles |
|---|---|---|---|
| **Auth** | `/api/v1/auth/login` | `POST` | Public (Rate Limited) |
| **Auth** | `/api/v1/auth/forgot-password` | `POST` | Public |
| **Auth** | `/api/v1/auth/reset-password` | `POST` | Public |
| **Users** | `/api/v1/users` | `GET`, `POST`, `PATCH`, `DELETE` | `ADMIN` |
| **Borrowers** | `/api/v1/borrowers` | `GET`, `POST`, `PATCH`, `DELETE` | `ADMIN`, `LOAN_OFFICER` (Write), `CREDIT_MANAGER` (Read) |
| **Loans** | `/api/v1/loans` | `GET`, `POST`, `PATCH` | `ADMIN`, `LOAN_OFFICER` (Create), `CREDIT_MANAGER` (Status), `BORROWER` (Own Loans) |
| **Loans CSV** | `/api/v1/loans/export` | `GET` | `ADMIN`, `LOAN_OFFICER`, `CREDIT_MANAGER` |
| **Repayments** | `/api/v1/repayments` | `GET`, `POST` | `ADMIN`, `LOAN_OFFICER` (Record), `BORROWER` (Own History) |
| **Messages** | `/api/v1/loans/:loanId/messages` | `GET`, `POST`, `PATCH` | `ADMIN`, `LOAN_OFFICER`, `BORROWER` |
| **Dashboard** | `/api/v1/dashboard/metrics` | `GET` | All Roles (Scoped for `BORROWER`) |
| **Notifications** | `/api/v1/notifications` | `GET` | All Roles |
| **Reminders** | `/api/v1/reminders/trigger` | `POST` | `ADMIN`, `LOAN_OFFICER` |
| **Audit Logs** | `/api/v1/audit` | `GET` | `ADMIN`, `CREDIT_MANAGER` |
| **Settings** | `/api/v1/settings` | `GET`, `PATCH` | `ADMIN` |

---

## 📄 License

This project is open-source and available under the MIT License.

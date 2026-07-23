# Progress - Due Date Loan Payment Alert System

This file tracks the development progress of the MVP according to the build order in `AGENTS.md`.

## Local Setup & Run Instructions
- **Backend Port**: 3000
- **Frontend Port**: 5173
- **Database**: PostgreSQL (Prisma)
- **Env variables needed**:
  - `DATABASE_URL` (PostgreSQL connection string)
  - `JWT_SECRET` (For signing JWTs)
- **Commands**:
  - Install dependencies: `npm install` in both backend/frontend directories.
  - Setup DB: `npx prisma db push`
  - Seed DB: `npx tsx prisma/seed.ts` (seeds default admin: `admin@loanreminder.com` / `Admin123!`)
  - Run tests: `npm test` in the backend directory.
  - Run dev server: `npm run dev`

---

## Build Order Status

### 1. Auth (Login, Logout, Change Password, JWT-based)
- [x] Initialize Prisma & Postgres Schema
- [x] Create User Model with roles (`ADMIN`, `LOAN_OFFICER`, `CREDIT_MANAGER`)
- [x] Set up Password Hashing (bcrypt)
- [x] Implement Auth Repository & Service
- [x] Implement Route-level rate limiting on `/api/v1/auth/login`
- [x] Wire Controller & Routes for Login, Logout, Change Password
- [x] Write Happy-path integration test for Auth

### 2. Role Management
- [x] Role guarding middleware
- [x] Server-side role validation

### 3. Borrower Management
- [x] Add Borrower model to schema.prisma and push to DB
- [x] Implement Repository, Service, Controller, Route layers
- [x] Role-guarded CRUD endpoints under /api/v1/borrowers
- [x] Search by name/phone/email/nationalId
- [x] Write integration tests (all passing)

### 4. Loan Management
- [x] Loan creation, view, status, and repayment frequency (DAILY, WEEKLY, MONTHLY)
- [x] Role guarding (creation restricted to LOAN_OFFICER/ADMIN, default status change restricted to CREDIT_MANAGER/ADMIN)

### 5. Repayment Schedule Generation
- [x] Flat interest math: `totalPayable = principal + (principal * interestRate)`
- [x] Date segmentation across loan period with remainder absorbed by final installment

### 6. Repayment Recording
- [x] Add LoanRepayment model to schema.prisma
- [x] Implement Repository, Service, Controller, Route layers
- [x] Payment allocation engine (earliest-first, overflow roll-over)
- [x] Auto status transitions (PAID when balance = 0, OVERDUE when installments past-due)
- [x] Write integration tests (all passing)

### 7. Reminder Engine
- [x] Node-cron scheduler running daily at 07:00 Africa/Kigali (timezone configured explicitly)
- [x] Trigger rules for 7/3/1 days in advance + daily overdue alerts
- [x] Idempotency rules via NotificationLog checks (sent once for warnings, daily max for overdue)
- [x] Nodemailer integration with JSON transport fallback for local development
- [x] Manual trigger POST /api/v1/reminders/trigger endpoint (guarded to Admin/Officer)
- [x] Fully responsive inline-styled HTML layouts for borrower reminders and daily briefings
- [x] Queue-based notification processing (logs saved as PENDING and dispatched via processQueue)
- [x] 1-minute resend window for manual triggers (allows resending alerts for testing after 1 min)
- [x] Write integration tests (all passing)

### 8. Dashboard
- [x] Aggregate counts: totalBorrowers, activeLoans, dueToday, dueThisWeek, overdueLoans, notificationsSentToday
- [x] Repayment Status Indicator: 🟢 GREEN / 🟡 YELLOW / 🟠 ORANGE / 🔴 RED badge per loan
- [x] Africa/Kigali timezone math for day-diff calculations
- [x] All roles can access GET /api/v1/dashboard/metrics
- [x] Write integration tests (all passing)

### 9. Notification Log
- [x] List all notifications with borrower + loan context (GET /api/v1/notifications)
- [x] Filter by channel (EMAIL/SMS) and status (SENT/FAILED)
- [x] Retrieve single notification log by ID (GET /api/v1/notifications/:id)
- [x] All roles can view notification logs
- [x] Write integration tests (all passing)

---

## Decisions Made
- Single-tenant design.
- Database setup with Postgres + Prisma.
- Downgraded Prisma to v6.2.1 to preserve standard connection URL formats in schema.prisma.
- Flat interest rate math.
- Role guarding implemented via custom Fastify `preHandler` hook.
- Borrower module uses same layered architecture. WRITE ops restricted to ADMIN/LOAN_OFFICER. READ ops open to all 3 roles.
- Frontend implemented with Vite, React 19, TypeScript, and Tailwind CSS.
- Frontend includes route guards, proxy to backend, and forms corresponding to all 9 modules.
- PAR30/60/90 computed server-side from RepaymentSchedule due dates vs today (Africa/Kigali).
- Borrower risk score is purely rule-based (overdue installment count + DEFAULTED flag). No AI required.
- `createdById` FK on Loan uses `SetNull` on delete — officer-deleted loans remain in the system, just un-assigned.
- CSV export is streamed as `text/csv` response — no temp files, no S3.
- Daily admin briefing email is best-effort: failure is logged to console but does NOT crash the cron run.
- Swapped daily-level email idempotency check for a 1-minute window check, enabling supervisors to trigger and test resending email.
- Exposed a PATCH /profile endpoint to update admin details (email/name) and return a new JWT token, keeping frontend context in sync.

---

## Enhancement Features (Post-MVP)

### 10. User Management (Admin Only)
- [x] New user module: `user.{repository,service,controller,route}.ts`
- [x] CRUD endpoints: `GET/POST /api/v1/users`, `PATCH/DELETE /api/v1/users/:id`
- [x] Self-deletion and self-demotion guards in service layer
- [x] `UsersPage.tsx` — table with role badges, create/edit modals, delete with confirmation
- [x] `/users` route guard: `AdminRoute` component in router, nav link only visible to Admin
- [x] Integration tests: 7 cases, all passing

### 11. PAR Metrics (Portfolio at Risk)
- [x] PAR30, PAR60, PAR90 computed in `dashboard.service.ts` from schedule overdue days
- [x] Collection Rate (this month's amountPaid / amountDue) added to metrics response
- [x] Total portfolio balance exposed for context
- [x] `DashboardPage.tsx` — animated progress bar gauges for PAR, circular SVG dial for collection rate

### 12. Borrower Risk Score
- [x] `calculateRiskScore()` in `borrower.service.ts` — LOW / MEDIUM / HIGH
- [x] Logic: HIGH = DEFAULTED loan or 3+ overdue installments; MEDIUM = 1–2; LOW = clean
- [x] Attached to both `listBorrowers()` and `getBorrower()` responses
- [x] `BorrowersPage.tsx` — color-coded risk badge per row (🟢/🟡/🔴)

### 13. Loan Officer Assignment
- [x] `createdById` nullable FK added to Loan schema (`prisma db push` applied)
- [x] `LoanService.createLoan()` resolves officer from JWT; skips FK if user not found (test safety)
- [x] `createdBy` relation included in `findAll()` and `findById()` responses
- [x] `LoansPage.tsx` — Officer column shows assigned name; "My Loans" toggle for Loan Officers

### 14. CSV Export
- [x] `GET /api/v1/loans/export?status=<optional>` — streams CSV with all loan fields
- [x] Frontend: "📤 Export CSV" button on LoansPage, respects current status filter

### 15. Daily Admin Briefing Email
- [x] After each cron run, `reminder.service.ts` fetches all ADMIN emails and sends a morning briefing
- [x] Stats included: total checked, sent count, failed count, date/time in Africa/Kigali
- [x] Failure is silently logged — never crashes the cron job

### 16. System Settings & Custom Alerts (Admin Only)
- [x] Configurable reminder day windows (Days Before 1/2/3) in database settings table
- [x] Globally enable/disable Email and SMS channels in settings UI
- [x] `SettingsPage.tsx` — Admin form for custom alert configuration and channel toggles
- [x] [NEW] Admin profile settings (name & email address updating) with live AuthContext token refresh
- [x] Integration tests covering default fetch, updates, and access controls

### 17. Audit Logs
- [x] `AuditLog` table capturing actor, action (`CREATE`, `UPDATE`, `DELETE`, `STATUS_CHANGE`, `PAYMENT`), target model entity name, and UUID key
- [x] Layered module (`audit.{repository,service,controller,route}`) open to Admin and Credit Manager
- [x] `AuditLogPage.tsx` — Table with filters by target entity name and action type
- [x] Integration tests asserting log creation when borrower operations occur

### 18. Additional Domain Enhancements
- [x] **Borrower Photo**: `photo` URL field in profile, renders avatar image in borrowers list
- [x] **Loan Purpose**: `purpose` text field in loan creation, displayed in summaries
- [x] **Grace Period**: `gracePeriodDays` property dynamically delays transition to `OVERDUE` status
- [x] **Payment Method**: `paymentMethod` (`CASH`, `MOBILE_MONEY`, `BANK_TRANSFER`) recorded on repayment history
- [x] **Pending Notification Status**: Logs created as `PENDING` before email dispatch, then updated to `SENT`/`FAILED`
- [x] **Notification Text Logging**: Raw message body stored on `NotificationLog.message` for future reference

---

## Open Questions / Blocked
- *None — all features complete*

---

## UI Redesign (Professional Polish)

### Decisions Made
- Replaced the mixed AI-generated aesthetic (excessive gradients, emoji nav, mixed border radii, inconsistent palette) with a professional, corporate dark design system.
- Design system: `#0c0e13` page background, `#0f1117` cards/sidebar, `#161b27` inputs — all from a single neutral-dark palette.
- **Single accent color**: `blue-600` (`#2563eb`) used consistently for primary actions. No more per-page purple/indigo/emerald accent mixing.
- **Border radius**: uniform `rounded-md` (6px) for all containers, inputs, badges, and buttons. No more `rounded-2xl` mixed with `rounded` mixed with `rounded-full`.
- **Sidebar**: Replaced emoji nav items with clean SVG icons, responsive hamburger toggle for mobile.
- **Status badges**: uniform `text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wide` pattern across all pages.
- **Tables**: uniform `px-5 py-3.5` cell padding, `divide-y divide-slate-100 dark:divide-white/[0.04]` row separator, `hover:bg-slate-50 dark:hover:bg-white/[0.02]` row hover.
- **Modals**: consistent `bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.08] rounded-md` container, close X button top-right.
- **Toggle switches**: SettingsPage now uses custom slide toggle instead of checkbox inputs.
- **Login**: Added password show/hide toggle eye button, loading spinner inside submit button.
- **LoanDetailPage**: Added a repayment progress bar in the header card showing % paid.
- Inter font imported via Google Fonts in `index.css` for consistent typography.
- `App.css` cleared of stale Vite boilerplate.
- **Theme support**: Added a Sun/Moon theme toggle in the header, storing the user selection in `localStorage` and defaulting to system preference. Uses Tailwind v4 `@custom-variant dark` to support full dark/light styling on all elements.
- **Shared Primitives**: Centralized common styled primitives in `components/ui.tsx` to keep dark/light styling unified and reduce code size.

### Files Changed
- `src/index.css` — Inter font import & dark mode variant configuration
- `src/App.css` — cleared boilerplate
- `src/components/ui.tsx` — shared UI primitives (inputs, selectors, badges, tables, modals)
- `src/context/ThemeContext.tsx` — theme toggler state provider
- `src/components/Layout.tsx` — layout with theme toggler button
- All pages in `src/pages/` — rewrites to use `ui.tsx` with light & dark variations (dual classes)



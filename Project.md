# MVP Scope & Architecture Decisions
> Read this section FIRST. It overrides ambiguity in the full spec below. The full spec below is the long-term vision — this section defines what actually gets built in V1, and locks down the decisions an AI should not be left to guess.

## 0. How to use this document
- This file is the single source of truth for scope and decisions.
- Build a separate `PROGRESS.md` file at the project root and update it after every meaningful step: what's done, what's in progress, what's next, any decisions made along the way, and how to run the project locally. Any AI or human picking this up must be able to read `PROGRESS.md` and continue without re-reading this whole spec.
- Follow Repository → Service → Controller → Route → Model layering on the backend, strictly:
  - **Repository**: pure DB access only (Prisma calls). No business logic, no validation.
  - **Service**: all business logic, orchestration, validation calls out. No direct Prisma calls.
  - **Controller**: parses request, calls service, shapes response. No business logic.
  - **Route**: wires HTTP method + path to controller + middleware (auth, validation).
  - **Model**: Prisma schema / types only.
- Definition of done for any module = code + input validation + error handling + happy-path test + entry in `PROGRESS.md`.

## 1. Tenancy model
**Decision: Single-tenant for V1.** One deployment = one lending institution. No `organizationId` scoping, no cross-org isolation logic. Multi-tenancy is a documented future improvement (see spec section 8), not a V1 concern. This removes an entire axis of complexity from auth, schema, and queries.

## 2. V1 Scope Cut
Build these modules fully, in this order. Do not start module N+1 until N is functionally complete and in `PROGRESS.md` as done.

1. **Auth** — Login, Logout, Change Password (email/password + JWT). Skip "Forgot Password" email flow in V1 (stub the endpoint, real email delivery in V2) unless email sending is already wired for reminders, in which case include it.
2. **Role Management** — Admin, Loan Officer, Credit Manager as fixed enum roles (not a dynamic roles table). Middleware-based route guarding.
3. **Borrower Management** — Add/Edit/Delete/Search. Fields: Full Name, National ID, Phone, Email, Address, Occupation, Guarantor Name + Phone (guarantor as two plain fields, not a separate table, for V1). **Skip ID/photo upload in V1** — defer to V2 (see Storage decision below).
4. **Loan Management** — Create loan, view loan, loan status (Active/Paid/Overdue/Defaulted), repayment frequency (Daily/Weekly/Monthly).
5. **Repayment Schedule Generation** — auto-generated on loan creation (see Loan Math decision below).
6. **Repayment Recording** — record payment (partial/full), auto-update remaining balance and next due item.
7. **Reminder Engine** — the core differentiator. Daily cron, email only in V1 (see Notifications decision below).
8. **Dashboard** — counts (Total Borrowers, Active Loans, Due Today, Due This Week, Overdue, Notifications Sent Today) + Repayment Status Indicator (🟢🟡🟠🔴). **Skip charts in V1** — numbers and colored badges only; charts are V2 polish.
9. **Notification Log** — table + simple list view (date, borrower, channel, status). No filters/export yet.

**Explicitly deferred to V2+ (do not build in V1):**
- SMS integration (Twilio/Africa's Talking) — email-only reminders first
- PDF/Excel report export
- Audit Logs
- System Settings UI (reminder days etc. can be a hardcoded config value: 7/3/1 days)
- Database backup tooling
- ID/photo upload, Cloudinary integration
- Borrower self-service portal
- Charts on dashboard
- WhatsApp, mobile app, Mobile Money, AI prediction (spec section 8 items)

## 3. Loan math (previously unspecified — now locked)
**Decision: Flat/simple interest, computed once at loan creation** (simplest correct option for MVP; reducing-balance is a documented V2 upgrade).

- `totalPayable = principal + (principal * interestRate)`  — interest rate is a flat rate for the full loan term, not annualized/prorated in V1.
- On loan creation, generate a `RepaymentSchedule`: split `totalPayable` into equal installments according to frequency (Daily/Weekly/Monthly) between Loan Date and Due Date.
- On partial payment: reduce the *current* installment's outstanding amount; do not recalculate future installments. Full payment of an installment marks it settled and advances to the next.
- Loan status transitions:
  - `Active` → all installments not yet fully paid, none overdue
  - `Overdue` → any installment past its due date with outstanding balance
  - `Paid` → all installments fully paid
  - `Defaulted` → manually set by Credit Manager/Admin (not automatic in V1)

## 4. Reminder Engine — operational details
- Cron runs once daily at **07:00 Africa/Kigali** (server timezone should be set explicitly, not assumed from host).
- Reminder days: **7, 3, 1** days before due date, plus a daily overdue reminder for any installment past due.
- **Idempotency**: before sending, check `NotificationLog` for an existing entry matching `(loanRepaymentId, reminderType, date)`. Never send the same reminder type twice for the same installment.
- If a due date changes after a reminder was already sent for the old date, treat it as a new schedule — do not attempt to "unsend"; just apply idempotency going forward from the new date.
- On send failure (email provider error): log status `Failed` in `NotificationLog` with the error message, do not crash the cron job, continue to the next borrower. A simple one-time retry on the next cron run is enough for V1 (no exponential backoff queue yet).

## 5. Notifications — channel decision
**Decision: Email only in V1**, via Nodemailer. SMS (Twilio/Africa's Talking) is fully deferred to V2. Build the `NotificationLog` schema so it already supports a `channel` field (`EMAIL` | `SMS`) so SMS can be added later without a schema migration.

## 6. File storage
**Deferred entirely in V1** — no ID/photo upload UI or backend. If needed sooner, default choice when built is Cloudinary (matches spec section 6), not local disk, since this will deploy to Render/VPS with ephemeral storage.

## 7. Non-functional requirements (explicit, not implied)
- Passwords hashed with **bcrypt** (or argon2), never stored plain.
- JWT access token short-lived (e.g., 15–30 min) is optional for V1; a single reasonably-lived token (e.g., 7 days) is acceptable to start — do not over-engineer refresh token rotation for MVP unless asked.
- Rate limit the login endpoint (basic in-memory or Fastify rate-limit plugin) to blunt brute force.
- All inputs validated at the route layer using a schema library (zod or Fastify's built-in JSON schema) — reject bad input before it reaches the service layer.
- Server-side authorization checks on every protected route based on role, not just UI hiding of buttons.
- Basic structured logging (request method/path/status/duration) — no need for a full observability stack in V1.
- Errors return consistent JSON shape: `{ error: { message, code } }`.

## 8. API contract convention
- REST, JSON, versioned under `/api/v1/...`.
- Standard CRUD verbs/paths per resource (e.g., `GET/POST /api/v1/borrowers`, `GET/PATCH/DELETE /api/v1/borrowers/:id`).
- Auth via `Authorization: Bearer <jwt>` header.
- Document actual endpoints as they're built inside `PROGRESS.md`, not in this file (this file states conventions, not the live list).

## 9. Definition of "MVP is done"
V1 is complete when: an Admin can create a Loan Officer account; a Loan Officer can register a borrower, create a loan, see it appear correctly color-coded on the dashboard, have the system automatically email a 7/3/1-day and overdue reminder with correct idempotency, and record a payment that updates the loan's status — all with basic auth/role protection and no manual intervention required for the reminder flow.

---

# Original Full Spec (long-term vision — build against the MVP scope above, not all of this at once)

Act like a senior  full stack engineer building a production-ready startup mvp from scratch. first design the complete system architecture then build the most minimal but scalable version possible and production ready code.
and make plan and progress file you update each time where anyone or any AI can ready and know the progress and can continue where you left off also try to use Repository,service,model,route and controller on backend.


Due Date Loan Payment Alert System
1. Project Overview

The Due Date Loan Payment Alert System is a web-based application designed to help SACCOs, Microfinance Institutions (MFIs), and other lending institutions monitor loan repayments and automatically remind borrowers before their loan due dates.

The system aims to reduce late loan repayments by sending automated SMS and email reminders, enabling loan officers to monitor repayment schedules, manage borrower information, and generate reports for management.

2. Users (Actors)
System Administrator

Responsibilities

Create and manage user accounts
Assign user roles
Configure SMS and Email settings
Configure reminder days
View audit logs
Backup database
Manage system settings
Loan Officer

Responsibilities

Register borrowers
Edit borrower information
Create loans
Update loan repayments
View upcoming due loans
View overdue loans
Send manual reminders
View notification history
Credit Manager

Responsibilities

View loan portfolio
Approve loans (optional)
Monitor repayment performance
View reports
Export reports
Borrower

No login required (optional portal later)

Receives

SMS reminder
Email reminder

Optional future

Borrower Portal
3. Core Modules
Authentication
Login
Logout
Forgot Password
Change Password
Dashboard

Shows

Total Borrowers
Active Loans
Loans Due Today
Loans Due This Week
Overdue Loans
Notifications Sent Today

Charts

Monthly repayments
Loan status
Reminder statistics
Borrower Management

Features

Add borrower
Edit borrower
Delete borrower
Search borrower
Upload ID
Upload photo (optional)

Borrower Information

Full Name
National ID
Phone
Email
Address
Occupation
Guarantor
Loan Management

Loan Information

Loan Number
Borrower
Principal Amount
Interest Rate
Loan Date
Due Date
Repayment Frequency

Frequency

Daily
Weekly
Monthly

Loan Status

Active
Paid
Overdue
Defaulted
Repayment Module

Functions

Record payment
Partial payment
Full payment
Remaining balance
Payment history
Reminder Engine ⭐

This is the heart of the project.

System automatically checks every day.

If

Loan due in

7 days
3 days
1 day

↓

Send reminder

If overdue

↓

Send overdue reminder

No manual work.

Notification Module

Supports

SMS

Example

Dear Jean Claude,

Your loan payment of RWF 50,000 is due on 20 July 2026.

Please pay before the due date.

Thank you.

Ijabo Remera SACCO

Email

Same content but formatted.

Notification Log

Store

Date
Time
Borrower
SMS Status
Email Status
Failed/Delivered
Reports

Generate

Borrower Report

Loan Report

Overdue Report

Reminder Report

Monthly Collection Report

Export

PDF

Excel

4. Database Tables

Users

Roles

Borrowers

Loans

LoanRepayments

RepaymentSchedules

Notifications

NotificationLogs

Settings

AuditLogs

5. User Roles

Admin

Loan Officer

Credit Manager

6. Technologies

Frontend

Vite + TypeScript

TailwindCSS

Backend

Node.js

Fastify

Database

Postgres

ORM

Prisma

Authentication

JWT

SMS

Twilio or Africa's Talking

Email

Nodemailer

Cloud

Cloudinary (optional)

Deployment

Render / VPS

7. Simple Innovation (easy but impressive)

Instead of only sending reminders...

The system assigns every borrower a Repayment Status Indicator.

🟢 Green

No payment due.

🟡 Yellow

Payment due within 7 days.

🟠 Orange

Payment due tomorrow.

🔴 Red

Overdue.

This is very easy to implement but makes the dashboard much more useful.

Another small innovation is a Daily Reminder Summary:

Every morning, loan officers receive a dashboard summary such as:

8 loans due today
5 loans due tomorrow
3 overdue loans

No AI required, but it feels modern.

8. Future Improvements
WhatsApp reminders
Mobile application
Borrower self-service portal
Payment integration (Mobile Money)
AI-based prediction of borrowers likely to miss payments
Development Checklist
Authentication
Role Management
Dashboard
Borrower Management
Loan Management
Repayment Management
Reminder Scheduler (Cron Job)
SMS Integration
Email Integration
Notification Logs
Reports (PDF/Excel)
Search & Filters
Audit Logs
Settings
Testing
Deployment
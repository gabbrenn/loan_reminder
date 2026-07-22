# AGENTS.md — Due Date Loan Payment Alert System

This file is the standing project contract. Read it before every task. Full context lives in `Project.md`; this file is the enforced summary. If anything here conflicts with an ad-hoc instruction mid-session, this file wins unless the user explicitly overrides it in that message.

## 0. Session protocol
- Before starting any task, read `PROGRESS.md` (create it if it doesn't exist) to see what's done and what's next.
- Work **one module at a time**, in the order listed under "Build order" below. Do not start the next module until the current one is functionally complete.
- After finishing a task (or a meaningful chunk of one), update `PROGRESS.md`:
  - What was completed
  - What's in progress / blocked
  - What's next
  - Any decision made that wasn't already specified here (so a human or another agent isn't surprised later)
  - How to run the project locally (keep this current — commands, env vars, seed data)
- Never silently expand scope beyond the current module. If you think something extra is needed, note it in `PROGRESS.md` under "Open questions" instead of building it.

## 1. Backend architecture — strict layering
Every backend feature must follow this separation. Do not collapse layers for convenience.

- **Repository**: pure DB access via Prisma. No business logic, no validation, no request/response shaping.
- **Service**: all business logic, orchestration, and validation *decisions* live here. Never calls Prisma directly — always goes through a repository.
- **Controller**: parses the request, calls the service, shapes the HTTP response. No business logic.
- **Route**: wires HTTP method + path to controller + middleware (auth, request schema validation).
- **Model**: Prisma schema / generated types only.

Folder convention: `src/modules/<feature>/{feature}.repository.ts, .service.ts, .controller.ts, .route.ts}`. Shared Prisma client in `src/lib/prisma.ts`.

## 2. Tech stack (do not substitute without asking)
- Frontend: Vite + TypeScript + TailwindCSS
- Backend: Node.js + Fastify
- DB: PostgreSQL via Prisma
- Auth: JWT (bcrypt for password hashing)
- Email: Nodemailer
- Validation: zod (or Fastify JSON schema) at the route layer — never trust unvalidated input reaching a service

## 3. Tenancy
Single-tenant. No `organizationId` scoping anywhere. Do not add multi-org logic even if it seems "more correct" — it's explicitly out of scope for V1.

## 4. Build order (do not reorder or skip ahead)
1. Auth — login, logout, change password. JWT-based. Skip real "forgot password" email delivery unless email is already wired.
2. Role management — fixed enum roles (`ADMIN`, `LOAN_OFFICER`, `CREDIT_MANAGER`), middleware-based route guarding. No dynamic roles table.
3. Borrower management — add/edit/delete/search. Fields: full name, national ID, phone, email, address, occupation, guarantor name + guarantor phone (plain fields, not a separate table). **No ID/photo upload in V1.**
4. Loan management — create/view loan, status enum (`ACTIVE`, `PAID`, `OVERDUE`, `DEFAULTED`), frequency enum (`DAILY`, `WEEKLY`, `MONTHLY`).
5. Repayment schedule generation — auto-generated on loan creation (see loan math below).
6. Repayment recording — partial/full payment, auto-updates balance and current installment.
7. Reminder engine — daily cron, email-only (see reminder rules below).
8. Dashboard — counts (total borrowers, active loans, due today, due this week, overdue, notifications sent today) + Repayment Status Indicator (🟢🟡🟠🔴 per loan). No charts in V1.
9. Notification log — table + simple list view (date, borrower, channel, status). No filters/export yet.

**Do not build, unless explicitly asked:** SMS integration, PDF/Excel export, audit logs, settings UI, DB backup tooling, file/photo upload, borrower self-service portal, dashboard charts, WhatsApp, mobile app, Mobile Money, AI prediction.

## 5. Loan math (locked — do not invent alternative logic)
- Flat interest, computed once at loan creation: `totalPayable = principal + (principal * interestRate)`.
- On creation, split `totalPayable` into equal installments per the loan's frequency between loan date and due date, stored as a `RepaymentSchedule`.
- Partial payment reduces the *current* installment's outstanding amount only — never recalculates future installments.
- Full payment of an installment marks it settled and advances to the next.
- Status transitions: `ACTIVE` (no installment overdue) → `OVERDUE` (any installment past due with balance) → `PAID` (all installments settled). `DEFAULTED` is set manually by Admin/Credit Manager only — never automatic.

## 6. Reminder engine — operational rules (this is the core module, treat carefully)
- Cron runs daily at 07:00 Africa/Kigali. Set timezone explicitly in code — never rely on host default.
- Reminder triggers: 7 days, 3 days, 1 day before due date, plus a daily reminder for any overdue installment.
- **Idempotency is mandatory**: before sending, check `NotificationLog` for an existing `(loanRepaymentId, reminderType, date)` entry. Never send the same reminder twice.
- If a due date changes after a reminder already sent, do not try to unsend it — just apply idempotency forward from the new date.
- On send failure: log status `FAILED` with the error message in `NotificationLog`, do not crash the job, continue to the next borrower. One retry on the next day's cron run is enough for V1.
- Channel: email only via Nodemailer for V1. Shape `NotificationLog.channel` as an enum (`EMAIL` | `SMS`) so SMS can be added later without a migration — but do not implement SMS now.

## 7. Non-functional requirements (non-negotiable, even for MVP)
- Passwords hashed with bcrypt (or argon2) — never plaintext, never logged.
- Rate-limit the login route.
- Validate all inputs at the route layer before they reach a service.
- Enforce role checks server-side on every protected route — never rely on frontend hiding a button.
- Structured request logging: method, path, status, duration.
- Consistent error shape: `{ error: { message, code } }`.

## 8. API conventions
- REST, JSON, versioned under `/api/v1/...`.
- Standard resource verbs/paths, e.g. `GET/POST /api/v1/borrowers`, `GET/PATCH/DELETE /api/v1/borrowers/:id`.
- Auth via `Authorization: Bearer <jwt>`.
- Record the actual live endpoint list in `PROGRESS.md` as they're built — this file only states the convention.

## 9. Definition of done (per module and overall)
A module is done when: code + input validation + error handling + at least one happy-path test + an entry in `PROGRESS.md` exist for it.

The full MVP is done when: an Admin can create a Loan Officer account; a Loan Officer can register a borrower, create a loan, see it correctly color-coded on the dashboard, have the system automatically email 7/3/1-day and overdue reminders with correct idempotency, and record a payment that updates loan status — all behind working auth/role protection, with no manual step required for the reminder flow.

## 10. When uncertain
If a requirement is ambiguous and not resolved above or in `Project.md`, make the simplest reasonable choice, note it explicitly in `PROGRESS.md` under "Decisions made," and keep moving. Do not stop and wait for clarification on minor implementation details — only stop for genuine scope questions (e.g., "should this be in V1 at all?").
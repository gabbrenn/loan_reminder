import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { repaymentRoutes } from './repayment.route';
import { loanRoutes } from '../loan/loan.route';
import prisma from '../../lib/prisma';

describe('Repayment Recording Integration Tests', () => {
  let app: any;
  let adminToken: string;
  let officerToken: string;
  let creditManagerToken: string;
  let borrowerId: string;
  let loanIdWeekly: string;   // 4-installment (28-day weekly) loan - principal 1000, rate 0.1
  let loanIdMonthly: string;  // 1-installment (30-day monthly) loan - principal 500, rate 0.0

  before(async () => {
    app = Fastify();
    app.register(fastifyJwt, { secret: 'test-secret-key-12345' });
    app.register(fastifyRateLimit, { global: false });
    app.decorate('authenticate', async (request: any, reply: any) => {
      try {
        await request.jwtVerify();
      } catch {
        return reply.code(401).send({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
      }
    });
    app.register(loanRoutes, { prefix: '/api/v1/loans' });
    app.register(repaymentRoutes, { prefix: '/api/v1/repayments' });
    await app.ready();

    adminToken = app.jwt.sign({ id: 'admin-id', email: 'admin@test.com', role: 'ADMIN', name: 'Admin' });
    officerToken = app.jwt.sign({ id: 'officer-id', email: 'officer@test.com', role: 'LOAN_OFFICER', name: 'Officer' });
    creditManagerToken = app.jwt.sign({ id: 'cm-id', email: 'cm@test.com', role: 'CREDIT_MANAGER', name: 'Manager' });

    // Create test borrower
    const borrower = await prisma.borrower.create({
      data: {
        fullName: 'Repayment Test Borrower',
        nationalId: 'NID-REPAY-TEST-999',
        phone: '+250788007777',
        email: 'repay.test@example.com',
        address: 'Kigali',
        occupation: 'Farmer',
        guarantorName: 'Guarantor G',
        guarantorPhone: '+250788007778',
      },
    });
    borrowerId = borrower.id;

    // Create a 4-installment loan (principal 1000, rate 10%, 28 days, weekly = 4 installments of 275)
    const loanDate = new Date();
    const dueDate28 = new Date();
    dueDate28.setDate(dueDate28.getDate() + 28);

    const loanRes = await app.inject({
      method: 'POST',
      url: '/api/v1/loans',
      headers: { authorization: `Bearer ${officerToken}` },
      payload: {
        borrowerId,
        principalAmount: 1000,
        interestRate: 0.1,
        loanDate: loanDate.toISOString(),
        dueDate: dueDate28.toISOString(),
        frequency: 'WEEKLY',
      },
    });
    loanIdWeekly = JSON.parse(loanRes.payload).id;

    // Create a 1-installment loan (principal 500, rate 0%, 30 days, monthly = 1 installment of 500)
    const dueDate30 = new Date();
    dueDate30.setDate(dueDate30.getDate() + 30);

    const loanRes2 = await app.inject({
      method: 'POST',
      url: '/api/v1/loans',
      headers: { authorization: `Bearer ${officerToken}` },
      payload: {
        borrowerId,
        principalAmount: 500,
        interestRate: 0,
        loanDate: loanDate.toISOString(),
        dueDate: dueDate30.toISOString(),
        frequency: 'MONTHLY',
      },
    });
    loanIdMonthly = JSON.parse(loanRes2.payload).id;
  });

  after(async () => {
    await prisma.loanRepayment.deleteMany({ where: { loan: { borrowerId } } });
    await prisma.repaymentSchedule.deleteMany({ where: { loan: { borrowerId } } });
    await prisma.loan.deleteMany({ where: { borrowerId } });
    await prisma.borrower.delete({ where: { id: borrowerId } });
    await app.close();
    await prisma.$disconnect();
  });

  // ─── Authorization ─────────────────────────────────────────────────────────

  test('POST / - Credit Manager cannot record a payment (403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/repayments',
      headers: { authorization: `Bearer ${creditManagerToken}` },
      payload: { loanId: loanIdWeekly, amount: 100, paymentDate: new Date().toISOString(), paymentMethod: 'CASH' },
    });
    assert.strictEqual(res.statusCode, 403);
  });

  test('POST / - Unauthenticated request is rejected (401)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/repayments',
      payload: { loanId: loanIdWeekly, amount: 100, paymentDate: new Date().toISOString(), paymentMethod: 'CASH' },
    });
    assert.strictEqual(res.statusCode, 401);
  });

  // ─── Partial Payment ────────────────────────────────────────────────────────

  test('POST / - Partial payment on first installment (200 / 275), status stays ACTIVE', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/repayments',
      headers: { authorization: `Bearer ${officerToken}` },
      payload: { loanId: loanIdWeekly, amount: 200, paymentDate: new Date().toISOString(), paymentMethod: 'CASH' },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.loan.status, 'ACTIVE');
    assert.strictEqual(body.loan.remainingBalance, 900);

    const firstInstallment = body.loan.repaymentSchedules[0];
    assert.strictEqual(firstInstallment.amountPaid, 200);
  });

  // ─── Overflow Payment ───────────────────────────────────────────────────────

  test('POST / - Payment of 350 should complete first installment and roll 75 to second', async () => {
    // So far: first installment has 200 paid, 75 remaining. Remaining balance on loan = 900.
    // Payment of 350 → 75 clears first installment, 275 clears second installment entirely.
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/repayments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { loanId: loanIdWeekly, amount: 350, paymentDate: new Date().toISOString(), paymentMethod: 'MOBILE_MONEY' },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    const schedules = body.loan.repaymentSchedules;

    // First and second installments should be fully paid
    assert.strictEqual(schedules[0].amountPaid, 275);
    assert.strictEqual(schedules[1].amountPaid, 275);
    // Third installment unchanged
    assert.strictEqual(schedules[2].amountPaid, 0);

    assert.strictEqual(body.loan.remainingBalance, 550);
    assert.strictEqual(body.loan.status, 'ACTIVE');
  });

  // ─── Full Payment ───────────────────────────────────────────────────────────

  test('POST / - Full payment on monthly 1-installment loan marks loan as PAID', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/repayments',
      headers: { authorization: `Bearer ${officerToken}` },
      payload: { loanId: loanIdMonthly, amount: 500, paymentDate: new Date().toISOString(), paymentMethod: 'BANK_TRANSFER' },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.loan.status, 'PAID');
    assert.strictEqual(body.loan.remainingBalance, 0);
    const installment = body.loan.repaymentSchedules[0];
    assert.strictEqual(installment.amountPaid, installment.amountDue);
  });

  test('POST / - Recording payment on fully paid loan should be rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/repayments',
      headers: { authorization: `Bearer ${officerToken}` },
      payload: { loanId: loanIdMonthly, amount: 100, paymentDate: new Date().toISOString(), paymentMethod: 'CASH' },
    });
    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.ok(body.error.message.includes('fully paid'));
  });

  // ─── History ─────────────────────────────────────────────────────────────────

  test('GET /loan/:loanId - Credit Manager can view repayment history', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/repayments/loan/${loanIdWeekly}`,
      headers: { authorization: `Bearer ${creditManagerToken}` },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body));
    // We made 2 payments on the weekly loan so far
    assert.ok(body.length >= 2);
  });

  test('GET /loan/:loanId - Returns 404 for non-existent loan', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/repayments/loan/non-existent-loan-id',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.statusCode, 404);
  });
});

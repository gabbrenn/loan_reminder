import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { reminderRoutes } from './reminder.route';
import { loanRoutes } from '../loan/loan.route';
import prisma from '../../lib/prisma';
import { DateTime } from 'luxon';

describe('Reminder Engine Integration Tests', () => {
  let app: any;
  let adminToken: string;
  let officerToken: string;
  let creditManagerToken: string;
  let borrowerId: string;

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
    app.register(reminderRoutes, { prefix: '/api/v1/reminders' });
    await app.ready();

    adminToken = app.jwt.sign({ id: 'admin-id', email: 'admin@test.com', role: 'ADMIN', name: 'Admin' });
    officerToken = app.jwt.sign({ id: 'officer-id', email: 'officer@test.com', role: 'LOAN_OFFICER', name: 'Officer' });
    creditManagerToken = app.jwt.sign({ id: 'cm-id', email: 'cm@test.com', role: 'CREDIT_MANAGER', name: 'Manager' });

    // Reset settings to defaults
    await prisma.systemSetting.deleteMany();
    await prisma.systemSetting.create({ data: {} });

    // Create test borrower
    const borrower = await prisma.borrower.create({
      data: {
        fullName: 'Reminder Test Borrower',
        nationalId: 'NID-REM-TEST-888',
        phone: '+250788008880',
        email: 'reminder.test@example.com',
        address: 'Kigali',
        occupation: 'Worker',
        guarantorName: 'Guarantor R',
        guarantorPhone: '+250788008881',
      },
    });
    borrowerId = borrower.id;
  });

  after(async () => {
    // Cleanup test data
    await prisma.notificationLog.deleteMany({ where: { repaymentSchedule: { loan: { borrowerId } } } });
    await prisma.repaymentSchedule.deleteMany({ where: { loan: { borrowerId } } });
    await prisma.loan.deleteMany({ where: { borrowerId } });
    await prisma.borrower.delete({ where: { id: borrowerId } });
    await app.close();
    await prisma.$disconnect();
  });

  test('POST /trigger - Credit Manager cannot trigger (403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reminders/trigger',
      headers: { authorization: `Bearer ${creditManagerToken}` },
    });
    assert.strictEqual(res.statusCode, 403);
  });

  test('POST /trigger - Unauthenticated request is rejected (401)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reminders/trigger',
    });
    assert.strictEqual(res.statusCode, 401);
  });

  test('POST /trigger - Should run reminder calculations and respect idempotency rules', async () => {
    // 1. Create a loan due in exactly 7 days from now (requires BEFORE_7_DAYS)
    const kigaliToday = DateTime.now().setZone('Africa/Kigali');
    
    // Loan A: 7 days due
    const dueDateA = kigaliToday.plus({ days: 7 }).toJSDate();
    const loanResA = await app.inject({
      method: 'POST',
      url: '/api/v1/loans',
      headers: { authorization: `Bearer ${officerToken}` },
      payload: {
        borrowerId,
        principalAmount: 100,
        interestRate: 0,
        loanDate: kigaliToday.toJSDate().toISOString(),
        dueDate: dueDateA.toISOString(),
        frequency: 'MONTHLY',
      },
    });
    const loanA = JSON.parse(loanResA.payload);

    // Loan B: 3 days due
    const dueDateB = kigaliToday.plus({ days: 3 }).toJSDate();
    const loanResB = await app.inject({
      method: 'POST',
      url: '/api/v1/loans',
      headers: { authorization: `Bearer ${officerToken}` },
      payload: {
        borrowerId,
        principalAmount: 200,
        interestRate: 0,
        loanDate: kigaliToday.toJSDate().toISOString(),
        dueDate: dueDateB.toISOString(),
        frequency: 'MONTHLY',
      },
    });
    const loanB = JSON.parse(loanResB.payload);

    // Loan C: Overdue (e.g. loan date was 10 days ago, due date was 2 days ago)
    const loanDateC = kigaliToday.minus({ days: 10 }).toJSDate();
    const dueDateC = kigaliToday.minus({ days: 2 }).toJSDate();
    const loanResC = await app.inject({
      method: 'POST',
      url: '/api/v1/loans',
      headers: { authorization: `Bearer ${officerToken}` },
      payload: {
        borrowerId,
        principalAmount: 300,
        interestRate: 0,
        loanDate: loanDateC.toISOString(),
        dueDate: dueDateC.toISOString(),
        frequency: 'MONTHLY',
      },
    });
    const loanC = JSON.parse(loanResC.payload);

    // 2. Trigger the Reminder Engine (first run)
    const triggerRes1 = await app.inject({
      method: 'POST',
      url: '/api/v1/reminders/trigger',
      headers: { authorization: `Bearer ${officerToken}` },
    });

    assert.strictEqual(triggerRes1.statusCode, 200);
    const body1 = JSON.parse(triggerRes1.payload);
    assert.strictEqual(body1.success, true);
    
    // We expect at least 3 reminders to be processed (7-days, 3-days, and overdue)
    const totalProcessed = (body1.summary.sentCount || 0) + (body1.summary.failedCount || 0);
    assert.ok(totalProcessed >= 3, `Expected at least 3 processed notifications, got ${totalProcessed}`);


    // 3. Verify logs in the database
    const logs = await prisma.notificationLog.findMany({
      where: {
        repaymentSchedule: {
          loan: { borrowerId },
        },
      },
      include: {
        repaymentSchedule: {
          include: { loan: true },
        },
      },
    });

    // Check that we logged the appropriate reminder types
    const types = logs.map((l) => l.reminderType);
    assert.ok(types.includes('BEFORE_7_DAYS'));
    assert.ok(types.includes('BEFORE_3_DAYS'));
    assert.ok(types.includes('OVERDUE'));

    // Check all statuses are SENT
    logs.forEach((log) => {
      assert.strictEqual(log.status, 'SENT');
      assert.strictEqual(log.channel, 'EMAIL');
    });

    // 4. Trigger the Reminder Engine (second run - testing idempotency)
    const triggerRes2 = await app.inject({
      method: 'POST',
      url: '/api/v1/reminders/trigger',
      headers: { authorization: `Bearer ${officerToken}` },
    });

    assert.strictEqual(triggerRes2.statusCode, 200);
    const body2 = JSON.parse(triggerRes2.payload);
    
    // Should send 0 reminders on second run due to idempotency
    assert.strictEqual(body2.summary.sentCount, 0);
  });
});

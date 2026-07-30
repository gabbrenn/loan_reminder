import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { notificationRoutes } from './notification.route';
import { reminderRoutes } from '../reminder/reminder.route';
import { loanRoutes } from '../loan/loan.route';
import prisma from '../../lib/prisma';
import { DateTime } from 'luxon';

describe('Notification Log Integration Tests', () => {
  let app: any;
  let adminToken: string;
  let officerToken: string;
  let creditManagerToken: string;
  let borrowerId: string;
  let notificationLogId: string;

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
    app.register(notificationRoutes, { prefix: '/api/v1/notifications' });
    await app.ready();

    adminToken = app.jwt.sign({ id: 'admin-id', email: 'admin@test.com', role: 'ADMIN', name: 'Admin' });
    officerToken = app.jwt.sign({ id: 'officer-id', email: 'officer@test.com', role: 'LOAN_OFFICER', name: 'Officer' });
    creditManagerToken = app.jwt.sign({ id: 'cm-id', email: 'cm@test.com', role: 'CREDIT_MANAGER', name: 'Manager' });

    // Reset settings to defaults
    await prisma.systemSetting.deleteMany();
    await prisma.systemSetting.create({ data: {} });

    // Create a borrower and a loan due in 7 days, then trigger reminder engine
    const borrower = await prisma.borrower.create({
      data: {
        fullName: 'Notification Log Test Borrower',
        nationalId: 'NID-NOTIF-TEST-777',
        phone: '+250788007701',
        email: 'notif.test@example.com',
        address: 'Kigali',
        occupation: 'Trader',
        guarantorName: 'Guarantor N',
        guarantorPhone: '+250788007702',
      },
    });
    borrowerId = borrower.id;

    const kigaliNow = DateTime.now().setZone('Africa/Kigali');
    await app.inject({
      method: 'POST',
      url: '/api/v1/loans',
      headers: { authorization: `Bearer ${officerToken}` },
      payload: {
        borrowerId,
        principalAmount: 100,
        interestRate: 0,
        loanDate: kigaliNow.minus({ days: 1 }).toJSDate().toISOString(),
        dueDate: kigaliNow.plus({ days: 7 }).toJSDate().toISOString(),
        frequency: 'MONTHLY',
      },
    });

    // Trigger reminder engine to generate a notification log
    await app.inject({
      method: 'POST',
      url: '/api/v1/reminders/trigger',
      headers: { authorization: `Bearer ${officerToken}` },
    });
  });

  after(async () => {
    await prisma.notificationLog.deleteMany({ where: { repaymentSchedule: { loan: { borrowerId } } } });
    await prisma.repaymentSchedule.deleteMany({ where: { loan: { borrowerId } } });
    await prisma.loan.deleteMany({ where: { borrowerId } });
    await prisma.borrower.delete({ where: { id: borrowerId } });
    await app.close();
    await prisma.$disconnect();
  });

  test('GET / - Unauthenticated is rejected (401)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/notifications' });
    assert.strictEqual(res.statusCode, 401);
  });

  test('GET / - Credit Manager can list notification logs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${creditManagerToken}` },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body));
  });

  test('GET / - Returns notification logs with borrower and loan details', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.length >= 1);

    const ourLog = body.find(
      (l: any) => l.repaymentSchedule?.loan?.borrower?.nationalId === 'NID-NOTIF-TEST-777' && l.channel === 'EMAIL'
    );
    assert.ok(ourLog, 'Should find an email notification for our test borrower');
    assert.strictEqual(ourLog.channel, 'EMAIL');

    assert.ok(['SENT', 'FAILED'].includes(ourLog.status), `Expected status to be SENT or FAILED but got ${ourLog.status}`);
    assert.ok(ourLog.repaymentSchedule?.loan?.borrower?.fullName);


    notificationLogId = ourLog.id;
  });

  test('GET / - Can filter by status=SENT', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications?status=SENT',
      headers: { authorization: `Bearer ${officerToken}` },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.every((l: any) => l.status === 'SENT'));
  });

  test('GET / - Can filter by channel=EMAIL', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications?channel=EMAIL',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.every((l: any) => l.channel === 'EMAIL'));
  });

  test('GET /:id - Returns single notification log', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/notifications/${notificationLogId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.id, notificationLogId);
    assert.ok(body.reminderType);
  });

  test('GET /:id - Returns 404 for non-existent log', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/non-existent-id',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.statusCode, 404);
  });
});

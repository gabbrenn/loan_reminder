import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { dashboardRoutes } from './dashboard.route';
import { loanRoutes } from '../loan/loan.route';
import prisma from '../../lib/prisma';
import { DateTime } from 'luxon';

describe('Dashboard Integration Tests', () => {
  let app: any;
  let adminToken: string;
  let officerToken: string;
  let creditManagerToken: string;
  const borrowerIds: string[] = [];

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
    app.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });
    await app.ready();

    adminToken = app.jwt.sign({ id: 'admin-id', email: 'admin@test.com', role: 'ADMIN', name: 'Admin' });
    officerToken = app.jwt.sign({ id: 'officer-id', email: 'officer@test.com', role: 'LOAN_OFFICER', name: 'Officer' });
    creditManagerToken = app.jwt.sign({ id: 'cm-id', email: 'cm@test.com', role: 'CREDIT_MANAGER', name: 'Manager' });

    // Create test borrowers for different loan scenarios
    const borrowerData = [
      { fullName: 'Dash Test Green', nationalId: 'NID-DASH-G-001', phone: '+250788001001', email: 'dash.green@test.com' },
      { fullName: 'Dash Test Yellow', nationalId: 'NID-DASH-Y-002', phone: '+250788001002', email: 'dash.yellow@test.com' },
      { fullName: 'Dash Test Orange', nationalId: 'NID-DASH-O-003', phone: '+250788001003', email: 'dash.orange@test.com' },
      { fullName: 'Dash Test Red', nationalId: 'NID-DASH-R-004', phone: '+250788001004', email: 'dash.red@test.com' },
    ];

    for (const bd of borrowerData) {
      const b = await prisma.borrower.create({
        data: {
          ...bd,
          address: 'Kigali',
          occupation: 'Test',
          guarantorName: 'Guarantor',
          guarantorPhone: '+250788001099',
        },
      });
      borrowerIds.push(b.id);
    }

    const kigaliNow = DateTime.now().setZone('Africa/Kigali');
    const loanDate = kigaliNow.minus({ days: 1 }).toJSDate();

    // Green loan: due in 15 days
    await app.inject({
      method: 'POST',
      url: '/api/v1/loans',
      headers: { authorization: `Bearer ${officerToken}` },
      payload: {
        borrowerId: borrowerIds[0],
        principalAmount: 100,
        interestRate: 0,
        loanDate: loanDate.toISOString(),
        dueDate: kigaliNow.plus({ days: 15 }).toJSDate().toISOString(),
        frequency: 'MONTHLY',
      },
    });

    // Yellow loan: due in 4 days
    await app.inject({
      method: 'POST',
      url: '/api/v1/loans',
      headers: { authorization: `Bearer ${officerToken}` },
      payload: {
        borrowerId: borrowerIds[1],
        principalAmount: 200,
        interestRate: 0,
        loanDate: loanDate.toISOString(),
        dueDate: kigaliNow.plus({ days: 4 }).toJSDate().toISOString(),
        frequency: 'MONTHLY',
      },
    });

    // Orange loan: due tomorrow
    await app.inject({
      method: 'POST',
      url: '/api/v1/loans',
      headers: { authorization: `Bearer ${officerToken}` },
      payload: {
        borrowerId: borrowerIds[2],
        principalAmount: 300,
        interestRate: 0,
        loanDate: loanDate.toISOString(),
        dueDate: kigaliNow.plus({ days: 1 }).toJSDate().toISOString(),
        frequency: 'MONTHLY',
      },
    });

    // Red (overdue) loan: due 3 days ago
    await app.inject({
      method: 'POST',
      url: '/api/v1/loans',
      headers: { authorization: `Bearer ${officerToken}` },
      payload: {
        borrowerId: borrowerIds[3],
        principalAmount: 400,
        interestRate: 0,
        loanDate: kigaliNow.minus({ days: 10 }).toJSDate().toISOString(),
        dueDate: kigaliNow.minus({ days: 3 }).toJSDate().toISOString(),
        frequency: 'MONTHLY',
      },
    });
  });

  after(async () => {
    for (const borrowerId of borrowerIds) {
      await prisma.repaymentSchedule.deleteMany({ where: { loan: { borrowerId } } });
      await prisma.loan.deleteMany({ where: { borrowerId } });
      await prisma.borrower.delete({ where: { id: borrowerId } });
    }
    await app.close();
    await prisma.$disconnect();
  });

  test('GET /metrics - Unauthenticated is rejected (401)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/dashboard/metrics' });
    assert.strictEqual(res.statusCode, 401);
  });

  test('GET /metrics - All roles can access (Credit Manager)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/metrics',
      headers: { authorization: `Bearer ${creditManagerToken}` },
    });
    assert.strictEqual(res.statusCode, 200);
  });

  test('GET /metrics - Returns expected structure and counts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/metrics',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);

    // Verify structure
    assert.ok(body.metrics);
    assert.ok(typeof body.metrics.totalBorrowers === 'number');
    assert.ok(typeof body.metrics.activeLoans === 'number');
    assert.ok(typeof body.metrics.dueToday === 'number');
    assert.ok(typeof body.metrics.dueThisWeek === 'number');
    assert.ok(typeof body.metrics.overdueLoans === 'number');
    assert.ok(typeof body.metrics.notificationsSentToday === 'number');
    assert.ok(Array.isArray(body.loans));
  });

  test('GET /metrics - Badges are correctly assigned to test loans', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/metrics',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);

    // Find our test loans by borrower name
    const greenLoan = body.loans.find((l: any) => l.borrowerName === 'Dash Test Green');
    const yellowLoan = body.loans.find((l: any) => l.borrowerName === 'Dash Test Yellow');
    const orangeLoan = body.loans.find((l: any) => l.borrowerName === 'Dash Test Orange');
    const redLoan = body.loans.find((l: any) => l.borrowerName === 'Dash Test Red');

    assert.ok(greenLoan, 'Green loan should exist');
    assert.ok(yellowLoan, 'Yellow loan should exist');
    assert.ok(orangeLoan, 'Orange loan should exist');
    assert.ok(redLoan, 'Red loan should exist');

    assert.strictEqual(greenLoan.badge, 'GREEN');
    assert.strictEqual(yellowLoan.badge, 'YELLOW');
    assert.strictEqual(orangeLoan.badge, 'ORANGE');
    assert.strictEqual(redLoan.badge, 'RED');
  });

  test('GET /metrics - Metrics counts include test loans in dueThisWeek', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/metrics',
      headers: { authorization: `Bearer ${officerToken}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);

    // At least 1 overdue loan (red loan)
    assert.ok(body.metrics.overdueLoans >= 1);
    // At least 1 loan due this week (yellow)
    assert.ok(body.metrics.dueThisWeek >= 1);
    // At least 1 loan due today or tomorrow (orange)
    assert.ok(body.metrics.dueToday >= 1);
  });
});

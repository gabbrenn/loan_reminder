import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { loanRoutes } from './loan.route';
import prisma from '../../lib/prisma';

describe('Loan Module & Repayment Schedule Integration Tests', () => {
  let app: any;
  let adminToken: string;
  let officerToken: string;
  let creditManagerToken: string;
  let borrowerId: string;
  let createdLoanId: string;

  before(async () => {
    // 1. Setup fastify instance with same config
    app = Fastify();
    app.register(fastifyJwt, {
      secret: 'test-secret-key-12345',
    });
    app.register(fastifyRateLimit, {
      global: false,
    });
    app.decorate('authenticate', async (request: any, reply: any) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.code(401).send({
          error: {
            message: 'Unauthorized',
            code: 'UNAUTHORIZED',
          },
        });
      }
    });
    app.register(loanRoutes, { prefix: '/api/v1/loans' });
    await app.ready();

    // 2. Generate security tokens
    adminToken = app.jwt.sign({ id: 'admin-id', email: 'admin@test.com', role: 'ADMIN', name: 'Admin' });
    officerToken = app.jwt.sign({ id: 'officer-id', email: 'officer@test.com', role: 'LOAN_OFFICER', name: 'Officer' });
    creditManagerToken = app.jwt.sign({ id: 'cm-id', email: 'cm@test.com', role: 'CREDIT_MANAGER', name: 'Manager' });

    // 3. Create a test borrower to associate loans with
    const borrower = await prisma.borrower.create({
      data: {
        fullName: 'Test Loan Borrower',
        nationalId: 'NID-LOAN-TEST-999',
        phone: '+250788000999',
        email: 'loan.borrower.test@example.com',
        address: 'Kigali',
        occupation: 'Trader',
        guarantorName: 'Guarantor',
        guarantorPhone: '+250788000888',
      },
    });
    borrowerId = borrower.id;
  });

  after(async () => {
    // Cleanup test data
    await prisma.loan.deleteMany({
      where: { borrowerId },
    });
    await prisma.borrower.delete({
      where: { id: borrowerId },
    });
    await app.close();
    await prisma.$disconnect();
  });

  test('POST / - Loan Officer should successfully create loan and generate weekly schedule', async () => {
    const loanDate = new Date();
    // 28 days term
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 28);

    const payload = {
      borrowerId,
      principalAmount: 1000,
      interestRate: 0.1, // 10% flat interest -> 1100 totalPayable
      loanDate: loanDate.toISOString(),
      dueDate: dueDate.toISOString(),
      frequency: 'WEEKLY', // 4 installments (28 / 7 = 4)
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/loans',
      headers: {
        authorization: `Bearer ${officerToken}`,
      },
      payload,
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.ok(body.id);
    createdLoanId = body.id;
    assert.strictEqual(body.principalAmount, 1000);
    assert.strictEqual(body.interestRate, 0.1);
    assert.strictEqual(body.totalPayable, 1100);
    assert.strictEqual(body.remainingBalance, 1100);
    assert.strictEqual(body.status, 'ACTIVE');
    assert.ok(body.loanNumber.startsWith('LN-'));

    // Check RepaymentSchedules
    assert.ok(Array.isArray(body.repaymentSchedules));
    assert.strictEqual(body.repaymentSchedules.length, 4);

    // Each installment should be 1100 / 4 = 275 exactly
    body.repaymentSchedules.forEach((s: any, idx: number) => {
      assert.strictEqual(s.installmentNumber, idx + 1);
      assert.strictEqual(s.amountDue, 275);
      assert.strictEqual(s.amountPaid, 0);
    });
  });

  test('POST / - Should handle rounding errors correctly by adjusting final installment', async () => {
    const loanDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 21); // 3 weekly installments

    const payload = {
      borrowerId,
      principalAmount: 1000,
      interestRate: 0.1, // 1100 totalPayable
      loanDate: loanDate.toISOString(),
      dueDate: dueDate.toISOString(),
      frequency: 'WEEKLY', // 3 installments (1100 / 3 = 366.6666...)
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/loans',
      headers: {
        authorization: `Bearer ${officerToken}`,
      },
      payload,
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    
    assert.strictEqual(body.repaymentSchedules.length, 3);
    assert.strictEqual(body.repaymentSchedules[0].amountDue, 366.67);
    assert.strictEqual(body.repaymentSchedules[1].amountDue, 366.67);
    // Final should absorb remainder: 1100 - (366.67 * 2) = 366.66
    assert.strictEqual(body.repaymentSchedules[2].amountDue, 366.66);

    // Total sum should match totalPayable exactly
    const sum = body.repaymentSchedules.reduce((acc: number, s: any) => acc + s.amountDue, 0);
    assert.strictEqual(Math.round(sum * 100) / 100, 1100);
  });

  test('POST / - Credit Manager should be blocked from creating loans (403)', async () => {
    const loanDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const payload = {
      borrowerId,
      principalAmount: 500,
      interestRate: 0.05,
      loanDate: loanDate.toISOString(),
      dueDate: dueDate.toISOString(),
      frequency: 'MONTHLY',
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/loans',
      headers: {
        authorization: `Bearer ${creditManagerToken}`,
      },
      payload,
    });

    assert.strictEqual(res.statusCode, 403);
  });

  test('PATCH /:id/status - Credit Manager can manually set DEFAULTED', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/loans/${createdLoanId}/status`,
      headers: {
        authorization: `Bearer ${creditManagerToken}`,
      },
      payload: {
        status: 'DEFAULTED',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.status, 'DEFAULTED');
  });

  test('PATCH /:id/status - Loan Officer cannot set DEFAULTED (403)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/loans/${createdLoanId}/status`,
      headers: {
        authorization: `Bearer ${officerToken}`,
      },
      payload: {
        status: 'ACTIVE',
      },
    });

    assert.strictEqual(res.statusCode, 403);
  });

  test('GET / - Should list loans with filters', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/loans?borrowerId=${borrowerId}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body));
    assert.ok(body.length >= 1);
    assert.strictEqual(body[0].borrowerId, borrowerId);
  });
});

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { messageRoutes } from './message.route';
import prisma from '../../lib/prisma';

describe('Message Module Integration Tests', () => {
  let app: any;
  let officerToken: string;
  let borrowerToken: string;
  let unauthorizedBorrowerToken: string;

  let officerId = 'officer-test-id';
  let borrowerId: string;
  let unauthorizedBorrowerId: string;
  let testLoanId: string;

  before(async () => {
    app = Fastify();
    app.register(fastifyJwt, { secret: 'test-secret-key-messages' });
    app.register(fastifyRateLimit, { global: false });
    app.decorate('authenticate', async (request: any, reply: any) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.code(401).send({
          error: { message: 'Unauthorized', code: 'UNAUTHORIZED' },
        });
      }
    });
    app.register(messageRoutes, { prefix: '/api/v1/loans' });
    await app.ready();

    // Create test officer user
    const officerUser = await prisma.user.create({
      data: {
        email: 'officer.msg@test.com',
        passwordHash: 'dummyhash',
        name: 'Loan Officer Test',
        role: 'LOAN_OFFICER',
      },
    });
    officerId = officerUser.id;

    // Create test borrowers in DB
    const borrower = await prisma.borrower.create({
      data: {
        fullName: 'Message Borrower',
        nationalId: 'NID-MSG-001',
        phone: '+250788111222',
        email: 'msg.borrower@example.com',
        address: 'Kigali',
        occupation: 'Merchant',
        guarantorName: 'Guarantor',
        guarantorPhone: '+250788333444',
      },
    });
    borrowerId = borrower.id;

    const unauthBorrower = await prisma.borrower.create({
      data: {
        fullName: 'Unauth Borrower',
        nationalId: 'NID-MSG-002',
        phone: '+250788111223',
        email: 'unauth.borrower@example.com',
        address: 'Kigali',
        occupation: 'Driver',
        guarantorName: 'Guarantor 2',
        guarantorPhone: '+250788333445',
      },
    });
    unauthorizedBorrowerId = unauthBorrower.id;

    // Create test loan
    const loan = await prisma.loan.create({
      data: {
        loanNumber: 'LN-MSG-TEST-001',
        borrowerId,
        createdById: officerId,
        principalAmount: 1000,
        interestRate: 0.1,
        totalPayable: 1100,
        remainingBalance: 1100,
        loanDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        frequency: 'MONTHLY',
        status: 'ACTIVE',
      },
    });
    testLoanId = loan.id;

    // Sign JWT tokens
    officerToken = app.jwt.sign({ id: officerId, email: 'officer.msg@test.com', role: 'LOAN_OFFICER', name: 'Loan Officer Test' });
    borrowerToken = app.jwt.sign({ id: borrowerId, email: 'msg.borrower@example.com', role: 'BORROWER', name: 'Message Borrower' });
    unauthorizedBorrowerToken = app.jwt.sign({ id: unauthorizedBorrowerId, email: 'unauth.borrower@example.com', role: 'BORROWER', name: 'Unauth Borrower' });
  });

  after(async () => {
    if (testLoanId) {
      await prisma.message.deleteMany({ where: { loanId: testLoanId } });
      await prisma.loan.delete({ where: { id: testLoanId } });
    }
    if (borrowerId) await prisma.borrower.delete({ where: { id: borrowerId } });
    if (unauthorizedBorrowerId) await prisma.borrower.delete({ where: { id: unauthorizedBorrowerId } });
    if (officerId) await prisma.user.delete({ where: { id: officerId } });
  });


  test('Borrower can send a message to the loan officer managing their loan', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/loans/${testLoanId}/messages`,
      headers: { authorization: `Bearer ${borrowerToken}` },
      payload: { message: 'Hello officer, I have a question about loan LN-MSG-TEST-001.' },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.loanId, testLoanId);
    assert.strictEqual(body.senderType, 'BORROWER');
    assert.strictEqual(body.senderId, borrowerId);
    assert.strictEqual(body.message, 'Hello officer, I have a question about loan LN-MSG-TEST-001.');
  });

  test('Loan officer can respond to the borrower message', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/loans/${testLoanId}/messages`,
      headers: { authorization: `Bearer ${officerToken}` },
      payload: { message: 'Hello! I am glad to assist you with your loan.' },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.senderType, 'LOAN_OFFICER');
    assert.strictEqual(body.senderId, officerId);
    assert.strictEqual(body.receiverId, borrowerId);
  });

  test('Borrower can view full conversation history for their loan only', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/loans/${testLoanId}/messages`,
      headers: { authorization: `Bearer ${borrowerToken}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.loanId, testLoanId);
    assert.strictEqual(body.messages.length, 2);
  });

  test('Unauthorized borrower cannot access another borrower loan conversation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/loans/${testLoanId}/messages`,
      headers: { authorization: `Bearer ${unauthorizedBorrowerToken}` },
    });

    assert.strictEqual(res.statusCode, 403);
  });
});

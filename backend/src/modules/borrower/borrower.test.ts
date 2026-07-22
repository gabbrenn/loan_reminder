import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { borrowerRoutes } from './borrower.route';
import { authorize } from '../../middleware/auth.middleware';
import prisma from '../../lib/prisma';

describe('Borrower Module Integration Tests', () => {
  let app: any;
  let adminToken: string;
  let officerToken: string;
  let creditManagerToken: string;
  let createdBorrowerId: string;

  const sampleBorrower = {
    fullName: 'Jean Claude Uwimana',
    nationalId: 'NID-TEST-001',
    phone: '+250788000001',
    email: 'jean.claude.test@example.com',
    address: '123 Kigali Street, Remera',
    occupation: 'Teacher',
    guarantorName: 'Marie Claire Uwimana',
    guarantorPhone: '+250788000002',
  };

  before(async () => {
    // Clean up test borrowers to ensure clean state
    await prisma.borrower.deleteMany({
      where: { nationalId: { startsWith: 'NID-TEST' } },
    });

    app = Fastify();
    const jwtSecret = 'test-secret-key-12345';
    app.register(fastifyJwt, { secret: jwtSecret });
    app.register(fastifyRateLimit, { global: false });
    app.decorate('authenticate', async (request: any, reply: any) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.code(401).send({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
      }
    });
    app.register(borrowerRoutes, { prefix: '/api/v1/borrowers' });
    await app.ready();

    // Generate tokens for each role
    adminToken = app.jwt.sign({ id: 'admin-id', email: 'admin@test.com', role: 'ADMIN', name: 'Admin' });
    officerToken = app.jwt.sign({ id: 'officer-id', email: 'officer@test.com', role: 'LOAN_OFFICER', name: 'Officer' });
    creditManagerToken = app.jwt.sign({ id: 'cm-id', email: 'cm@test.com', role: 'CREDIT_MANAGER', name: 'Manager' });
  });

  after(async () => {
    // Cleanup test data
    await prisma.borrower.deleteMany({
      where: { nationalId: { startsWith: 'NID-TEST' } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  // ─── CREATE ───────────────────────────────────────────────────────────────

  test('POST / - Loan Officer can create a borrower', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/borrowers',
      headers: { authorization: `Bearer ${officerToken}` },
      payload: sampleBorrower,
    });
    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.fullName, sampleBorrower.fullName);
    assert.strictEqual(body.nationalId, sampleBorrower.nationalId);
    createdBorrowerId = body.id;
  });

  test('POST / - Duplicate nationalId should fail', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/borrowers',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { ...sampleBorrower, phone: '+250788000099', email: 'other@example.com' },
    });
    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.ok(body.error.message.includes('National ID'));
  });

  test('POST / - Duplicate phone should fail', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/borrowers',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { ...sampleBorrower, nationalId: 'NID-TEST-002', email: 'other2@example.com' },
    });
    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.ok(body.error.message.includes('phone'));
  });

  test('POST / - Credit Manager cannot create a borrower (403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/borrowers',
      headers: { authorization: `Bearer ${creditManagerToken}` },
      payload: { ...sampleBorrower, nationalId: 'NID-TEST-003', phone: '+250788000003', email: 'cm@btest.com' },
    });
    assert.strictEqual(res.statusCode, 403);
  });

  test('POST / - Unauthenticated request is rejected (401)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/borrowers',
      payload: sampleBorrower,
    });
    assert.strictEqual(res.statusCode, 401);
  });

  // ─── READ ─────────────────────────────────────────────────────────────────

  test('GET / - List all borrowers (Admin)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/borrowers',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body));
    assert.ok(body.length >= 1);
  });

  test('GET / - Search borrowers by name', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/borrowers?search=Jean+Claude',
      headers: { authorization: `Bearer ${officerToken}` },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body));
    assert.ok(body.some((b: any) => b.fullName.includes('Jean Claude')));
  });

  test('GET /:id - Get borrower by ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/borrowers/${createdBorrowerId}`,
      headers: { authorization: `Bearer ${creditManagerToken}` },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.id, createdBorrowerId);
  });

  test('GET /:id - Returns 404 for non-existent borrower', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/borrowers/non-existent-id',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.statusCode, 404);
  });

  // ─── UPDATE ───────────────────────────────────────────────────────────────

  test('PATCH /:id - Admin can update a borrower', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/borrowers/${createdBorrowerId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { address: '456 Updated Avenue, Kigali' },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.address, '456 Updated Avenue, Kigali');
  });

  test('PATCH /:id - Credit Manager cannot update (403)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/borrowers/${createdBorrowerId}`,
      headers: { authorization: `Bearer ${creditManagerToken}` },
      payload: { address: 'Should be denied' },
    });
    assert.strictEqual(res.statusCode, 403);
  });

  // ─── DELETE ───────────────────────────────────────────────────────────────

  test('DELETE /:id - Credit Manager cannot delete (403)', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/borrowers/${createdBorrowerId}`,
      headers: { authorization: `Bearer ${creditManagerToken}` },
    });
    assert.strictEqual(res.statusCode, 403);
  });

  test('DELETE /:id - Loan Officer can delete a borrower', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/borrowers/${createdBorrowerId}`,
      headers: { authorization: `Bearer ${officerToken}` },
    });
    assert.strictEqual(res.statusCode, 204);
  });

  test('DELETE /:id - Already deleted returns 404', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/borrowers/${createdBorrowerId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.statusCode, 404);
  });
});

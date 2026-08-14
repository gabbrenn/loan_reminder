import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { borrowerRoutes } from './borrower.route';
import { userRoutes } from '../user/user.route';
import prisma from '../../lib/prisma';

describe('Borrower Import & Cross-Table Email Uniqueness Tests', () => {
  let app: any;
  let adminToken: string;
  let officerToken: string;

  before(async () => {
    // Clean up test data
    await prisma.borrower.deleteMany({
      where: {
        OR: [
          { nationalId: { startsWith: 'NID-IMPORT-' } },
          { email: { in: ['import1@example.com', 'import2@example.com', 'import5.unique@example.com', 'imported.borrower.test@example.com'] } },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['existing.user.import@example.com', 'imported.borrower.test@example.com'] } },
    });

    // Create a dummy user for cross-table testing
    await prisma.user.create({
      data: {
        email: 'existing.user.import@example.com',
        name: 'Existing Admin User',
        passwordHash: 'dummyhash',
        role: 'ADMIN',
      },
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
    app.register(userRoutes, { prefix: '/api/v1/users' });
    await app.ready();

    adminToken = app.jwt.sign({ id: 'admin-import-id', email: 'admin.import@test.com', role: 'ADMIN', name: 'Admin' });
    officerToken = app.jwt.sign({ id: 'officer-import-id', email: 'officer.import@test.com', role: 'LOAN_OFFICER', name: 'Officer' });
  });

  after(async () => {
    await prisma.borrower.deleteMany({
      where: {
        OR: [
          { nationalId: { startsWith: 'NID-IMPORT-' } },
          { email: { in: ['import1@example.com', 'import2@example.com', 'import5.unique@example.com', 'imported.borrower.test@example.com'] } },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['existing.user.import@example.com', 'imported.borrower.test@example.com'] } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  test('GET /api/v1/borrowers/template - should return CSV template for borrower import', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/borrowers/template',
      headers: { authorization: `Bearer ${officerToken}` },
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['content-type'], 'text/csv');
    assert.ok(res.body.includes('fullName,nationalId,phone,email,address,occupation,guarantorName,guarantorPhone,photo'));
  });

  test('POST /api/v1/borrowers/import - should bulk import valid borrowers', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/borrowers/import',
      headers: { authorization: `Bearer ${officerToken}` },
      payload: {
        borrowers: [
          {
            fullName: 'Imported Borrower 1',
            nationalId: 'NID-IMPORT-001',
            phone: '+250788991101',
            email: 'import1@example.com',
            address: 'Kigali City',
            occupation: 'Trader',
            guarantorName: 'Guarantor 1',
            guarantorPhone: '+250788991102',
          },
          {
            fullName: 'Imported Borrower 2',
            nationalId: 'NID-IMPORT-002',
            phone: '+250788991103',
            email: 'import2@example.com',
            address: 'Huye District',
            occupation: 'Teacher',
            guarantorName: 'Guarantor 2',
            guarantorPhone: '+250788991104',
          },
        ],
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.successCount, 2);
    assert.strictEqual(body.failureCount, 0);
    assert.strictEqual(body.created.length, 2);
  });

  test('Cross-table check: POST /api/v1/borrowers - should reject borrower with email existing in User table', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/borrowers',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        fullName: 'Collision Borrower',
        nationalId: 'NID-IMPORT-003',
        phone: '+250788991105',
        email: 'existing.user.import@example.com', // User email
        address: 'Kigali',
        occupation: 'Doctor',
        guarantorName: 'Guarantor 3',
        guarantorPhone: '+250788991106',
      },
    });

    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.ok(body.error.message.includes('user or borrower with this email address already exists'));
  });

  test('Cross-table check: POST /api/v1/users - should reject user with email existing in Borrower table', async () => {
    // First create a borrower with unique email
    await app.inject({
      method: 'POST',
      url: '/api/v1/borrowers',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        fullName: 'Borrower For User Test',
        nationalId: 'NID-IMPORT-004',
        phone: '+250788991107',
        email: 'imported.borrower.test@example.com',
        address: 'Musanze',
        occupation: 'Engineer',
        guarantorName: 'Guarantor 4',
        guarantorPhone: '+250788991108',
      },
    });

    // Now try creating a User with that borrower email
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Attempted User',
        email: 'imported.borrower.test@example.com',
        password: 'Password123!',
        role: 'LOAN_OFFICER',
      },
    });

    assert.strictEqual(res.statusCode, 409);
    const body = JSON.parse(res.body);
    assert.ok(body.error.message.includes('user or borrower with this email address already exists'));
  });

  test('POST /api/v1/borrowers/import - should return partial failures for duplicate email or missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/borrowers/import',
      headers: { authorization: `Bearer ${officerToken}` },
      payload: {
        borrowers: [
          {
            fullName: 'Valid Import Borrower',
            nationalId: 'NID-IMPORT-005',
            phone: '+250788991109',
            email: 'import5.unique@example.com',
            address: 'Rubavu',
            occupation: 'Farmer',
            guarantorName: 'Guarantor 5',
            guarantorPhone: '+250788991110',
          },
          {
            fullName: 'Duplicate Email Borrower',
            nationalId: 'NID-IMPORT-006',
            phone: '+250788991111',
            email: 'existing.user.import@example.com', // Exists in User table
            address: 'Rubavu',
            occupation: 'Farmer',
            guarantorName: 'Guarantor 6',
            guarantorPhone: '+250788991112',
          },
        ],
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.successCount, 1);
    assert.strictEqual(body.failureCount, 1);
    assert.strictEqual(body.errors.length, 1);
    assert.strictEqual(body.errors[0].row, 2);
    assert.ok(body.errors[0].error.includes('already exists'));
  });
});

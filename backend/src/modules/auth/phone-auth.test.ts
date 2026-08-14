import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { authRoutes } from './auth.route';
import prisma from '../../lib/prisma';
import bcrypt from 'bcrypt';

describe('Phone Number Authentication Integration Tests', () => {
  let app: any;
  const testPhone = '+250788776655';
  const testEmail = 'phone.borrower@test.com';
  const testPassword = 'Password123!';

  before(async () => {
    // Cleanup test borrower
    await prisma.borrower.deleteMany({
      where: { phone: testPhone },
    });

    const passwordHash = await bcrypt.hash(testPassword, 10);
    await prisma.borrower.create({
      data: {
        fullName: 'Phone Test Borrower',
        nationalId: 'NID-PHONE-001',
        phone: testPhone,
        email: testEmail,
        address: 'Kigali',
        occupation: 'Trader',
        guarantorName: 'Guarantor',
        guarantorPhone: '+250788000999',
        passwordHash,
      },
    });

    app = Fastify();
    app.register(fastifyJwt, { secret: 'test-secret' });
    app.register(fastifyRateLimit, { global: false });
    app.decorate('authenticate', async (request: any, reply: any) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.code(401).send({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
      }
    });
    app.register(authRoutes, { prefix: '/api/v1/auth' });
    await app.ready();
  });

  after(async () => {
    await prisma.borrower.deleteMany({
      where: { phone: testPhone },
    });
    await app.close();
    await prisma.$disconnect();
  });

  test('POST /api/v1/auth/login - should authenticate borrower using phone number', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testPhone, // Inputting phone number in email/identifier field
        passwordPlain: testPassword,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.user.role, 'BORROWER');
    assert.strictEqual(body.user.email, testEmail);
    assert.ok(body.token);
  });

  test('POST /api/v1/auth/login - should authenticate borrower using email address', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        passwordPlain: testPassword,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.user.role, 'BORROWER');
    assert.ok(body.token);
  });

  test('POST /api/v1/auth/forgot-password - should accept phone number for reset request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: {
        email: testPhone,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.message.includes('reset link has been sent'));
  });
});

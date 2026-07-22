import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { userRoutes } from './user.route';
import prisma from '../../lib/prisma';

describe('User Module Integration Tests', () => {
  let app: any;
  let adminToken: string;
  let officerToken: string;
  let testUserId: string;

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
    app.register(userRoutes, { prefix: '/api/v1/users' });
    await app.ready();

    adminToken = app.jwt.sign({ id: 'admin-id-1', email: 'admin1@test.com', role: 'ADMIN', name: 'Admin One' });
    officerToken = app.jwt.sign({ id: 'officer-id-1', email: 'officer1@test.com', role: 'LOAN_OFFICER', name: 'Officer One' });
  });

  after(async () => {
    if (testUserId) {
      await prisma.user.deleteMany({ where: { email: 'created-officer@test.com' } });
    }
    await app.close();
    await prisma.$disconnect();
  });

  test('GET / - Unauthenticated is rejected (401)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/users' });
    assert.strictEqual(res.statusCode, 401);
  });

  test('GET / - Loan Officer is forbidden (403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users',
      headers: { authorization: `Bearer ${officerToken}` },
    });
    assert.strictEqual(res.statusCode, 403);
  });

  test('POST / - Admin can create a new user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        email: 'created-officer@test.com',
        name: 'Created Officer',
        password: 'Password123!',
        role: 'LOAN_OFFICER',
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.email, 'created-officer@test.com');
    assert.strictEqual(body.role, 'LOAN_OFFICER');
    assert.ok(body.id);
    testUserId = body.id;
  });

  test('POST / - Cannot create duplicate email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        email: 'created-officer@test.com',
        name: 'Duplicate Officer',
        password: 'Password123!',
        role: 'LOAN_OFFICER',
      },
    });
    assert.strictEqual(res.statusCode, 409);
  });

  test('PATCH /:id - Admin can update user details', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${testUserId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Updated Officer Name' },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.name, 'Updated Officer Name');
  });

  test('PATCH /:id - Admin cannot change their own role to non-admin', async () => {
    // Generate token with same ID as user in DB or mock JWT id matching param
    const selfAdminToken = app.jwt.sign({ id: 'admin-id-1', email: 'admin1@test.com', role: 'ADMIN' });
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/admin-id-1',
      headers: { authorization: `Bearer ${selfAdminToken}` },
      payload: { role: 'LOAN_OFFICER' },
    });
    // It throws because admin-id-1 user doesn't exist in DB (just token), but the service check occurs after finding user.
    // Let's create a temporary admin to test self demotion/deletion
    const tempAdmin = await prisma.user.create({
      data: {
        email: 'temp-admin@test.com',
        name: 'Temp Admin',
        passwordHash: 'hash',
        role: 'ADMIN',
      },
    });

    const tempToken = app.jwt.sign({ id: tempAdmin.id, email: tempAdmin.email, role: 'ADMIN' });

    // Try to demote self
    const resDemote = await app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${tempAdmin.id}`,
      headers: { authorization: `Bearer ${tempToken}` },
      payload: { role: 'LOAN_OFFICER' },
    });
    assert.strictEqual(resDemote.statusCode, 400);

    // Try to delete self
    const resDelete = await app.inject({
      method: 'DELETE',
      url: `/api/v1/users/${tempAdmin.id}`,
      headers: { authorization: `Bearer ${tempToken}` },
    });
    assert.strictEqual(resDelete.statusCode, 400);

    // Cleanup tempAdmin
    await prisma.user.delete({ where: { id: tempAdmin.id } });
  });

  test('DELETE /:id - Admin can delete a user', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/users/${testUserId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.statusCode, 204);
  });
});

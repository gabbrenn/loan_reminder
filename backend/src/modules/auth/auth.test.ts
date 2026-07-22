import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { authRoutes } from './auth.route';
import { authorize } from '../../middleware/auth.middleware';

describe('Auth & Role Module Integration Tests', () => {
  let app: any;

  before(async () => {
    app = Fastify();
    app.register(fastifyJwt, {
      secret: process.env.JWT_SECRET || 'test-secret-key-12345',
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
    app.register(authRoutes, { prefix: '/api/v1/auth' });

    // Define test routes to verify role guarding
    app.get(
      '/api/v1/test/admin-only',
      {
        preHandler: [app.authenticate, authorize(['ADMIN'])],
      },
      async () => {
        return { success: true, role: 'ADMIN' };
      }
    );

    app.get(
      '/api/v1/test/officer-only',
      {
        preHandler: [app.authenticate, authorize(['LOAN_OFFICER'])],
      },
      async () => {
        return { success: true, role: 'LOAN_OFFICER' };
      }
    );

    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  let adminToken: string;
  let officerToken: string;

  test('POST /login - should reject invalid credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@loanreminder.com',
        passwordPlain: 'WrongPassword!',
      },
    });

    assert.strictEqual(response.statusCode, 400);
    const body = JSON.parse(response.payload);
    assert.ok(body.error);
    assert.strictEqual(body.error.message, 'Invalid email or password');
  });

  test('POST /login - should authenticate admin and return token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@loanreminder.com',
        passwordPlain: 'Admin123!',
      },
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.ok(body.token);
    assert.ok(body.user);
    assert.strictEqual(body.user.email, 'admin@loanreminder.com');
    assert.strictEqual(body.user.role, 'ADMIN');
    adminToken = body.token;

    // Generate a mock officer token using the app's jwt configuration
    officerToken = app.jwt.sign({
      id: 'mock-officer-id',
      email: 'officer@loanreminder.com',
      role: 'LOAN_OFFICER',
      name: 'Loan Officer',
    });
  });

  test('POST /change-password - should fail if unauthorized', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      payload: {
        oldPasswordPlain: 'Admin123!',
        newPasswordPlain: 'NewAdmin123!',
      },
    });

    assert.strictEqual(response.statusCode, 401);
  });

  test('POST /change-password - should change password and allow new login', async () => {
    const changeResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        oldPasswordPlain: 'Admin123!',
        newPasswordPlain: 'NewAdmin123!',
      },
    });

    assert.strictEqual(changeResponse.statusCode, 200);
    const changeBody = JSON.parse(changeResponse.payload);
    assert.strictEqual(changeBody.success, true);

    const oldLoginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@loanreminder.com',
        passwordPlain: 'Admin123!',
      },
    });
    assert.strictEqual(oldLoginResponse.statusCode, 400);

    const newLoginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@loanreminder.com',
        passwordPlain: 'NewAdmin123!',
      },
    });
    assert.strictEqual(newLoginResponse.statusCode, 200);
    const newLoginBody = JSON.parse(newLoginResponse.payload);
    assert.ok(newLoginBody.token);
    adminToken = newLoginBody.token; // update active admin token

    // Restore original password
    const restoreResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        oldPasswordPlain: 'NewAdmin123!',
        newPasswordPlain: 'Admin123!',
      },
    });
    assert.strictEqual(restoreResponse.statusCode, 200);
  });

  describe('Role Authorization Guarding Tests', () => {
    test('ADMIN should access /test/admin-only but be forbidden from /test/officer-only', async () => {
      const adminResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/test/admin-only',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });
      assert.strictEqual(adminResponse.statusCode, 200);
      assert.strictEqual(JSON.parse(adminResponse.payload).success, true);

      const forbiddenResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/test/officer-only',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });
      assert.strictEqual(forbiddenResponse.statusCode, 403);
      assert.strictEqual(JSON.parse(forbiddenResponse.payload).error.code, 'FORBIDDEN');
    });

    test('LOAN_OFFICER should access /test/officer-only but be forbidden from /test/admin-only', async () => {
      const officerResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/test/officer-only',
        headers: {
          authorization: `Bearer ${officerToken}`,
        },
      });
      assert.strictEqual(officerResponse.statusCode, 200);
      assert.strictEqual(JSON.parse(officerResponse.payload).success, true);

      const forbiddenResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/test/admin-only',
        headers: {
          authorization: `Bearer ${officerToken}`,
        },
      });
      assert.strictEqual(forbiddenResponse.statusCode, 403);
      assert.strictEqual(JSON.parse(forbiddenResponse.payload).error.code, 'FORBIDDEN');
    });

    test('Unauthenticated user should be rejected with 401 Unauthorized', async () => {
      const unauthResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/test/admin-only',
      });
      assert.strictEqual(unauthResponse.statusCode, 401);
    });
  });
});

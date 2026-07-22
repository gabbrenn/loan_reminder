import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { settingsRoutes } from './settings.route';
import { auditRoutes } from '../audit/audit.route';
import { borrowerRoutes } from '../borrower/borrower.route';
import prisma from '../../lib/prisma';

describe('Settings and Audit Logs Integration Tests', () => {
  let app: any;
  let adminToken: string;
  let officerToken: string;

  before(async () => {
    app = Fastify();
    app.register(fastifyJwt, { secret: 'test-secret-key-98765' });
    app.register(fastifyRateLimit, { global: false });
    app.decorate('authenticate', async (request: any, reply: any) => {
      try {
        await request.jwtVerify();
      } catch {
        return reply.code(401).send({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
      }
    });

    app.register(settingsRoutes);
    app.register(auditRoutes);
    app.register(borrowerRoutes, { prefix: '/api/v1/borrowers' });

    await app.ready();

    // Recreate settings to defaults
    await prisma.systemSetting.deleteMany();
    await prisma.systemSetting.create({ data: {} });

    // Create test user so AuditLog relation works
    await prisma.user.upsert({
      where: { email: 'admin-audit@test.com' },
      update: {},
      create: {
        id: 'admin-audit-id',
        email: 'admin-audit@test.com',
        name: 'Audit Admin',
        passwordHash: 'hashed',
        role: 'ADMIN',
      },
    });

    adminToken = app.jwt.sign({ id: 'admin-audit-id', email: 'admin-audit@test.com', role: 'ADMIN', name: 'Audit Admin' });
    officerToken = app.jwt.sign({ id: 'officer-id', email: 'officer@test.com', role: 'LOAN_OFFICER', name: 'Officer' });
  });

  after(async () => {
    await prisma.auditLog.deleteMany({ where: { userId: 'admin-audit-id' } });
    await prisma.user.delete({ where: { id: 'admin-audit-id' } });
    // Reset settings to defaults
    const s = await prisma.systemSetting.findFirst();
    if (s) {
      await prisma.systemSetting.update({
        where: { id: s.id },
        data: {
          reminderDaysBefore1: 7,
          reminderDaysBefore2: 3,
          reminderDaysBefore3: 1,
          emailEnabled: true,
          smsEnabled: true,
        },
      });
    }
    await app.close();
    await prisma.$disconnect();
  });

  // ─── Settings Tests ────────────────────────────────────────────────────────

  test('GET /api/v1/settings - returns default system settings', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/settings',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.settings);
    assert.strictEqual(body.settings.reminderDaysBefore1, 7);
    assert.strictEqual(body.settings.emailEnabled, true);
  });

  test('PATCH /api/v1/settings - Admins can update system settings', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/settings',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        reminderDaysBefore1: 5,
        reminderDaysBefore2: 2,
        reminderDaysBefore3: 1,
        emailEnabled: false,
      },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.settings.reminderDaysBefore1, 5);
    assert.strictEqual(body.settings.emailEnabled, false);
  });

  test('PATCH /api/v1/settings - Loan Officers are forbidden from updating settings', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/settings',
      headers: { authorization: `Bearer ${officerToken}` },
      payload: { reminderDaysBefore1: 10 },
    });
    assert.strictEqual(res.statusCode, 403);
  });

  // ─── Audit Log Tests ───────────────────────────────────────────────────────

  test('Audit Logs - Creating a borrower registers audit entries', async () => {
    // 1. Create a borrower
    const nid = 'NID-AUDIT-' + Math.floor(Math.random() * 100000);
    const phone = '+25078800' + Math.floor(100000 + Math.random() * 900000);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/borrowers',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        fullName: 'Audit Test Borrower',
        nationalId: nid,
        phone: phone,
        email: `audit.${nid}@example.com`,
        address: 'Kigali',
        occupation: 'Trader',
        guarantorName: 'Guarantor A',
        guarantorPhone: '+250788009999',
      },
    });
    assert.strictEqual(createRes.statusCode, 201);
    const borrower = JSON.parse(createRes.payload);

    // 2. Read audit logs
    const auditRes = await app.inject({
      method: 'GET',
      url: '/api/v1/audit',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(auditRes.statusCode, 200);
    const auditBody = JSON.parse(auditRes.payload);
    assert.ok(Array.isArray(auditBody.logs));

    // Find the log entry matching this CREATE action
    const log = auditBody.logs.find((l: any) => l.entityId === borrower.id && l.action === 'CREATE');
    assert.ok(log);
    assert.strictEqual(log.entity, 'BORROWER');
    assert.strictEqual(log.user.name, 'Audit Admin');

    // Cleanup
    await prisma.borrower.delete({ where: { id: borrower.id } });
  });
});

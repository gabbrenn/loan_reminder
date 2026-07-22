import { FastifyInstance } from 'fastify';
import { authorize } from '../../middleware/auth.middleware';
import { listAuditLogs, getAuditLog } from './audit.controller';

export async function auditRoutes(fastify: FastifyInstance) {
  const adminAndManager = authorize(['ADMIN', 'CREDIT_MANAGER']);

  fastify.get(
    '/api/v1/audit',
    { preHandler: [fastify.authenticate, adminAndManager] },
    listAuditLogs,
  );

  fastify.get(
    '/api/v1/audit/:id',
    { preHandler: [fastify.authenticate, adminAndManager] },
    getAuditLog,
  );
}

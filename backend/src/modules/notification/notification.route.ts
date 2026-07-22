import { FastifyInstance } from 'fastify';
import { NotificationLogController } from './notification.controller';
import { authorize } from '../../middleware/auth.middleware';

const controller = new NotificationLogController();

const ALL_ROLES = ['ADMIN', 'LOAN_OFFICER', 'CREDIT_MANAGER'] as const;

export async function notificationRoutes(fastify: FastifyInstance) {
  // GET /api/v1/notifications - list all notification logs
  fastify.get(
    '/',
    {
      preHandler: [fastify.authenticate, authorize([...ALL_ROLES])],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            channel: { type: 'string', enum: ['EMAIL', 'SMS'] },
            status: { type: 'string', enum: ['PENDING', 'SENT', 'FAILED'] },
          },
        },
      },
    },
    controller.list as any
  );

  // GET /api/v1/notifications/:id - get single notification log
  fastify.get(
    '/:id',
    {
      preHandler: [fastify.authenticate, authorize([...ALL_ROLES])],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
      },
    },
    controller.getOne as any
  );
}

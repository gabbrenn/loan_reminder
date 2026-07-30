import { FastifyInstance } from 'fastify';
import { MessageController } from './message.controller';
import { authorize } from '../../middleware/auth.middleware';

const controller = new MessageController();
const ALL_ROLES = ['ADMIN', 'LOAN_OFFICER', 'CREDIT_MANAGER', 'BORROWER'] as const;

export async function messageRoutes(fastify: FastifyInstance) {
  // POST /api/v1/loans/:loanId/messages - Send message for loan
  fastify.post(
    '/:loanId/messages',
    {
      preHandler: [fastify.authenticate, authorize([...ALL_ROLES])],
      schema: {
        params: {
          type: 'object',
          required: ['loanId'],
          properties: { loanId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['message'],
          properties: {
            message: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    controller.sendMessage.bind(controller)
  );

  // GET /api/v1/loans/:loanId/messages - Get full message history for loan
  fastify.get(
    '/:loanId/messages',
    {
      preHandler: [fastify.authenticate, authorize([...ALL_ROLES])],
      schema: {
        params: {
          type: 'object',
          required: ['loanId'],
          properties: { loanId: { type: 'string' } },
        },
      },
    },
    controller.getLoanMessages.bind(controller)
  );

  // PATCH /api/v1/loans/:loanId/messages/read - Mark messages as read
  fastify.patch(
    '/:loanId/messages/read',
    {
      preHandler: [fastify.authenticate, authorize([...ALL_ROLES])],
      schema: {
        params: {
          type: 'object',
          required: ['loanId'],
          properties: { loanId: { type: 'string' } },
        },
      },
    },
    controller.markRead.bind(controller)
  );
}

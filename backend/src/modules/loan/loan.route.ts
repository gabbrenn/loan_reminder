import { FastifyInstance } from 'fastify';
import { LoanController } from './loan.controller';
import { authorize } from '../../middleware/auth.middleware';

const controller = new LoanController();

const READ_ROLES = ['ADMIN', 'LOAN_OFFICER', 'CREDIT_MANAGER', 'BORROWER'] as const;
const WRITE_ROLES = ['ADMIN', 'LOAN_OFFICER'] as const;

const MANUAL_STATUS_ROLES = ['ADMIN', 'CREDIT_MANAGER'] as const;

export async function loanRoutes(fastify: FastifyInstance) {
  // Create loan & generate schedule
  fastify.post(
    '/',
    {
      preHandler: [fastify.authenticate, authorize([...WRITE_ROLES])],
      schema: {
        body: {
          type: 'object',
          required: [
            'borrowerId',
            'principalAmount',
            'interestRate',
            'loanDate',
            'dueDate',
            'frequency',
          ],
          properties: {
            borrowerId: { type: 'string' },
            principalAmount: { type: 'number', minimum: 0.01 },
            interestRate: { type: 'number', minimum: 0 },
            loanDate: { type: 'string', format: 'date-time' },
            dueDate: { type: 'string', format: 'date-time' },
            frequency: { type: 'string', enum: ['DAILY', 'WEEKLY', 'MONTHLY'] },
            purpose: { type: 'string' },
            gracePeriodDays: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    controller.create as any
  );

  // List all loans
  fastify.get(
    '/',
    {
      preHandler: [fastify.authenticate, authorize([...READ_ROLES])],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ACTIVE', 'PAID', 'OVERDUE', 'DEFAULTED'] },
            borrowerId: { type: 'string' },
            createdById: { type: 'string' },
          },
        },
      },
    },
    controller.list as any
  );

  // Export loans to CSV
  fastify.get(
    '/export',
    {
      preHandler: [fastify.authenticate, authorize([...READ_ROLES])],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ACTIVE', 'PAID', 'OVERDUE', 'DEFAULTED'] },
          },
        },
      },
    },
    controller.exportCsv as any
  );

  // View specific loan
  fastify.get(
    '/:id',
    {
      preHandler: [fastify.authenticate, authorize([...READ_ROLES])],
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

  // Manually change status (e.g. to DEFAULTED)
  fastify.patch(
    '/:id/status',
    {
      preHandler: [fastify.authenticate, authorize([...MANUAL_STATUS_ROLES])],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['ACTIVE', 'PAID', 'OVERDUE', 'DEFAULTED'] },
          },
        },
      },
    },
    controller.setStatus as any
  );
}

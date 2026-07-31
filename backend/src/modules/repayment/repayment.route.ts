import { FastifyInstance } from 'fastify';
import { RepaymentController } from './repayment.controller';
import { authorize } from '../../middleware/auth.middleware';

const controller = new RepaymentController();

const READ_ROLES = ['ADMIN', 'LOAN_OFFICER', 'CREDIT_MANAGER', 'BORROWER'] as const;

const WRITE_ROLES = ['ADMIN', 'LOAN_OFFICER'] as const;

export async function repaymentRoutes(fastify: FastifyInstance) {
  // Record repayment
  fastify.post(
    '/',
    {
      preHandler: [fastify.authenticate, authorize([...WRITE_ROLES])],
      schema: {
        body: {
          type: 'object',
          required: ['loanId', 'amount', 'paymentDate', 'paymentMethod'],
          properties: {
            loanId: { type: 'string' },
            amount: { type: 'number', minimum: 0.01 },
            paymentDate: { type: 'string', format: 'date-time' },
            paymentMethod: { type: 'string', enum: ['CASH', 'MOBILE_MONEY', 'BANK_TRANSFER'] },
          },
        },
      },
    },
    controller.record as any
  );

  // List payments for specific loan
  fastify.get(
    '/loan/:loanId',
    {
      preHandler: [fastify.authenticate, authorize([...READ_ROLES])],
      schema: {
        params: {
          type: 'object',
          required: ['loanId'],
          properties: { loanId: { type: 'string' } },
        },
      },
    },
    controller.listForLoan as any
  );
}

import { FastifyInstance } from 'fastify';
import { DashboardController } from './dashboard.controller';
import { authorize } from '../../middleware/auth.middleware';

const controller = new DashboardController();

const ALL_ROLES = ['ADMIN', 'LOAN_OFFICER', 'CREDIT_MANAGER', 'BORROWER'] as const;


export async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/metrics',
    {
      preHandler: [fastify.authenticate, authorize([...ALL_ROLES])],
    },
    controller.getMetrics
  );
}

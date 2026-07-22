import { FastifyInstance } from 'fastify';
import { ReminderService } from './reminder.service';
import { authorize } from '../../middleware/auth.middleware';

const service = new ReminderService();
const WRITE_ROLES = ['ADMIN', 'LOAN_OFFICER'] as const;

export async function reminderRoutes(fastify: FastifyInstance) {
  // Manual trigger of the daily reminder engine
  fastify.post(
    '/trigger',
    {
      preHandler: [fastify.authenticate, authorize([...WRITE_ROLES])],
    },
    async (request, reply) => {
      try {
        const summary = await service.runReminderEngine();
        return reply.code(200).send({
          success: true,
          message: 'Reminder engine triggered successfully',
          summary,
        });
      } catch (err: any) {
        return reply.code(500).send({
          error: {
            message: err.message || 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
          },
        });
      }
    }
  );
}

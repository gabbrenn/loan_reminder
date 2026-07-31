import { FastifyRequest, FastifyReply } from 'fastify';
import { DashboardService } from './dashboard.service';

const service = new DashboardService();

export class DashboardController {
  async getMetrics(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userPayload = request.user as any;
      const data = await service.getDashboardMetrics(userPayload);
      return reply.code(200).send(data);
    } catch (error: any) {
      return reply.code(500).send({
        error: {
          message: error.message || 'Internal server error',
          code: 'INTERNAL_SERVER_ERROR',
        },
      });
    }
  }
}

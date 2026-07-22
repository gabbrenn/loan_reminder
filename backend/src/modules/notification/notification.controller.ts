import { FastifyRequest, FastifyReply } from 'fastify';
import { NotificationLogService } from './notification.service';

const service = new NotificationLogService();

export class NotificationLogController {
  async list(
    request: FastifyRequest<{ Querystring: { channel?: string; status?: string } }>,
    reply: FastifyReply
  ) {
    try {
      const logs = await service.listNotifications(request.query);
      return reply.code(200).send(logs);
    } catch (error: any) {
      return reply.code(500).send({
        error: { message: error.message || 'Internal server error', code: 'INTERNAL_SERVER_ERROR' },
      });
    }
  }

  async getOne(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const log = await service.getNotification(request.params.id);
      return reply.code(200).send(log);
    } catch (error: any) {
      const status = error.message === 'Notification log not found' ? 404 : 400;
      return reply.code(status).send({
        error: { message: error.message, code: status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST' },
      });
    }
  }
}

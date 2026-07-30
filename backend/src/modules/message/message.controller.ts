import { FastifyRequest, FastifyReply } from 'fastify';
import { MessageService } from './message.service';

const messageService = new MessageService();

export class MessageController {
  async sendMessage(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { loanId } = request.params as { loanId: string };
      const { message } = request.body as { message: string };
      const currentUser = request.user as { id: string; role: string };

      const result = await messageService.sendMessage(loanId, message, currentUser);
      return reply.code(201).send(result);
    } catch (error: any) {
      return reply.code(400).send({
        error: {
          message: error.message || 'Failed to send message',
          code: 'BAD_REQUEST',
        },
      });
    }
  }

  async getLoanMessages(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { loanId } = request.params as { loanId: string };
      const currentUser = request.user as { id: string; role: string };

      const result = await messageService.getLoanMessages(loanId, currentUser);
      return reply.code(200).send(result);
    } catch (error: any) {
      const statusCode = error.message?.startsWith('Forbidden') ? 403 : 400;
      return reply.code(statusCode).send({
        error: {
          message: error.message || 'Failed to retrieve messages',
          code: statusCode === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
        },
      });
    }
  }

  async markRead(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { loanId } = request.params as { loanId: string };
      const currentUser = request.user as { id: string; role: string };

      await messageService.markRead(loanId, currentUser.id);
      return reply.code(200).send({ success: true });
    } catch (error: any) {
      return reply.code(400).send({
        error: {
          message: error.message || 'Failed to mark messages as read',
          code: 'BAD_REQUEST',
        },
      });
    }
  }
}

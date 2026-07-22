import { FastifyRequest, FastifyReply } from 'fastify';
import { AuditService } from './audit.service';

const service = new AuditService();

export async function listAuditLogs(req: FastifyRequest, reply: FastifyReply) {
  const { userId, entity, action } = req.query as any;
  const logs = await service.listLogs({ userId, entity, action });
  reply.send({ logs, total: logs.length });
}

export async function getAuditLog(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  try {
    const log = await service.getLog(id);
    reply.send({ log });
  } catch (err: any) {
    reply.status(404).send({ error: { message: err.message, code: 'NOT_FOUND' } });
  }
}

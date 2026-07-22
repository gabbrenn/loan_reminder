import { FastifyRequest, FastifyReply } from 'fastify';
import { UserService } from './user.service';

const service = new UserService();

export class UserController {
  async list(_request: FastifyRequest, reply: FastifyReply) {
    const users = await service.listUsers();
    return reply.code(200).send(users);
  }

  async create(
    request: FastifyRequest<{
      Body: { email: string; name: string; password: string; role: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = await service.createUser(request.body as any);
      return reply.code(201).send(user);
    } catch (err: any) {
      const status = err.message.includes('already exists') ? 409 : 400;
      return reply.code(status).send({ error: { message: err.message, code: status === 409 ? 'CONFLICT' : 'BAD_REQUEST' } });
    }
  }

  async update(
    request: FastifyRequest<{
      Params: { id: string };
      Body: { name?: string; role?: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const requesterId = (request.user as any).id;
      const user = await service.updateUser(request.params.id, request.body as any, requesterId);
      return reply.code(200).send(user);
    } catch (err: any) {
      const status = err.message === 'User not found' ? 404 : 400;
      return reply.code(status).send({ error: { message: err.message, code: status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST' } });
    }
  }

  async remove(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const requesterId = (request.user as any).id;
      await service.deleteUser(request.params.id, requesterId);
      return reply.code(204).send();
    } catch (err: any) {
      const status = err.message === 'User not found' ? 404 : 400;
      return reply.code(status).send({ error: { message: err.message, code: status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST' } });
    }
  }
}

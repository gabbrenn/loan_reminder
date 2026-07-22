import { FastifyRequest, FastifyReply } from 'fastify';
import { BorrowerService } from './borrower.service';

const service = new BorrowerService();

export const BorrowerController = {
  async create(request: FastifyRequest<{ Body: any }>, reply: FastifyReply) {
    try {
      const actorId = (request as any).user?.id;
      const borrower = await service.createBorrower(request.body as any, actorId);
      return reply.code(201).send(borrower);
    } catch (error: any) {
      return reply.code(400).send({ error: { message: error.message, code: 'BAD_REQUEST' } });
    }
  },

  async getOne(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const borrower = await service.getBorrower(request.params.id);
      return reply.code(200).send(borrower);
    } catch (error: any) {
      const status = error.message === 'Borrower not found' ? 404 : 400;
      return reply.code(status).send({ error: { message: error.message, code: 'NOT_FOUND' } });
    }
  },

  async list(request: FastifyRequest<{ Querystring: { search?: string } }>, reply: FastifyReply) {
    try {
      const borrowers = await service.listBorrowers(request.query.search);
      return reply.code(200).send(borrowers);
    } catch (error: any) {
      return reply.code(500).send({ error: { message: error.message, code: 'INTERNAL_SERVER_ERROR' } });
    }
  },

  async update(request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) {
    try {
      const actorId = (request as any).user?.id;
      const borrower = await service.updateBorrower(request.params.id, request.body as any, actorId);
      return reply.code(200).send(borrower);
    } catch (error: any) {
      const status = error.message === 'Borrower not found' ? 404 : 400;
      return reply.code(status).send({ error: { message: error.message, code: 'BAD_REQUEST' } });
    }
  },

  async remove(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const actorId = (request as any).user?.id;
      await service.deleteBorrower(request.params.id, actorId);
      return reply.code(204).send();
    } catch (error: any) {
      const status = error.message === 'Borrower not found' ? 404 : 400;
      return reply.code(status).send({ error: { message: error.message, code: 'BAD_REQUEST' } });
    }
  },
};

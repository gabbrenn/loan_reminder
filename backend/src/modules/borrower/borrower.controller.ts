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

  async importBorrowers(request: FastifyRequest<{ Body: { borrowers: any[] } }>, reply: FastifyReply) {
    try {
      const actorId = (request as any).user?.id;
      const borrowers = request.body?.borrowers || [];
      if (!Array.isArray(borrowers) || borrowers.length === 0) {
        return reply.code(400).send({
          error: { message: 'No borrowers data provided for import', code: 'BAD_REQUEST' },
        });
      }
      const result = await service.importBorrowers(borrowers, actorId);
      return reply.code(200).send(result);
    } catch (error: any) {
      return reply.code(400).send({ error: { message: error.message, code: 'BAD_REQUEST' } });
    }
  },

  async downloadTemplate(_request: FastifyRequest, reply: FastifyReply) {
    const csvHeader = 'fullName,nationalId,phone,email,address,occupation,guarantorName,guarantorPhone,photo\n';
    const sampleRow = 'Jean Paul Ndayishimiye,1199880011223344,+250788123456,jeanpaul@example.com,Kigali Nyarugenge,Entrepreneur,Marie Uwimana,+250788654321,\n';
    
    return reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', 'attachment; filename="borrowers_import_template.csv"')
      .send(csvHeader + sampleRow);
  },
};

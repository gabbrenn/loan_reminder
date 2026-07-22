import { FastifyRequest, FastifyReply } from 'fastify';
import { RepaymentService } from './repayment.service';
import { PaymentMethod } from '@prisma/client';

const service = new RepaymentService();

export class RepaymentController {
  async record(
    request: FastifyRequest<{
      Body: {
        loanId: string;
        amount: number;
        paymentDate: string;
        paymentMethod: PaymentMethod;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const actorId = (request as any).user?.id;
      const result = await service.recordRepayment({ ...request.body, actorId });
      return reply.code(201).send(result);
    } catch (error: any) {
      return reply.code(400).send({
        error: {
          message: error.message || 'Failed to record repayment',
          code: 'BAD_REQUEST',
        },
      });
    }
  }

  async listForLoan(
    request: FastifyRequest<{ Params: { loanId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const history = await service.getRepaymentHistory(request.params.loanId);
      return reply.code(200).send(history);
    } catch (error: any) {
      const status = error.message === 'Loan not found' ? 404 : 400;
      return reply.code(status).send({
        error: {
          message: error.message,
          code: status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
        },
      });
    }
  }
}

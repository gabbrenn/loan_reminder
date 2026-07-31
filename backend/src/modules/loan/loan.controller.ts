import { FastifyRequest, FastifyReply } from 'fastify';
import { LoanService } from './loan.service';
import { LoanStatus, RepaymentFrequency } from '@prisma/client';

const service = new LoanService();

export class LoanController {
  async create(
    request: FastifyRequest<{
      Body: {
        borrowerId: string;
        principalAmount: number;
        interestRate: number;
        loanDate: string;
        dueDate: string;
        frequency: RepaymentFrequency;
        purpose?: string;
        gracePeriodDays?: number;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const userPayload = request.user as any;
      const loan = await service.createLoan({
        ...request.body,
        createdById: userPayload?.id,
        actorId: userPayload?.id,
      });
      return reply.code(201).send(loan);
    } catch (error: any) {
      return reply.code(400).send({
        error: {
          message: error.message || 'Failed to create loan',
          code: 'BAD_REQUEST',
        },
      });
    }
  }

  async getOne(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const userPayload = request.user as any;
      const loan = await service.getLoan(request.params.id);

      // Borrowers can only view their own loans
      if (userPayload?.role === 'BORROWER' && loan.borrowerId !== userPayload?.id) {
        return reply.code(403).send({
          error: { message: 'Forbidden: You can only view your own loans', code: 'FORBIDDEN' },
        });
      }

      return reply.code(200).send(loan);
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

  async list(
    request: FastifyRequest<{
      Querystring: { status?: LoanStatus; borrowerId?: string; createdById?: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const userPayload = request.user as any;
      const query = { ...request.query };

      // Borrowers can only see their own loans — override any borrowerId filter
      if (userPayload?.role === 'BORROWER') {
        query.borrowerId = userPayload.id;
      }

      const loans = await service.listLoans(query);
      return reply.code(200).send(loans);
    } catch (error: any) {
      return reply.code(500).send({
        error: {
          message: error.message || 'Internal server error',
          code: 'INTERNAL_SERVER_ERROR',
        },
      });
    }
  }

  async exportCsv(
    request: FastifyRequest<{
      Querystring: { status?: LoanStatus };
    }>,
    reply: FastifyReply
  ) {
    try {
      const loans = await service.listLoans({ status: request.query.status });
      
      let csv = 'Loan Number,Borrower Name,Phone,Email,Principal,Total Payable,Remaining Balance,Due Date,Status\n';
      
      for (const l of loans) {
        const dueDateStr = new Date(l.dueDate).toISOString().slice(0, 10);
        csv += `"${l.loanNumber}","${l.borrower.fullName}","${l.borrower.phone}","${l.borrower.email}",${l.principalAmount},${l.totalPayable},${l.remainingBalance},"${dueDateStr}","${l.status}"\n`;
      }

      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="loans-${request.query.status || 'all'}-${new Date().toISOString().slice(0, 10)}.csv"`);
      return reply.code(200).send(csv);
    } catch (error: any) {
      return reply.code(500).send({
        error: {
          message: error.message || 'CSV generation failed',
          code: 'INTERNAL_SERVER_ERROR',
        },
      });
    }
  }

  async setStatus(
    request: FastifyRequest<{
      Params: { id: string };
      Body: { status: LoanStatus };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { status } = request.body;
      const actorId = (request as any).user?.id;
      const loan = await service.updateLoanStatus(request.params.id, status, actorId);
      return reply.code(200).send(loan);
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

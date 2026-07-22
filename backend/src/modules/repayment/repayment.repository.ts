import prisma from '../../lib/prisma';
import { LoanStatus, PaymentMethod } from '@prisma/client';

export interface ScheduleUpdateInput {
  id: string;
  amountPaid: number;
}

export class RepaymentRepository {
  async executeRepaymentTransaction(params: {
    loanId: string;
    amount: number;
    paymentDate: Date;
    paymentMethod: PaymentMethod;
    scheduleUpdates: ScheduleUpdateInput[];
    newRemainingBalance: number;
    newStatus: LoanStatus;
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. Log the repayment record
      const repayment = await tx.loanRepayment.create({
        data: {
          loanId: params.loanId,
          amount: params.amount,
          paymentDate: params.paymentDate,
          paymentMethod: params.paymentMethod,
        },
      });

      // 2. Update each changed repayment schedule installment
      for (const update of params.scheduleUpdates) {
        await tx.repaymentSchedule.update({
          where: { id: update.id },
          data: { amountPaid: update.amountPaid },
        });
      }

      // 3. Update the Loan details
      const loan = await tx.loan.update({
        where: { id: params.loanId },
        data: {
          remainingBalance: params.newRemainingBalance,
          status: params.newStatus,
        },
        include: {
          repaymentSchedules: {
            orderBy: { installmentNumber: 'asc' },
          },
          borrower: true,
        },
      });

      return { repayment, loan };
    });
  }

  async findRepaymentsByLoanId(loanId: string) {
    return prisma.loanRepayment.findMany({
      where: { loanId },
      orderBy: { paymentDate: 'desc' },
    });
  }
}

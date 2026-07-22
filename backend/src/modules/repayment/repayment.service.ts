import { RepaymentRepository, ScheduleUpdateInput } from './repayment.repository';
import prisma from '../../lib/prisma';
import { LoanStatus, PaymentMethod } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

const auditService = new AuditService();

export class RepaymentService {
  private repo: RepaymentRepository;

  constructor() {
    this.repo = new RepaymentRepository();
  }

  async recordRepayment(data: {
    loanId: string;
    amount: number;
    paymentDate: string | Date;
    paymentMethod: PaymentMethod;
    actorId?: string;
  }) {
    // 1. Fetch Loan with schedules
    const loan = await prisma.loan.findUnique({
      where: { id: data.loanId },
      include: {
        repaymentSchedules: {
          orderBy: { installmentNumber: 'asc' },
        },
      },
    });

    if (!loan) {
      throw new Error('Loan not found');
    }
    if (data.amount <= 0) {
      throw new Error('Repayment amount must be greater than zero');
    }
    if (loan.remainingBalance <= 0) {
      throw new Error('Loan is already fully paid');
    }

    const paymentDate = new Date(data.paymentDate);
    const amountToApply = Math.round(data.amount * 100) / 100;
    
    let remainingPayment = amountToApply;
    const scheduleUpdates: ScheduleUpdateInput[] = [];
    
    // 2. Allocate payment to installments sequentially (earliest first)
    const updatedSchedulesState = loan.repaymentSchedules.map((s) => ({
      ...s,
    }));

    for (const schedule of updatedSchedulesState) {
      if (remainingPayment <= 0) break;

      const unpaidForInstallment = Math.round((schedule.amountDue - schedule.amountPaid) * 100) / 100;
      if (unpaidForInstallment <= 0) continue;

      if (remainingPayment >= unpaidForInstallment) {
        schedule.amountPaid = schedule.amountDue;
        remainingPayment = Math.round((remainingPayment - unpaidForInstallment) * 100) / 100;
      } else {
        schedule.amountPaid = Math.round((schedule.amountPaid + remainingPayment) * 100) / 100;
        remainingPayment = 0;
      }

      scheduleUpdates.push({
        id: schedule.id,
        amountPaid: schedule.amountPaid,
      });
    }

    // 3. Determine new remaining balance
    const newRemainingBalance = Math.round(Math.max(0, loan.remainingBalance - amountToApply) * 100) / 100;

    // 4. Auto-update status transitions
    let newStatus = loan.status;

    if (newRemainingBalance <= 0) {
      newStatus = LoanStatus.PAID;
    } else if (loan.status !== LoanStatus.DEFAULTED) {
      // If not defaulted and not fully paid, evaluate if active or overdue
      const now = new Date();
      
      const hasOverdueInstallment = updatedSchedulesState.some((s) => {
        const isPastDue = new Date(s.dueDate) < now;
        const isNotPaid = s.amountPaid < s.amountDue;
        return isPastDue && isNotPaid;
      });

      newStatus = hasOverdueInstallment ? LoanStatus.OVERDUE : LoanStatus.ACTIVE;
    }

    return this.repo.executeRepaymentTransaction({
      loanId: data.loanId,
      amount: amountToApply,
      paymentDate,
      paymentMethod: data.paymentMethod,
      scheduleUpdates,
      newRemainingBalance,
      newStatus,
    }).then(async (result) => {
      if (data.actorId) {
        await auditService.log(data.actorId, 'PAYMENT', 'LOAN_REPAYMENT', data.loanId).catch(() => {});
      }
      return result;
    });
  }

  async getRepaymentHistory(loanId: string) {
    // Verify loan exists
    const loanExists = await prisma.loan.findUnique({
      where: { id: loanId },
    });
    if (!loanExists) {
      throw new Error('Loan not found');
    }
    return this.repo.findRepaymentsByLoanId(loanId);
  }
}

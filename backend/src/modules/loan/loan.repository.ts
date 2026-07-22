import prisma from '../../lib/prisma';
import { LoanStatus, RepaymentFrequency } from '@prisma/client';

export interface CreateLoanInput {
  loanNumber: string;
  borrowerId: string;
  createdById?: string;
  principalAmount: number;
  interestRate: number;
  totalPayable: number;
  remainingBalance: number;
  loanDate: Date;
  dueDate: Date;
  frequency: RepaymentFrequency;
  status: LoanStatus;
  purpose?: string;
  gracePeriodDays?: number;
}

export interface CreateScheduleInput {
  installmentNumber: number;
  dueDate: Date;
  amountDue: number;
}

export class LoanRepository {
  async create(loanData: CreateLoanInput, schedules: CreateScheduleInput[]) {
    return prisma.$transaction(async (tx) => {
      const loan = await tx.loan.create({
        data: {
          loanNumber: loanData.loanNumber,
          borrowerId: loanData.borrowerId,
          createdById: loanData.createdById,
          principalAmount: loanData.principalAmount,
          interestRate: loanData.interestRate,
          totalPayable: loanData.totalPayable,
          remainingBalance: loanData.remainingBalance,
          loanDate: loanData.loanDate,
          dueDate: loanData.dueDate,
          frequency: loanData.frequency,
          status: loanData.status,
          purpose: loanData.purpose,
          gracePeriodDays: loanData.gracePeriodDays ?? 0,
          repaymentSchedules: {
            create: schedules.map((s) => ({
              installmentNumber: s.installmentNumber,
              dueDate: s.dueDate,
              amountDue: s.amountDue,
              amountPaid: 0,
            })),
          },
        },
        include: {
          repaymentSchedules: true,
          borrower: true,
          createdBy: {
            select: { id: true, name: true, role: true },
          },
        },
      });
      return loan;
    });
  }

  async findById(id: string) {
    return prisma.loan.findUnique({
      where: { id },
      include: {
        repaymentSchedules: {
          orderBy: { installmentNumber: 'asc' },
        },
        borrower: true,
        createdBy: {
          select: { id: true, name: true, role: true },
        },
      },
    });
  }

  async findAll(filters?: { status?: LoanStatus; borrowerId?: string; createdById?: string }) {
    return prisma.loan.findMany({
      where: {
        status: filters?.status,
        borrowerId: filters?.borrowerId,
        createdById: filters?.createdById,
      },
      include: {
        borrower: true,
        createdBy: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: LoanStatus) {
    return prisma.loan.update({
      where: { id },
      data: { status },
      include: {
        repaymentSchedules: {
          orderBy: { installmentNumber: 'asc' },
        },
        borrower: true,
      },
    });
  }
}

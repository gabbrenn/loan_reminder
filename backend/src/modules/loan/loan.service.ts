import { LoanRepository } from './loan.repository';
import prisma from '../../lib/prisma';
import { LoanStatus, RepaymentFrequency } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

const auditService = new AuditService();

export class LoanService {
  private repo: LoanRepository;

  constructor() {
    this.repo = new LoanRepository();
  }

  async createLoan(data: {
    borrowerId: string;
    principalAmount: number;
    interestRate: number;
    loanDate: string | Date;
    dueDate: string | Date;
    frequency: RepaymentFrequency;
    createdById?: string;
    purpose?: string;
    gracePeriodDays?: number;
    actorId?: string;
  }) {
    // 1. Verify borrower exists
    const borrower = await prisma.borrower.findUnique({
      where: { id: data.borrowerId },
    });
    if (!borrower) {
      throw new Error('Borrower not found');
    }

    // Verify creator user exists (for foreign key constraint safety with mock JWTs in tests)
    let createdById: string | undefined = undefined;
    if (data.createdById) {
      const userExists = await prisma.user.findUnique({ where: { id: data.createdById } });
      if (userExists) {
        createdById = data.createdById;
      }
    }

    const loanDate = new Date(data.loanDate);
    const dueDate = new Date(data.dueDate);

    if (dueDate <= loanDate) {
      throw new Error('Due date must be after loan date');
    }
    if (data.principalAmount <= 0) {
      throw new Error('Principal amount must be greater than zero');
    }
    if (data.interestRate < 0) {
      throw new Error('Interest rate cannot be negative');
    }

    // 2. Perform loan math: Flat interest rate
    // totalPayable = principal + (principal * interestRate)
    const principal = data.principalAmount;
    const interest = principal * data.interestRate;
    const totalPayable = Math.round((principal + interest) * 100) / 100;

    // 3. Generate unique loan number: LN-YYYYMMDD-XXXX
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    const loanNumber = `LN-${datePart}-${randomPart}`;

    // 4. Generate Repayment Schedule dates
    const dates: Date[] = [];
    const current = new Date(loanDate);

    while (true) {
      if (data.frequency === 'DAILY') {
        current.setDate(current.getDate() + 1);
      } else if (data.frequency === 'WEEKLY') {
        current.setDate(current.getDate() + 7);
      } else if (data.frequency === 'MONTHLY') {
        current.setMonth(current.getMonth() + 1);
      }

      if (current >= dueDate) {
        dates.push(new Date(dueDate));
        break;
      } else {
        dates.push(new Date(current));
      }
    }

    const numInstallments = dates.length;
    const baseAmount = Math.round((totalPayable / numInstallments) * 100) / 100;
    
    // Build installment payload
    const schedules = dates.map((date, index) => {
      const isLast = index === numInstallments - 1;
      let amountDue = baseAmount;
      
      if (isLast) {
        // Adjust for rounding differences on the final installment
        const sumOfPrev = baseAmount * (numInstallments - 1);
        amountDue = Math.round((totalPayable - sumOfPrev) * 100) / 100;
      }

      return {
        installmentNumber: index + 1,
        dueDate: date,
        amountDue,
      };
    });

    const loanInput = {
      loanNumber,
      borrowerId: data.borrowerId,
      createdById,
      principalAmount: principal,
      interestRate: data.interestRate,
      totalPayable,
      remainingBalance: totalPayable,
      loanDate,
      dueDate,
      frequency: data.frequency,
      status: LoanStatus.ACTIVE,
      purpose: data.purpose,
      gracePeriodDays: data.gracePeriodDays ?? 0,
    };

    const loan = await this.repo.create(loanInput, schedules);
    const actorId = data.actorId || createdById;
    if (actorId) {
      await auditService.log(actorId, 'CREATE', 'LOAN', loan.id).catch(() => {});
    }
    return loan;
  }

  async getLoan(id: string) {
    const loan = await this.repo.findById(id);
    if (!loan) {
      throw new Error('Loan not found');
    }
    return loan;
  }

  async listLoans(filters?: { status?: LoanStatus; borrowerId?: string; createdById?: string }) {
    return this.repo.findAll(filters);
  }

  async updateLoanStatus(id: string, status: LoanStatus, actorId?: string) {
    const loan = await this.repo.findById(id);
    if (!loan) {
      throw new Error('Loan not found');
    }
    const updated = await this.repo.updateStatus(id, status);
    if (actorId) {
      await auditService.log(actorId, 'STATUS_CHANGE', 'LOAN', id).catch(() => {});
    }
    return updated;
  }
}

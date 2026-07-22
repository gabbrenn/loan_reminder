import prisma from '../../lib/prisma';
import { LoanStatus, NotificationStatus } from '@prisma/client';

export class DashboardRepository {
  async getBorrowerCount() {
    return prisma.borrower.count();
  }

  async getActiveLoanCount() {
    return prisma.loan.count({
      where: { status: LoanStatus.ACTIVE },
    });
  }

  async getOverdueLoanCount() {
    return prisma.loan.count({
      where: { status: LoanStatus.OVERDUE },
    });
  }

  async getNotificationCountToday(startOfDay: Date, endOfDay: Date) {
    return prisma.notificationLog.count({
      where: {
        status: NotificationStatus.SENT,
        sentAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });
  }

  async getAllLoansWithSchedules() {
    return prisma.loan.findMany({
      include: {
        borrower: true,
        repaymentSchedules: {
          orderBy: { installmentNumber: 'asc' },
        },
      },
    });
  }
}

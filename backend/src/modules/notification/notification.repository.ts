import prisma from '../../lib/prisma';

export class NotificationLogRepository {
  async findAll(filters?: { channel?: string; status?: string }) {
    return prisma.notificationLog.findMany({
      where: {
        channel: filters?.channel as any,
        status: filters?.status as any,
      },
      include: {
        repaymentSchedule: {
          include: {
            loan: {
              include: { borrower: true },
            },
          },
        },
      },
      orderBy: { sentAt: 'desc' },
    });
  }

  async findById(id: string) {
    return prisma.notificationLog.findUnique({
      where: { id },
      include: {
        repaymentSchedule: {
          include: {
            loan: {
              include: { borrower: true },
            },
          },
        },
      },
    });
  }
}

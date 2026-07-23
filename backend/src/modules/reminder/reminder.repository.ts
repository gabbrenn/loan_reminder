import prisma from '../../lib/prisma';
import { ReminderType, NotificationChannel, NotificationStatus } from '@prisma/client';

export class ReminderRepository {
  async getUnpaidSchedules() {
    return prisma.repaymentSchedule.findMany({
      where: {
        amountPaid: {
          lt: prisma.repaymentSchedule.fields.amountDue,
        },
        loan: {
          status: {
            in: ['ACTIVE', 'OVERDUE', 'DEFAULTED'],
          },
        },
      },
      include: {
        loan: {
          include: {
            borrower: true,
          },
        },
      },
    });
  }

  async hasReminderBeenSent(params: {
    repaymentScheduleId: string;
    reminderType: ReminderType;
    channel: NotificationChannel;
  }) {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const existing = await prisma.notificationLog.findFirst({
      where: {
        repaymentScheduleId: params.repaymentScheduleId,
        reminderType: params.reminderType,
        channel: params.channel,
        status: {
          in: [NotificationStatus.SENT, NotificationStatus.PENDING],
        },
        sentAt: {
          gte: oneMinuteAgo,
        },
      },
    });
    return !!existing;
  }

  async createPendingNotification(data: {
    repaymentScheduleId: string;
    reminderType: ReminderType;
    channel: NotificationChannel;
    message: string;
  }) {
    const log = await prisma.notificationLog.create({
      data: {
        repaymentScheduleId: data.repaymentScheduleId,
        reminderType: data.reminderType,
        channel: data.channel,
        status: NotificationStatus.PENDING,
        message: data.message,
      },
    });
    return log.id;
  }

  async updateNotificationStatus(id: string, status: NotificationStatus, errorMessage?: string) {
    return prisma.notificationLog.update({
      where: { id },
      data: {
        status,
        errorMessage,
        sentAt: new Date(),
      },
    });
  }

  async getPendingNotifications() {
    return prisma.notificationLog.findMany({
      where: {
        status: NotificationStatus.PENDING,
      },
      include: {
        repaymentSchedule: {
          include: {
            loan: {
              include: {
                borrower: true,
              },
            },
          },
        },
      },
    });
  }

  async getAdminEmails(): Promise<string[]> {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true },
    });
    return admins.map((u) => u.email);
  }
}

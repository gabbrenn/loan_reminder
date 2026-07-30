import prisma from '../../lib/prisma';
import { ReminderType, NotificationChannel, NotificationStatus } from '@prisma/client';

export class ReminderRepository {
  async getUnpaidSchedules() {
    // Fetch all schedules where amountPaid < amountDue for active/overdue/defaulted loans.
    // Prisma doesn't support cross-column comparisons; we use a raw query to get IDs then fetch full records.
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT rs.id FROM repayment_schedules rs
      JOIN loans l ON l.id = rs."loanId"
      WHERE rs."amountPaid" < rs."amountDue"
        AND l.status IN ('ACTIVE', 'OVERDUE', 'DEFAULTED')
    `;
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return [];
    return prisma.repaymentSchedule.findMany({
      where: { id: { in: ids } },
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
    // Idempotency: one notification per (repaymentSchedule, reminderType, channel) per calendar day (Africa/Kigali)
    const now = new Date();
    // Start of today in Africa/Kigali = UTC-2 offset... use a simple day boundary at UTC midnight minus 2h
    // More reliably: use the start-of-day in Kigali by computing offset. Kigali is UTC+2 (no DST).
    const KIGALI_OFFSET_MS = 2 * 60 * 60 * 1000;
    const kigaliNow = new Date(now.getTime() + KIGALI_OFFSET_MS);
    const startOfKigaliDay = new Date(
      Date.UTC(kigaliNow.getUTCFullYear(), kigaliNow.getUTCMonth(), kigaliNow.getUTCDate())
    );
    const startOfDayUTC = new Date(startOfKigaliDay.getTime() - KIGALI_OFFSET_MS);

    const existing = await prisma.notificationLog.findFirst({
      where: {
        repaymentScheduleId: params.repaymentScheduleId,
        reminderType: params.reminderType,
        channel: params.channel,
        // Check any log already queued/sent/failed today (idempotency: one per calendar day per channel)
        sentAt: {
          gte: startOfDayUTC,
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

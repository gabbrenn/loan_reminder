import { ReminderRepository } from './reminder.repository';
import { ReminderType, NotificationChannel, NotificationStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import { SettingsService } from '../settings/settings.service';
import { sendEmail } from '../../lib/notify';
import { emailTemplates } from '../../lib/emailTemplates';

const settingsService = new SettingsService();

interface PendingBorrowerReminderItem {
  schedule: any;
  reminderType: ReminderType;
  dueKigali: DateTime;
  diffDays: number;
  amountRemaining: number;
  isOverdue: boolean;
  statusText: string;
  needEmail: boolean;
  needSMS: boolean;
}

export class ReminderService {
  private repo: ReminderRepository;

  constructor() {
    this.repo = new ReminderRepository();
  }

  async runReminderEngine(force: boolean = false) {
    // 1. Fetch system settings
    const settings = await settingsService.getSettings();

    const unpaidSchedules = await this.repo.getUnpaidSchedules();
    const nowKigali = DateTime.now().setZone('Africa/Kigali');
    const todayKigali = nowKigali.startOf('day');

    let totalChecked = 0;
    let sentCount = 0;
    let failedCount = 0;

    // Group items by borrowerId
    const borrowerMap = new Map<
      string,
      {
        borrower: any;
        items: PendingBorrowerReminderItem[];
      }
    >();

    for (const schedule of unpaidSchedules) {
      totalChecked++;
      const borrower = schedule.loan.borrower;
      if (!borrower) continue;

      const dueKigali = DateTime.fromJSDate(schedule.dueDate).setZone('Africa/Kigali').startOf('day');
      const diffDays = Math.round(dueKigali.diff(todayKigali, 'days').days);

      let reminderType: ReminderType | null = null;

      // Match days dynamically against system settings
      if (diffDays === settings.reminderDaysBefore1) {
        reminderType = ReminderType.BEFORE_7_DAYS;
      } else if (diffDays === settings.reminderDaysBefore2) {
        reminderType = ReminderType.BEFORE_3_DAYS;
      } else if (diffDays === settings.reminderDaysBefore3) {
        reminderType = ReminderType.BEFORE_1_DAY;
      } else if (diffDays < 0) {
        // Grace Period logic
        const gracePassed = Math.abs(diffDays) > schedule.loan.gracePeriodDays;
        if (gracePassed) {
          reminderType = ReminderType.OVERDUE;
        }
      }

      if (!reminderType) continue;

      let needEmail = true;
      let needSMS = true;

      // If not forced (e.g. automated cron run), check idempotency
      if (!force) {
        const [alreadySentEmail, alreadySentSMS] = await Promise.all([
          this.repo.hasReminderBeenSent({
            repaymentScheduleId: schedule.id,
            reminderType,
            channel: NotificationChannel.EMAIL,
          }),
          this.repo.hasReminderBeenSent({
            repaymentScheduleId: schedule.id,
            reminderType,
            channel: NotificationChannel.SMS,
          }),
        ]);

        needEmail = !alreadySentEmail;
        needSMS = !alreadySentSMS;
      }

      if (!needEmail && !needSMS) continue;

      const amountRemaining = Math.round((schedule.amountDue - schedule.amountPaid) * 100) / 100;
      const isOverdue = reminderType === ReminderType.OVERDUE;
      const statusText = isOverdue
        ? 'OVERDUE'
        : diffDays === 1
        ? 'Due Tomorrow'
        : `Due in ${diffDays} days`;

      if (!borrowerMap.has(borrower.id)) {
        borrowerMap.set(borrower.id, { borrower, items: [] });
      }

      borrowerMap.get(borrower.id)!.items.push({
        schedule,
        reminderType,
        dueKigali,
        diffDays,
        amountRemaining,
        isOverdue,
        statusText,
        needEmail,
        needSMS,
      });
    }

    // 2. Create consolidated notifications per borrower
    for (const [borrowerId, { borrower, items }] of borrowerMap.entries()) {
      const emailItems = items.filter((i) => i.needEmail);
      const smsItems = items.filter((i) => i.needSMS);

      // Consolidated EMAIL (Exactly 1 email per borrower)
      if (emailItems.length > 0) {
        const emailBody = emailTemplates.consolidatedBorrowerReminder({
          borrowerName: borrower.fullName,
          items: emailItems.map((i) => ({
            loanNumber: i.schedule.loan.loanNumber,
            installmentNumber: i.schedule.installmentNumber,
            dueDate: i.dueKigali.toFormat('dd LLL yyyy'),
            amountRemaining: i.amountRemaining,
            isOverdue: i.isOverdue,
            statusText: i.statusText,
          })),
        });

        // Use the first schedule item as the primary anchor log for this consolidated email
        const primaryItem = emailItems[0];
        await this.repo.createPendingNotification({
          repaymentScheduleId: primaryItem.schedule.id,
          reminderType: primaryItem.reminderType,
          channel: NotificationChannel.EMAIL,
          message: emailBody,
        });

        // For remaining schedules in this digest, record sent log directly if forced/needed without re-sending duplicate emails
        for (let idx = 1; idx < emailItems.length; idx++) {
          const item = emailItems[idx];
          await this.repo.createPendingNotification({
            repaymentScheduleId: item.schedule.id,
            reminderType: item.reminderType,
            channel: NotificationChannel.EMAIL,
            message: emailBody,
          });
        }
      }

      // Consolidated SMS (Exactly 1 SMS per borrower)
      if (smsItems.length > 0) {
        const smsBody = emailTemplates.consolidatedBorrowerSMS({
          items: smsItems.map((i) => ({
            loanNumber: i.schedule.loan.loanNumber,
            amountRemaining: i.amountRemaining,
            isOverdue: i.isOverdue,
            statusText: i.statusText,
          })),
        });

        const primaryItem = smsItems[0];
        await this.repo.createPendingNotification({
          repaymentScheduleId: primaryItem.schedule.id,
          reminderType: primaryItem.reminderType,
          channel: NotificationChannel.SMS,
          message: smsBody,
        });

        for (let idx = 1; idx < smsItems.length; idx++) {
          const item = smsItems[idx];
          await this.repo.createPendingNotification({
            repaymentScheduleId: item.schedule.id,
            reminderType: item.reminderType,
            channel: NotificationChannel.SMS,
            message: smsBody,
          });
        }
      }
    }

    // 3. Process the queue
    const queueResult = await this.processQueue();
    sentCount = queueResult.sentCount;
    failedCount = queueResult.failedCount;

    // Send Daily Summary Email to Admins if email is globally enabled
    if (settings.emailEnabled) {
      try {
        const adminEmails = await this.repo.getAdminEmails();
        if (adminEmails.length > 0) {
          const subject = `📊 Daily Reminder Engine Briefing - ${nowKigali.toFormat('dd LLL yyyy')}`;
          const body = `
<div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #f4f6f9; padding: 30px 20px; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.06); border: 1px solid #e1e4e8;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1abc9c, #16a085); padding: 30px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">📊 DAILY REMINDER BRIEFING</h1>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px; line-height: 1.6;">
      <p style="margin: 0 0 15px 0; font-size: 16px; color: #2c3e50;">Dear <strong>Administrator</strong>,</p>
      <p style="margin: 0 0 20px 0; font-size: 15px; color: #555;">Here is the daily operational summary from the Loan Reminder Engine:</p>
      
      <!-- Stats Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; background-color: #fdfefe; border: 1px solid #eaeded; border-radius: 6px;">
        <tr style="border-bottom: 1px solid #f2f4f4;">
          <td style="padding: 12px 15px; font-size: 14px; color: #7f8c8d; font-weight: 600;">Run Time</td>
          <td style="padding: 12px 15px; font-size: 14px; color: #2c3e50; text-align: right;">${nowKigali.toFormat('dd LLL yyyy HH:mm')} Africa/Kigali</td>
        </tr>
        <tr style="border-bottom: 1px solid #f2f4f4;">
          <td style="padding: 12px 15px; font-size: 14px; color: #7f8c8d; font-weight: 600;">Unpaid Installments Checked</td>
          <td style="padding: 12px 15px; font-size: 14px; color: #2c3e50; text-align: right; font-weight: 700;">${totalChecked}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f2f4f4;">
          <td style="padding: 12px 15px; font-size: 14px; color: #2c3e50; font-weight: 600;">✅ Sent Successfully</td>
          <td style="padding: 12px 15px; font-size: 16px; color: #27ae60; text-align: right; font-weight: 700;">${sentCount}</td>
        </tr>
        <tr>
          <td style="padding: 12px 15px; font-size: 14px; color: #2c3e50; font-weight: 600;">❌ Failed / Dropped</td>
          <td style="padding: 12px 15px; font-size: 16px; color: #c0392b; text-align: right; font-weight: 700;">${failedCount}</td>
        </tr>
      </table>

      <!-- Note Callout -->
      <div style="background-color: #f9f9f9; border-left: 4px solid #bdc3c7; padding: 15px; border-radius: 4px; margin-bottom: 25px;">
        <p style="margin: 0; font-size: 13px; color: #7f8c8d;">
          This cron task executes automatically every morning at 07:00 Kigali time. Any failed messages will be retried on the next execution cycle.
        </p>
      </div>

      <p style="margin: 0; font-size: 15px; color: #7f8c8d;">Regards,<br/><strong style="color: #2c3e50;">MFI Loan Alert System</strong></p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eeeeee; font-size: 12px; color: #95a5a6;">
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} MFI Loan Alert System. All rights reserved.</p>
    </div>
  </div>
</div>
`;

          await sendEmail('EMAIL', adminEmails[0], {
            message: body,
          });

        }
      } catch (e) {
        console.error('Failed to send daily admin briefing email:', e);
      }

    }

    return { totalChecked, sentCount, failedCount };
  }

  async processQueue() {
    const settings = await settingsService.getSettings();
    const pendingLogs = await this.repo.getPendingNotifications();

    let sentCount = 0;
    let failedCount = 0;

    // Deduplicate pending logs by (recipientEmail/phone, channel) so ONLY 1 physical message is dispatched per recipient per channel
    const emailGroupMap = new Map<string, typeof pendingLogs>();
    const smsGroupMap = new Map<string, typeof pendingLogs>();

    for (const log of pendingLogs) {
      const borrower = log.repaymentSchedule.loan.borrower;
      if (!borrower) {
        await this.repo.updateNotificationStatus(
          log.id,
          NotificationStatus.FAILED,
          'Borrower not found'
        );
        failedCount++;
        continue;
      }

      if (log.channel === NotificationChannel.EMAIL) {
        if (!borrower.email) {
          await this.repo.updateNotificationStatus(
            log.id,
            NotificationStatus.FAILED,
            'Borrower email not found'
          );
          failedCount++;
          continue;
        }
        if (!emailGroupMap.has(borrower.email)) {
          emailGroupMap.set(borrower.email, []);
        }
        emailGroupMap.get(borrower.email)!.push(log);
      } else if (log.channel === NotificationChannel.SMS) {
        if (!borrower.phone) {
          await this.repo.updateNotificationStatus(
            log.id,
            NotificationStatus.FAILED,
            'Borrower phone number not found'
          );
          failedCount++;
          continue;
        }
        if (!smsGroupMap.has(borrower.phone)) {
          smsGroupMap.set(borrower.phone, []);
        }
        smsGroupMap.get(borrower.phone)!.push(log);
      }
    }

    // Process EMAIL dispatch (1 physical send per recipient email)
    for (const [email, logs] of emailGroupMap.entries()) {
      if (settings.emailEnabled) {
        const primaryLog = logs[0];
        try {
          await sendEmail('EMAIL', email, {
            message: primaryLog.message || '',
          });

          // Mark all linked logs as SENT
          for (const l of logs) {
            await this.repo.updateNotificationStatus(l.id, NotificationStatus.SENT);
          }
          sentCount++;
        } catch (err: any) {
          for (const l of logs) {
            await this.repo.updateNotificationStatus(
              l.id,
              NotificationStatus.FAILED,
              err.message || 'Unknown notification error'
            );
          }
          failedCount++;
        }
      } else {
        for (const l of logs) {
          await this.repo.updateNotificationStatus(
            l.id,
            NotificationStatus.FAILED,
            'Email notifications are globally disabled in settings'
          );
        }
        failedCount++;
      }
    }

    // Process SMS dispatch (1 physical send per recipient phone)
    for (const [phone, logs] of smsGroupMap.entries()) {
      if (settings.smsEnabled) {
        const primaryLog = logs[0];
        try {
          await sendEmail('SMS', phone, {
            message: primaryLog.message || '',
          });

          for (const l of logs) {
            await this.repo.updateNotificationStatus(l.id, NotificationStatus.SENT);
          }
          sentCount++;
        } catch (err: any) {
          for (const l of logs) {
            await this.repo.updateNotificationStatus(
              l.id,
              NotificationStatus.FAILED,
              err.message || 'Unknown SMS notification error'
            );
          }
          failedCount++;
        }
      } else {
        for (const l of logs) {
          await this.repo.updateNotificationStatus(
            l.id,
            NotificationStatus.FAILED,
            'SMS notifications are globally disabled in settings'
          );
        }
        failedCount++;
      }
    }

    return { sentCount, failedCount };
  }
}

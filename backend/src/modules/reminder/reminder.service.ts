import { ReminderRepository } from './reminder.repository';
import { ReminderType, NotificationChannel, NotificationStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import { SettingsService } from '../settings/settings.service';
import { sendEmail } from '../../lib/notify';


const settingsService = new SettingsService();

export class ReminderService {
  private repo: ReminderRepository;

  constructor() {
    this.repo = new ReminderRepository();
  }

  async runReminderEngine() {
    // 1. Fetch system settings
    const settings = await settingsService.getSettings();

    const unpaidSchedules = await this.repo.getUnpaidSchedules();
    const nowKigali = DateTime.now().setZone('Africa/Kigali');
    const todayKigali = nowKigali.startOf('day');

    let totalChecked = 0;
    let sentCount = 0;
    let failedCount = 0;

    for (const schedule of unpaidSchedules) {
      totalChecked++;
      const borrower = schedule.loan.borrower;
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
        // Implement Grace Period logic:
        // Installment only becomes OVERDUE if overdue days exceed grace period
        const gracePassed = Math.abs(diffDays) > schedule.loan.gracePeriodDays;
        if (gracePassed) {
          reminderType = ReminderType.OVERDUE;
        }
      }

      if (!reminderType) continue;

      // 1. Process EMAIL
      const alreadySentEmail = await this.repo.hasReminderBeenSent({
        repaymentScheduleId: schedule.id,
        reminderType,
        channel: NotificationChannel.EMAIL,
      });

      if (!alreadySentEmail) {
        const amountRemaining = Math.round((schedule.amountDue - schedule.amountPaid) * 100) / 100;
        const formattedDueDate = dueKigali.toFormat('dd LLL yyyy');
        let emailBody = '';

        if (reminderType === ReminderType.OVERDUE) {
          emailBody = `
<div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #f4f6f9; padding: 30px 20px; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.06); border: 1px solid #e1e4e8;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #e74c3c, #c0392b); padding: 30px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">⚠️ OVERDUE PAYMENT NOTICE</h1>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px; line-height: 1.6;">
      <p style="margin: 0 0 15px 0; font-size: 16px; color: #2c3e50;">Dear <strong>${borrower.fullName}</strong>,</p>
      <p style="margin: 0 0 20px 0; font-size: 15px; color: #555;">This is an urgent notification that your loan installment is currently <strong>OVERDUE</strong>. Please review the details below and arrange for payment immediately to avoid penalties or default status.</p>
      
      <!-- Details Card -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; background-color: #fdfefe; border: 1px solid #eaeded; border-radius: 6px;">
        <tr style="border-bottom: 1px solid #f2f4f4;">
          <td style="padding: 12px 15px; font-size: 14px; color: #7f8c8d; font-weight: 600;">Loan Number</td>
          <td style="padding: 12px 15px; font-size: 14px; color: #2c3e50; text-align: right; font-weight: 700;">${schedule.loan.loanNumber}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f2f4f4;">
          <td style="padding: 12px 15px; font-size: 14px; color: #7f8c8d; font-weight: 600;">Installment No.</td>
          <td style="padding: 12px 15px; font-size: 14px; color: #2c3e50; text-align: right;">${schedule.installmentNumber}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f2f4f4;">
          <td style="padding: 12px 15px; font-size: 14px; color: #7f8c8d; font-weight: 600;">Original Due Date</td>
          <td style="padding: 12px 15px; font-size: 14px; color: #2c3e50; text-align: right;">${formattedDueDate}</td>
        </tr>
        <tr>
          <td style="padding: 15px; font-size: 15px; color: #c0392b; font-weight: bold;">Amount Outstanding</td>
          <td style="padding: 15px; font-size: 18px; color: #c0392b; text-align: right; font-weight: 800;">RWF ${amountRemaining.toLocaleString()}</td>
        </tr>
      </table>

      <!-- Callout Banner -->
      <div style="background-color: #fdf2f2; border-left: 4px solid #ec7063; padding: 15px; border-radius: 4px; margin-bottom: 25px;">
        <p style="margin: 0; font-size: 14px; color: #c0392b; font-weight: 500;">
          Please settle this outstanding balance immediately. If you have already made this payment, please contact your loan officer or provide a payment receipt.
        </p>
      </div>

      <p style="margin: 0 0 5px 0; font-size: 15px; color: #333;">Thank you for your prompt attention to this matter.</p>
      <p style="margin: 0; font-size: 15px; color: #7f8c8d;">Sincerely,<br/><strong style="color: #2c3e50;">Lending Team</strong></p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eeeeee; font-size: 12px; color: #95a5a6;">
      <p style="margin: 0 0 5px 0;">This is an automated system notification. Please do not reply directly to this email.</p>
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} MFI Loan Alert System. All rights reserved.</p>
    </div>
  </div>
</div>
`;
        } else {
          const daysText = diffDays === 1 ? 'tomorrow' : `in ${diffDays} days`;
          emailBody = `
<div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #f4f6f9; padding: 30px 20px; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.06); border: 1px solid #e1e4e8;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #3498db, #2980b9); padding: 30px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">📅 UPCOMING PAYMENT REMINDER</h1>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px; line-height: 1.6;">
      <p style="margin: 0 0 15px 0; font-size: 16px; color: #2c3e50;">Dear <strong>${borrower.fullName}</strong>,</p>
      <p style="margin: 0 0 20px 0; font-size: 15px; color: #555;">This is a friendly reminder that you have an upcoming loan repayment scheduled <strong>${daysText}</strong>. Please find the details of the installment below:</p>
      
      <!-- Details Card -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; background-color: #fdfefe; border: 1px solid #eaeded; border-radius: 6px;">
        <tr style="border-bottom: 1px solid #f2f4f4;">
          <td style="padding: 12px 15px; font-size: 14px; color: #7f8c8d; font-weight: 600;">Loan Number</td>
          <td style="padding: 12px 15px; font-size: 14px; color: #2c3e50; text-align: right; font-weight: 700;">${schedule.loan.loanNumber}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f2f4f4;">
          <td style="padding: 12px 15px; font-size: 14px; color: #7f8c8d; font-weight: 600;">Installment No.</td>
          <td style="padding: 12px 15px; font-size: 14px; color: #2c3e50; text-align: right;">${schedule.installmentNumber}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f2f4f4;">
          <td style="padding: 12px 15px; font-size: 14px; color: #7f8c8d; font-weight: 600;">Due Date</td>
          <td style="padding: 12px 15px; font-size: 14px; color: #2c3e50; text-align: right;">${formattedDueDate}</td>
        </tr>
        <tr>
          <td style="padding: 15px; font-size: 15px; color: #2980b9; font-weight: bold;">Amount Due</td>
          <td style="padding: 15px; font-size: 18px; color: #2980b9; text-align: right; font-weight: 800;">RWF ${amountRemaining.toLocaleString()}</td>
        </tr>
      </table>

      <!-- Callout Banner -->
      <div style="background-color: #ebf5fb; border-left: 4px solid #5dade2; padding: 15px; border-radius: 4px; margin-bottom: 25px;">
        <p style="margin: 0; font-size: 14px; color: #2980b9; font-weight: 500;">
          Please ensure that you have sufficient funds to cover this installment by the due date. Thank you for your cooperation.
        </p>
      </div>

      <p style="margin: 0 0 5px 0; font-size: 15px; color: #333;">If you have any questions, please contact your loan officer.</p>
      <p style="margin: 0; font-size: 15px; color: #7f8c8d;">Best regards,<br/><strong style="color: #2c3e50;">Lending Team</strong></p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eeeeee; font-size: 12px; color: #95a5a6;">
      <p style="margin: 0 0 5px 0;">This is an automated system notification. Please do not reply directly to this email.</p>
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} MFI Loan Alert System. All rights reserved.</p>
    </div>
  </div>
</div>
`;
        }

        await this.repo.createPendingNotification({
          repaymentScheduleId: schedule.id,
          reminderType,
          channel: NotificationChannel.EMAIL,
          message: emailBody,
        });
      }

      // 2. Process SMS
      const alreadySentSMS = await this.repo.hasReminderBeenSent({
        repaymentScheduleId: schedule.id,
        reminderType,
        channel: NotificationChannel.SMS,
      });

      if (!alreadySentSMS) {
        const amountRemaining = Math.round((schedule.amountDue - schedule.amountPaid) * 100) / 100;
        const formattedDueDate = dueKigali.toFormat('dd LLL yyyy');
        let smsBody = '';

        if (reminderType === ReminderType.OVERDUE) {
          smsBody = `Urgent: Your installment of RWF ${amountRemaining.toLocaleString()} for Loan ${schedule.loan.loanNumber} is OVERDUE. Please pay immediately. - MFI Team`;
        } else {
          const daysText = diffDays === 1 ? 'tomorrow' : `in ${diffDays} days`;
          smsBody = `Reminder: Your installment of RWF ${amountRemaining.toLocaleString()} for Loan ${schedule.loan.loanNumber} is due ${daysText} (${formattedDueDate}). - MFI Team`;
        }

        await this.repo.createPendingNotification({
          repaymentScheduleId: schedule.id,
          reminderType,
          channel: NotificationChannel.SMS,
          message: smsBody,
        });
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

        if (settings.emailEnabled) {
          try {
            await sendEmail('EMAIL', borrower.email, {
              message: log.message || '',
            });
            await this.repo.updateNotificationStatus(log.id, NotificationStatus.SENT);
            sentCount++;
          } catch (err: any) {
            await this.repo.updateNotificationStatus(
              log.id,
              NotificationStatus.FAILED,
              err.message || 'Unknown notification error'
            );
            failedCount++;
          }
        } else {
          await this.repo.updateNotificationStatus(
            log.id,
            NotificationStatus.FAILED,
            'Email notifications are globally disabled in settings'
          );
          failedCount++;
        }
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

        if (settings.smsEnabled) {
          try {
            await sendEmail('SMS', borrower.phone, {
              message: log.message || '',
            });
            await this.repo.updateNotificationStatus(log.id, NotificationStatus.SENT);
            sentCount++;
          } catch (err: any) {
            await this.repo.updateNotificationStatus(
              log.id,
              NotificationStatus.FAILED,
              err.message || 'Unknown SMS notification error'
            );
            failedCount++;
          }
        } else {
          await this.repo.updateNotificationStatus(
            log.id,
            NotificationStatus.FAILED,
            'SMS notifications are globally disabled in settings'
          );
          failedCount++;
        }
      }
    }

    return { sentCount, failedCount };
  }
}

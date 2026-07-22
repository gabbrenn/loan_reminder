import cron from 'node-cron';
import { ReminderService } from './reminder.service';

const service = new ReminderService();

export function initReminderCron() {
  // Cron expression: 0 7 * * * (runs at 07:00 daily)
  cron.schedule(
    '0 7 * * *',
    async () => {
      console.log('[CRON] Starting Daily Reminder Engine job...');
      try {
        const summary = await service.runReminderEngine();
        console.log('[CRON] Daily Reminder Engine job completed:', summary);
      } catch (err) {
        console.error('[CRON] Daily Reminder Engine job failed:', err);
      }
    },
    {
      timezone: 'Africa/Kigali',
    } as any
  );
  console.log('[CRON] Daily Reminder scheduler initialized (runs at 07:00 Africa/Kigali)');
}

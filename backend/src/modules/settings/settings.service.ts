import { SettingsRepository } from './settings.repository';

export class SettingsService {
  private repo: SettingsRepository;

  constructor() {
    this.repo = new SettingsRepository();
  }

  async getSettings() {
    return this.repo.get();
  }

  async updateSettings(data: {
    reminderDaysBefore1?: number;
    reminderDaysBefore2?: number;
    reminderDaysBefore3?: number;
    smsEnabled?: boolean;
    emailEnabled?: boolean;
  }) {
    const { reminderDaysBefore1, reminderDaysBefore2, reminderDaysBefore3 } = data;

    // Validate: all provided days must be positive integers
    for (const [key, val] of Object.entries({ reminderDaysBefore1, reminderDaysBefore2, reminderDaysBefore3 })) {
      if (val !== undefined) {
        if (!Number.isInteger(val) || val < 1) {
          throw new Error(`${key} must be a positive integer`);
        }
      }
    }

    // Validate: the three reminder windows must be distinct
    const days = [reminderDaysBefore1, reminderDaysBefore2, reminderDaysBefore3].filter(
      (d) => d !== undefined,
    ) as number[];
    if (new Set(days).size !== days.length) {
      throw new Error('Reminder day windows must all be distinct values');
    }

    return this.repo.update(data);
  }
}

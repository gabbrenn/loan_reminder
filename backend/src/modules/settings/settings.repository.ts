import prisma from '../../lib/prisma';

export class SettingsRepository {
  /** Returns the single system settings row, creating defaults if none exists. */
  async get() {
    const existing = await prisma.systemSetting.findFirst();
    if (existing) return existing;
    return prisma.systemSetting.create({ data: {} });
  }

  async update(data: {
    reminderDaysBefore1?: number;
    reminderDaysBefore2?: number;
    reminderDaysBefore3?: number;
    smsEnabled?: boolean;
    emailEnabled?: boolean;
  }) {
    const settings = await this.get();
    return prisma.systemSetting.update({
      where: { id: settings.id },
      data,
    });
  }
}

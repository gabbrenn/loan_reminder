import { NotificationLogRepository } from './notification.repository';

export class NotificationLogService {
  private repo: NotificationLogRepository;

  constructor() {
    this.repo = new NotificationLogRepository();
  }

  async listNotifications(filters?: { channel?: string; status?: string }) {
    return this.repo.findAll(filters);
  }

  async getNotification(id: string) {
    const log = await this.repo.findById(id);
    if (!log) throw new Error('Notification log not found');
    return log;
  }
}

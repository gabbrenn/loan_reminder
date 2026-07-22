import { AuditRepository } from './audit.repository';

export class AuditService {
  private repo: AuditRepository;

  constructor() {
    this.repo = new AuditRepository();
  }

  async log(userId: string, action: string, entity: string, entityId: string) {
    return this.repo.log({ userId, action, entity, entityId });
  }

  async listLogs(filters?: { userId?: string; entity?: string; action?: string }) {
    return this.repo.findAll(filters);
  }

  async getLog(id: string) {
    const log = await this.repo.findById(id);
    if (!log) throw new Error('Audit log entry not found');
    return log;
  }
}

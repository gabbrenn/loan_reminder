import { BorrowerRepository, CreateBorrowerInput, UpdateBorrowerInput } from './borrower.repository';
import { AuditService } from '../audit/audit.service';

const auditService = new AuditService();

export class BorrowerService {
  private repo: BorrowerRepository;

  constructor() {
    this.repo = new BorrowerRepository();
  }

  async createBorrower(data: CreateBorrowerInput, actorId?: string) {
    // Uniqueness checks
    const [byNationalId, byPhone, byEmail] = await Promise.all([
      this.repo.findByNationalId(data.nationalId),
      this.repo.findByPhone(data.phone),
      this.repo.findByEmail(data.email),
    ]);

    if (byNationalId) throw new Error('A borrower with this National ID already exists');
    if (byPhone) throw new Error('A borrower with this phone number already exists');
    if (byEmail) throw new Error('A borrower with this email already exists');

    const borrower = await this.repo.create(data);
    if (actorId) {
      await auditService.log(actorId, 'CREATE', 'BORROWER', borrower.id).catch(() => {});
    }
    return borrower;
  }

  private calculateRiskScore(borrower: any): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (!borrower.loans || borrower.loans.length === 0) {
      return 'LOW';
    }

    let overdueInstallmentsCount = 0;
    let hasDefaulted = false;

    borrower.loans.forEach((loan: any) => {
      if (loan.status === 'DEFAULTED') {
        hasDefaulted = true;
      }

      const unpaidSchedules = loan.repaymentSchedules.filter((s: any) => s.amountPaid < s.amountDue);
      const now = new Date();

      unpaidSchedules.forEach((s: any) => {
        if (new Date(s.dueDate) < now) {
          overdueInstallmentsCount++;
        }
      });
    });

    if (hasDefaulted || overdueInstallmentsCount >= 3) return 'HIGH';
    if (overdueInstallmentsCount > 0) return 'MEDIUM';
    return 'LOW';
  }

  async getBorrower(id: string) {
    const borrower = await this.repo.findById(id);
    if (!borrower) throw new Error('Borrower not found');
    return { ...borrower, riskScore: this.calculateRiskScore(borrower) };
  }

  async listBorrowers(search?: string) {
    const borrowers = await this.repo.findAll(search);
    return borrowers.map((b) => ({ ...b, riskScore: this.calculateRiskScore(b) }));
  }

  async updateBorrower(id: string, data: UpdateBorrowerInput, actorId?: string) {
    const borrower = await this.repo.findById(id);
    if (!borrower) throw new Error('Borrower not found');

    if (data.phone && data.phone !== borrower.phone) {
      const existing = await this.repo.findByPhone(data.phone);
      if (existing) throw new Error('A borrower with this phone number already exists');
    }
    if (data.email && data.email !== borrower.email) {
      const existing = await this.repo.findByEmail(data.email);
      if (existing) throw new Error('A borrower with this email already exists');
    }

    const updated = await this.repo.update(id, data);
    if (actorId) {
      await auditService.log(actorId, 'UPDATE', 'BORROWER', id).catch(() => {});
    }
    return updated;
  }

  async deleteBorrower(id: string, actorId?: string) {
    const borrower = await this.repo.findById(id);
    if (!borrower) throw new Error('Borrower not found');
    await this.repo.delete(id);
    if (actorId) {
      await auditService.log(actorId, 'DELETE', 'BORROWER', id).catch(() => {});
    }
  }
}

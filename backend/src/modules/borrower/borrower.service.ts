import { BorrowerRepository, CreateBorrowerInput, UpdateBorrowerInput } from './borrower.repository';
import { AuditService } from '../audit/audit.service';
import bcrypt from 'bcrypt';

import { AuthService } from '../auth/auth.service';
import prisma from '../../lib/prisma';

const auditService = new AuditService();
const authService = new AuthService();

export class BorrowerService {
  private repo: BorrowerRepository;

  constructor() {
    this.repo = new BorrowerRepository();
  }

  async createBorrower(data: CreateBorrowerInput, actorId?: string) {
    const emailLower = data.email.trim().toLowerCase();
    // Uniqueness checks (including cross-table check against User table for email)
    const [byNationalId, byPhone, byEmail, byUserEmail] = await Promise.all([
      this.repo.findByNationalId(data.nationalId),
      this.repo.findByPhone(data.phone),
      prisma.borrower.findFirst({ where: { email: { equals: emailLower, mode: 'insensitive' } } }),
      prisma.user.findFirst({ where: { email: { equals: emailLower, mode: 'insensitive' } } }),
    ]);

    if (byNationalId) throw new Error('A borrower with this National ID already exists');
    if (byPhone) throw new Error('A borrower with this phone number already exists');
    if (byEmail || byUserEmail) throw new Error('A user or borrower with this email address already exists');

    // Default password hash for new borrowers
    const defaultPassword = 'Borrower123!';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const borrower = await this.repo.create({
      ...data,
      passwordHash,
    });

    if (actorId) {
      await auditService.log(actorId, 'CREATE', 'BORROWER', borrower.id).catch(() => {});
    }

    // Send account registration email with link to reset/set password
    try {
      await authService.sendBorrowerWelcomeEmail(borrower.id, defaultPassword);
    } catch (err) {
      // Best-effort email notification
      console.error('Failed to send borrower welcome email:', err);
    }

    return borrower;
  }

  async importBorrowers(records: CreateBorrowerInput[], actorId?: string) {
    const results = {
      successCount: 0,
      failureCount: 0,
      errors: [] as Array<{ row: number; name: string; email: string; error: string }>,
      created: [] as any[],
    };

    const seenNationalIds = new Set<string>();
    const seenPhones = new Set<string>();
    const seenEmails = new Set<string>();

    const defaultPassword = 'Borrower123!';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNum = i + 1;

      // Basic field presence check
      if (
        !record.fullName ||
        !record.nationalId ||
        !record.phone ||
        !record.email ||
        !record.address ||
        !record.occupation ||
        !record.guarantorName ||
        !record.guarantorPhone
      ) {
        results.failureCount++;
        results.errors.push({
          row: rowNum,
          name: record.fullName || 'Unknown',
          email: record.email || 'N/A',
          error: 'Missing required borrower fields',
        });
        continue;
      }

      const nationalId = String(record.nationalId).trim();
      const phone = String(record.phone).trim();
      const email = String(record.email).trim().toLowerCase();

      // Check duplicates within batch
      if (seenNationalIds.has(nationalId)) {
        results.failureCount++;
        results.errors.push({
          row: rowNum,
          name: record.fullName,
          email,
          error: `Duplicate National ID '${nationalId}' in import file`,
        });
        continue;
      }
      if (seenPhones.has(phone)) {
        results.failureCount++;
        results.errors.push({
          row: rowNum,
          name: record.fullName,
          email,
          error: `Duplicate phone number '${phone}' in import file`,
        });
        continue;
      }
      if (seenEmails.has(email)) {
        results.failureCount++;
        results.errors.push({
          row: rowNum,
          name: record.fullName,
          email,
          error: `Duplicate email '${email}' in import file`,
        });
        continue;
      }

      // Check database uniqueness across Borrower and User tables
      const [byNatId, byPh, byEm, byUsrEm] = await Promise.all([
        this.repo.findByNationalId(nationalId),
        this.repo.findByPhone(phone),
        prisma.borrower.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } }),
        prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } }),
      ]);

      if (byNatId) {
        results.failureCount++;
        results.errors.push({
          row: rowNum,
          name: record.fullName,
          email,
          error: `National ID '${nationalId}' already exists in system`,
        });
        continue;
      }
      if (byPh) {
        results.failureCount++;
        results.errors.push({
          row: rowNum,
          name: record.fullName,
          email,
          error: `Phone number '${phone}' already exists in system`,
        });
        continue;
      }
      if (byEm || byUsrEm) {
        results.failureCount++;
        results.errors.push({
          row: rowNum,
          name: record.fullName,
          email,
          error: `Email '${email}' already exists in user or borrower system`,
        });
        continue;
      }

      // Track seen in batch
      seenNationalIds.add(nationalId);
      seenPhones.add(phone);
      seenEmails.add(email);

      try {
        const borrower = await this.repo.create({
          fullName: record.fullName.trim(),
          nationalId,
          phone,
          email,
          address: record.address.trim(),
          occupation: record.occupation.trim(),
          guarantorName: record.guarantorName.trim(),
          guarantorPhone: String(record.guarantorPhone).trim(),
          photo: record.photo ? String(record.photo).trim() : undefined,
          passwordHash,
        });

        if (actorId) {
          await auditService.log(actorId, 'CREATE', 'BORROWER', borrower.id).catch(() => {});
        }

        authService.sendBorrowerWelcomeEmail(borrower.id, defaultPassword).catch(() => {});

        results.successCount++;
        results.created.push(borrower);
      } catch (err: any) {
        results.failureCount++;
        results.errors.push({
          row: rowNum,
          name: record.fullName,
          email,
          error: err.message || 'Database error during borrower creation',
        });
      }
    }

    return results;
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
      const emailLower = data.email.trim().toLowerCase();
      const [existingBorrower, existingUser] = await Promise.all([
        prisma.borrower.findFirst({ where: { email: { equals: emailLower, mode: 'insensitive' } } }),
        prisma.user.findFirst({ where: { email: { equals: emailLower, mode: 'insensitive' } } }),
      ]);
      if (existingBorrower || existingUser) throw new Error('A user or borrower with this email address already exists');
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

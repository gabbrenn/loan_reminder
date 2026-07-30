import prisma from '../../lib/prisma';

export class AuthRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findBorrowerByEmail(email: string) {
    return prisma.borrower.findUnique({
      where: { email },
    });
  }

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async findBorrowerById(id: string) {
    return prisma.borrower.findUnique({
      where: { id },
    });
  }

  async updatePassword(id: string, passwordHash: string) {
    return prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  async updateBorrowerPassword(id: string, passwordHash: string) {
    return prisma.borrower.update({
      where: { id },
      data: { passwordHash },
    });
  }


  async updateProfile(id: string, data: { email?: string; name?: string }) {
    return prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
  }

  // ─── Password Reset ───────────────────────────────────────────────────────

  async createResetToken(id: string, isBorrower: boolean, token: string, expiresAt: Date) {
    return prisma.passwordResetToken.create({
      data: isBorrower
        ? { borrowerId: id, token, expiresAt }
        : { userId: id, token, expiresAt },
    });
  }

  async findResetToken(token: string) {
    return prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true, borrower: true },
    });
  }

  async markResetTokenUsed(id: string) {
    return prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  /** Invalidate any existing unused tokens for a user/borrower before issuing a new one */
  async invalidateUserResetTokens(id: string, isBorrower: boolean) {
    return prisma.passwordResetToken.updateMany({
      where: isBorrower
        ? { borrowerId: id, usedAt: null }
        : { userId: id, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}


import { AuthRepository } from './auth.repository';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sendEmail } from '../../lib/notify';
import { emailTemplates } from '../../lib/emailTemplates';
import { africastalking } from '../../lib/africastalking';
import prisma from '../../lib/prisma';

const RESET_TOKEN_EXPIRY_MINUTES = 30;
const RESET_TEMPLATE_ID = process.env.RESET_PASSWORD_TEMPLATE || process.env.REMINDER_TEMPLATE || '';
const APP_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export class AuthService {
  private authRepository: AuthRepository;

  constructor() {
    this.authRepository = new AuthRepository();
  }

  async login(identifier: string, passwordPlain: string) {
    const user = await this.authRepository.findByIdentifier(identifier);
    if (user) {
      const isMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
      if (!isMatch) {
        throw new Error('Invalid email, phone, or password');
      }
      const { passwordHash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }

    // Check borrower table if user not found in users table
    const borrower = await this.authRepository.findBorrowerByIdentifier(identifier);
    if (!borrower || !borrower.passwordHash) {
      throw new Error('Invalid email, phone, or password');
    }

    const isMatch = await bcrypt.compare(passwordPlain, borrower.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid email, phone, or password');
    }

    return {
      id: borrower.id,
      email: borrower.email,
      name: borrower.fullName,
      role: 'BORROWER' as const,
      createdAt: borrower.createdAt,
    };
  }

  async changePassword(userId: string, oldPasswordPlain: string, newPasswordPlain: string) {
    const user = await this.authRepository.findById(userId);
    if (user) {
      const isMatch = await bcrypt.compare(oldPasswordPlain, user.passwordHash);
      if (!isMatch) {
        throw new Error('Invalid current password');
      }
      if (newPasswordPlain.length < 6) {
        throw new Error('New password must be at least 6 characters long');
      }
      const newPasswordHash = await bcrypt.hash(newPasswordPlain, 10);
      await this.authRepository.updatePassword(userId, newPasswordHash);
      return true;
    }

    const borrower = await this.authRepository.findBorrowerById(userId);
    if (!borrower || !borrower.passwordHash) {
      throw new Error('User not found');
    }

    const isMatch = await bcrypt.compare(oldPasswordPlain, borrower.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid current password');
    }
    if (newPasswordPlain.length < 6) {
      throw new Error('New password must be at least 6 characters long');
    }

    const newPasswordHash = await bcrypt.hash(newPasswordPlain, 10);
    await this.authRepository.updateBorrowerPassword(userId, newPasswordHash);
    return true;
  }

  async updateProfile(userId: string, data: { email?: string; name?: string; phone?: string | null }) {
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (data.email && data.email !== user.email) {
      const [existingUser, existingBorrower] = await Promise.all([
        this.authRepository.findByEmail(data.email),
        this.authRepository.findBorrowerByEmail(data.email),
      ]);
      if (existingUser || existingBorrower) {
        throw new Error('A user or borrower with this email address already exists');
      }
    }

    if (data.phone !== undefined && data.phone !== null && data.phone !== user.phone) {
      const cleanPhone = data.phone.trim();
      if (cleanPhone) {
        const [existingUserPhone, existingBorrowerPhone] = await Promise.all([
          prisma.user.findFirst({ where: { phone: cleanPhone, id: { not: userId } } }),
          prisma.borrower.findFirst({ where: { phone: cleanPhone } }),
        ]);
        if (existingUserPhone || existingBorrowerPhone) {
          throw new Error('This phone number is already registered to another account');
        }
      }
    }

    return this.authRepository.updateProfile(userId, {
      ...data,
      phone: data.phone !== undefined ? (data.phone ? data.phone.trim() : null) : undefined,
    });
  }

  // ─── Forgot Password ──────────────────────────────────────────────────────

  async forgotPassword(identifier: string) {
    const user = await this.authRepository.findByIdentifier(identifier);
    let targetUserId = user?.id;
    let targetName = user?.name;
    let targetEmail = user?.email;
    let targetPhone = (user as any)?.phone ?? null;
    let isBorrower = false;

    if (!user) {
      const borrower = await this.authRepository.findBorrowerByIdentifier(identifier);
      if (borrower) {
        targetUserId = borrower.id;
        targetName = borrower.fullName;
        targetEmail = borrower.email;
        targetPhone = borrower.phone ?? null;
        isBorrower = true;
      }
    }

    // Always respond with success even if user/borrower not found — prevents enumeration
    if (!targetUserId || !targetName || (!targetEmail && !targetPhone)) return;

    // Invalidate any previous unused tokens
    await this.authRepository.invalidateUserResetTokens(targetUserId, isBorrower);

    // Generate a secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await this.authRepository.createResetToken(targetUserId, isBorrower, rawToken, expiresAt);

    const resetLink = `${APP_URL}/reset-password?token=${rawToken}`;

    // Send email via notify SDK using modern HTML template (non-blocking)
    if (targetEmail) {
      try {
        await sendEmail('EMAIL', targetEmail, {
          message: emailTemplates.forgotPassword({
            name: targetName,
            resetLink,
            expiresInMinutes: RESET_TOKEN_EXPIRY_MINUTES,
          }),
        });
      } catch (emailErr) {
        console.error('[Auth] Forgot-password email dispatch failed:', emailErr);
      }
    }

    // Also send SMS if the target has a phone number (short, single-credit format)
    if (targetPhone) {
      try {
        const firstName = targetName.split(' ')[0] || targetName;
        await africastalking.sendSMS({
          to: targetPhone,
          message: `Hi ${firstName}, reset your password: ${resetLink} (valid ${RESET_TOKEN_EXPIRY_MINUTES}m)`,
        });
      } catch (smsErr) {
        console.error('[Auth] Forgot-password SMS dispatch failed:', smsErr);
      }
    }
  }

  // ─── Welcome Emails for New Accounts ──────────────────────────────────────

  async sendUserWelcomeEmail(userId: string, role: string, temporaryPassword?: string) {
    const user = await this.authRepository.findById(userId);
    if (!user) return;

    await this.authRepository.invalidateUserResetTokens(userId, false);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await this.authRepository.createResetToken(userId, false, rawToken, expiresAt);
    const resetLink = `${APP_URL}/reset-password?token=${rawToken}`;

    if (user.email) {
      try {
        await sendEmail('EMAIL', user.email, {
          message: emailTemplates.userWelcome({
            name: user.name,
            email: user.email,
            role,
            resetLink,
            temporaryPassword,
            expiresInMinutes: RESET_TOKEN_EXPIRY_MINUTES,
          }),
        });
      } catch (emailErr) {
        console.error('[Auth] User welcome email dispatch failed:', emailErr);
      }
    }

    // Short SMS welcome (single-credit format)
    if ((user as any).phone) {
      try {
        const firstName = user.name.split(' ')[0] || user.name;
        await africastalking.sendSMS({
          to: (user as any).phone,
          message: `Welcome ${firstName}! (${role}) Temp pass: ${temporaryPassword}. Login: ${APP_URL}`,
        });
      } catch (smsErr) {
        console.error('[Auth] User welcome SMS dispatch failed:', smsErr);
      }
    }
  }

  async sendBorrowerWelcomeEmail(borrowerId: string, temporaryPassword: string = 'Borrower123!') {
    const borrower = await this.authRepository.findBorrowerById(borrowerId);
    if (!borrower) return;

    await this.authRepository.invalidateUserResetTokens(borrowerId, true);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await this.authRepository.createResetToken(borrowerId, true, rawToken, expiresAt);
    const resetLink = `${APP_URL}/reset-password?token=${rawToken}`;

    if (borrower.email) {
      try {
        await sendEmail('EMAIL', borrower.email, {
          message: emailTemplates.borrowerWelcome({
            name: borrower.fullName,
            email: borrower.email,
            role: 'BORROWER',
            resetLink,
            temporaryPassword,
            expiresInMinutes: RESET_TOKEN_EXPIRY_MINUTES,
          }),
        });
      } catch (emailErr) {
        console.error('[Auth] Borrower welcome email dispatch failed:', emailErr);
      }
    }

    // Short SMS welcome (single-credit format)
    if (borrower.phone) {
      try {
        const firstName = borrower.fullName.split(' ')[0] || borrower.fullName;
        await africastalking.sendSMS({
          to: borrower.phone,
          message: `Welcome ${firstName}! Temp pass: ${temporaryPassword}. Login: ${APP_URL}`,
        });
      } catch (smsErr) {
        console.error('[Auth] Borrower welcome SMS dispatch failed:', smsErr);
      }
    }
  }

  // ─── Reset Password ───────────────────────────────────────────────────────

  async resetPassword(token: string, newPasswordPlain: string) {
    if (newPasswordPlain.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    const record = await this.authRepository.findResetToken(token);

    if (!record) {
      throw new Error('Invalid or expired reset link. Please request a new one.');
    }

    if (record.usedAt) {
      throw new Error('This reset link has already been used. Please request a new one.');
    }

    if (new Date() > record.expiresAt) {
      throw new Error('This reset link has expired. Please request a new one.');
    }

    const newPasswordHash = await bcrypt.hash(newPasswordPlain, 10);
    if (record.userId) {
      await this.authRepository.updatePassword(record.userId, newPasswordHash);
    } else if (record.borrowerId) {
      await this.authRepository.updateBorrowerPassword(record.borrowerId, newPasswordHash);
    }
    await this.authRepository.markResetTokenUsed(record.id);

    return true;
  }
}



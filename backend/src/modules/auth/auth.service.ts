import { AuthRepository } from './auth.repository';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sendEmail } from '../../lib/notify';

const RESET_TOKEN_EXPIRY_MINUTES = 30;
const RESET_TEMPLATE_ID = process.env.RESET_PASSWORD_TEMPLATE || process.env.REMINDER_TEMPLATE || '';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

export class AuthService {
  private authRepository: AuthRepository;

  constructor() {
    this.authRepository = new AuthRepository();
  }

  async login(email: string, passwordPlain: string) {
    const user = await this.authRepository.findByEmail(email);
    if (user) {
      const isMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
      if (!isMatch) {
        throw new Error('Invalid email or password');
      }
      const { passwordHash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }

    // Check borrower table if user not found in users table
    const borrower = await this.authRepository.findBorrowerByEmail(email);
    if (!borrower || !borrower.passwordHash) {
      throw new Error('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(passwordPlain, borrower.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid email or password');
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

  async updateProfile(userId: string, data: { email?: string; name?: string }) {
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (data.email && data.email !== user.email) {
      const existing = await this.authRepository.findByEmail(data.email);
      if (existing) {
        throw new Error('A user with this email address already exists');
      }
    }

    return this.authRepository.updateProfile(userId, data);
  }

  // ─── Forgot Password ──────────────────────────────────────────────────────

  async forgotPassword(email: string) {
    const user = await this.authRepository.findByEmail(email);
    let targetUserId = user?.id;
    let targetName = user?.name;
    let targetEmail = user?.email;
    let isBorrower = false;

    if (!user) {
      const borrower = await this.authRepository.findBorrowerByEmail(email);
      if (borrower) {
        targetUserId = borrower.id;
        targetName = borrower.fullName;
        targetEmail = borrower.email;
        isBorrower = true;
      }
    }

    // Always respond with success even if user/borrower not found — prevents email enumeration
    if (!targetUserId || !targetEmail || !targetName) return;

    // Invalidate any previous unused tokens
    await this.authRepository.invalidateUserResetTokens(targetUserId, isBorrower);

    // Generate a secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await this.authRepository.createResetToken(targetUserId, isBorrower, rawToken, expiresAt);

    const resetLink = `${APP_URL}/reset-password?token=${rawToken}`;

    // Send email via notify SDK
    await sendEmail('EMAIL', targetEmail, {

      message: `
        <p>Hello <strong>${targetName}</strong>,</p>
        <p>You requested to reset your password. Click the button below to set a new password. This link is valid for <strong>${RESET_TOKEN_EXPIRY_MINUTES} minutes</strong>.</p>
        <p style="text-align:center;margin:32px 0;">
          <a href="${resetLink}" style="background:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">Reset Password</a>
        </p>
        <p>If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.</p>
        <p style="color:#94a3b8;font-size:12px;">This link expires in ${RESET_TOKEN_EXPIRY_MINUTES} minutes.</p>
      `,
    });
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



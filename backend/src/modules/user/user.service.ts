import bcrypt from 'bcrypt';
import { UserRepository } from './user.repository';
import { Role } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import prisma from '../../lib/prisma';

const authService = new AuthService();

export class UserService {
  private repo: UserRepository;

  constructor() {
    this.repo = new UserRepository();
  }

  async listUsers() {
    return this.repo.findAll();
  }

  async createUser(data: {
    email: string;
    name: string;
    phone?: string;
    password: string;
    role: Role;
  }) {
    const emailLower = data.email.trim().toLowerCase();
    const [existingUser, existingBorrower] = await Promise.all([
      prisma.user.findFirst({ where: { email: { equals: emailLower, mode: 'insensitive' } } }),
      prisma.borrower.findFirst({ where: { email: { equals: emailLower, mode: 'insensitive' } } }),
    ]);

    if (existingUser || existingBorrower) {
      throw new Error('A user or borrower with this email address already exists');
    }

    // Phone uniqueness check (cross-table against borrowers too)
    if (data.phone) {
      const [userByPhone, borrowerByPhone] = await Promise.all([
        prisma.user.findFirst({ where: { phone: data.phone } }),
        prisma.borrower.findFirst({ where: { phone: data.phone } }),
      ]);
      if (userByPhone || borrowerByPhone) {
        throw new Error('A user or borrower with this phone number already exists');
      }
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.repo.create({
      email: data.email,
      name: data.name,
      phone: data.phone,
      passwordHash,
      role: data.role,
    });

    // Send welcome email (+ SMS if phone provided) with a password-reset link
    try {
      await authService.sendUserWelcomeEmail(user.id, user.role, data.password);
    } catch (err) {
      console.error('Failed to send welcome email to new user:', err);
    }

    return user;
  }

  async updateUser(
    id: string,
    data: { name?: string; role?: Role; phone?: string | null },
    requesterId: string
  ) {
    const user = await this.repo.findById(id);
    if (!user) throw new Error('User not found');

    // Prevent an admin from demoting themselves accidentally
    if (id === requesterId && data.role && data.role !== 'ADMIN') {
      throw new Error('You cannot change your own role');
    }

    // Phone uniqueness check on update
    if (data.phone) {
      const [userByPhone, borrowerByPhone] = await Promise.all([
        prisma.user.findFirst({ where: { phone: data.phone, NOT: { id } } }),
        prisma.borrower.findFirst({ where: { phone: data.phone } }),
      ]);
      if (userByPhone || borrowerByPhone) {
        throw new Error('A user or borrower with this phone number already exists');
      }
    }

    return this.repo.update(id, data);
  }

  async deleteUser(id: string, requesterId: string) {
    if (id === requesterId) {
      throw new Error('You cannot delete your own account');
    }

    const user = await this.repo.findById(id);
    if (!user) throw new Error('User not found');

    return this.repo.delete(id);
  }
}

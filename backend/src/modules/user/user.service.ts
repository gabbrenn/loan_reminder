import bcrypt from 'bcrypt';
import { UserRepository } from './user.repository';
import { Role } from '@prisma/client';

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
    password: string;
    role: Role;
  }) {
    const existing = await this.repo.findByEmail(data.email);
    if (existing) {
      throw new Error('A user with this email address already exists');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.repo.create({
      email: data.email,
      name: data.name,
      passwordHash,
      role: data.role,
    });
  }

  async updateUser(
    id: string,
    data: { name?: string; role?: Role },
    requesterId: string
  ) {
    const user = await this.repo.findById(id);
    if (!user) throw new Error('User not found');

    // Prevent an admin from demoting themselves accidentally
    if (id === requesterId && data.role && data.role !== 'ADMIN') {
      throw new Error('You cannot change your own role');
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

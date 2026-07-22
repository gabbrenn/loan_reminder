import { AuthRepository } from './auth.repository';
import bcrypt from 'bcrypt';

export class AuthService {
  private authRepository: AuthRepository;

  constructor() {
    this.authRepository = new AuthRepository();
  }

  async login(email: string, passwordPlain: string) {
    const user = await this.authRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    // Return user without password hash
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async changePassword(userId: string, oldPasswordPlain: string, newPasswordPlain: string) {
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const isMatch = await bcrypt.compare(oldPasswordPlain, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid current password');
    }

    // Basic password strength validation (e.g., min 6 characters)
    if (newPasswordPlain.length < 6) {
      throw new Error('New password must be at least 6 characters long');
    }

    const newPasswordHash = await bcrypt.hash(newPasswordPlain, 10);
    await this.authRepository.updatePassword(userId, newPasswordHash);
    return true;
  }
}

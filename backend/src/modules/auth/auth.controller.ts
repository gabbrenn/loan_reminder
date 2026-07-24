import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  login = async (
    request: FastifyRequest<{ Body: { email: string; passwordPlain: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { email, passwordPlain } = request.body;
      const user = await this.authService.login(email, passwordPlain);

      const token = request.server.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      });

      return reply.code(200).send({ user, token });
    } catch (error: any) {
      return reply.code(400).send({
        error: { message: error.message || 'Authentication failed', code: 'UNAUTHORIZED' },
      });
    }
  };

  logout = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(200).send({ success: true, message: 'Logged out successfully' });
  };

  changePassword = async (
    request: FastifyRequest<{ Body: { oldPasswordPlain: string; newPasswordPlain: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { oldPasswordPlain, newPasswordPlain } = request.body;
      const userId = (request.user as any)?.id;
      if (!userId) {
        return reply.code(401).send({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
      }

      await this.authService.changePassword(userId, oldPasswordPlain, newPasswordPlain);
      return reply.code(200).send({ success: true, message: 'Password changed successfully' });
    } catch (error: any) {
      return reply.code(400).send({
        error: { message: error.message || 'Failed to change password', code: 'BAD_REQUEST' },
      });
    }
  };

  updateProfile = async (
    request: FastifyRequest<{ Body: { email?: string; name?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = (request.user as any)?.id;
      if (!userId) {
        return reply.code(401).send({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
      }

      const updatedUser = await this.authService.updateProfile(userId, request.body);

      const token = request.server.jwt.sign({
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        name: updatedUser.name,
      });

      return reply.code(200).send({ user: updatedUser, token });
    } catch (error: any) {
      return reply.code(400).send({
        error: { message: error.message || 'Failed to update profile', code: 'BAD_REQUEST' },
      });
    }
  };

  // ─── Forgot Password ──────────────────────────────────────────────────────

  forgotPassword = async (
    request: FastifyRequest<{ Body: { email: string } }>,
    reply: FastifyReply
  ) => {
    try {
      await this.authService.forgotPassword(request.body.email);
      // Always 200 to prevent email enumeration
      return reply.code(200).send({
        success: true,
        message: 'If that email exists, a reset link has been sent.',
      });
    } catch (error: any) {
      return reply.code(500).send({
        error: { message: error.message || 'Failed to send reset email', code: 'SERVER_ERROR' },
      });
    }
  };

  // ─── Reset Password ───────────────────────────────────────────────────────

  resetPassword = async (
    request: FastifyRequest<{ Body: { token: string; newPasswordPlain: string } }>,
    reply: FastifyReply
  ) => {
    try {
      await this.authService.resetPassword(request.body.token, request.body.newPasswordPlain);
      return reply.code(200).send({ success: true, message: 'Password has been reset successfully.' });
    } catch (error: any) {
      return reply.code(400).send({
        error: { message: error.message || 'Failed to reset password', code: 'BAD_REQUEST' },
      });
    }
  };
}

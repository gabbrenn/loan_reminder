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

      // Sign JWT
      const token = request.server.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      });

      return reply.code(200).send({
        user,
        token,
      });
    } catch (error: any) {
      return reply.code(400).send({
        error: {
          message: error.message || 'Authentication failed',
          code: 'UNAUTHORIZED',
        },
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
      
      // User is injected to request.user by jwt middleware
      const userId = (request.user as any)?.id;
      if (!userId) {
        return reply.code(401).send({
          error: {
            message: 'Unauthorized',
            code: 'UNAUTHORIZED',
          },
        });
      }

      await this.authService.changePassword(userId, oldPasswordPlain, newPasswordPlain);
      return reply.code(200).send({ success: true, message: 'Password changed successfully' });
    } catch (error: any) {
      return reply.code(400).send({
        error: {
          message: error.message || 'Failed to change password',
          code: 'BAD_REQUEST',
        },
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
        return reply.code(401).send({
          error: {
            message: 'Unauthorized',
            code: 'UNAUTHORIZED',
          },
        });
      }

      const updatedUser = await this.authService.updateProfile(userId, request.body);

      // Sign a new JWT token with the updated info
      const token = request.server.jwt.sign({
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        name: updatedUser.name,
      });

      return reply.code(200).send({
        user: updatedUser,
        token,
      });
    } catch (error: any) {
      return reply.code(400).send({
        error: {
          message: error.message || 'Failed to update profile',
          code: 'BAD_REQUEST',
        },
      });
    }
  };
}

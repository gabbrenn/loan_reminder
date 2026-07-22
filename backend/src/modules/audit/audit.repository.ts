import prisma from '../../lib/prisma';

export class AuditRepository {
  async log(data: {
    userId: string;
    action: string;
    entity: string;
    entityId: string;
  }) {
    return prisma.auditLog.create({ data });
  }

  async findAll(filters?: { userId?: string; entity?: string; action?: string }) {
    return prisma.auditLog.findMany({
      where: {
        ...(filters?.userId && { userId: filters.userId }),
        ...(filters?.entity && { entity: { equals: filters.entity, mode: 'insensitive' } }),
        ...(filters?.action && { action: { equals: filters.action, mode: 'insensitive' } }),
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async findById(id: string) {
    return prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }
}

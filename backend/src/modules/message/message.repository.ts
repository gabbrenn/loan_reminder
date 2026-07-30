import prisma from '../../lib/prisma';
import { SenderType } from '@prisma/client';

export interface CreateMessageInput {
  loanId: string;
  senderType: SenderType;
  senderId: string;
  receiverId: string;
  message: string;
}

export class MessageRepository {
  async createMessage(data: CreateMessageInput) {
    return prisma.message.create({
      data,
    });
  }

  async findMessagesByLoanId(loanId: string) {
    return prisma.message.findMany({
      where: { loanId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async markAsRead(loanId: string, receiverId: string) {
    return prisma.message.updateMany({
      where: {
        loanId,
        receiverId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });
  }

  async findLoanWithDetails(loanId: string) {
    return prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        borrower: true,
        createdBy: true,
      },
    });
  }
}

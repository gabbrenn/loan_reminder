import { MessageRepository } from './message.repository';
import { SenderType } from '@prisma/client';

export class MessageService {
  private repo: MessageRepository;

  constructor() {
    this.repo = new MessageRepository();
  }

  async sendMessage(
    loanId: string,
    messageText: string,
    currentUser: { id: string; role: string }
  ) {
    if (!messageText || !messageText.trim()) {
      throw new Error('Message content cannot be empty');
    }

    const loan = await this.repo.findLoanWithDetails(loanId);
    if (!loan) {
      throw new Error('Loan not found');
    }

    let senderType: SenderType;
    let senderId: string;
    let receiverId: string;

    if (currentUser.role === 'BORROWER') {
      // Ensure borrower owns this loan
      if (loan.borrowerId !== currentUser.id) {
        throw new Error('Forbidden: You can only message regarding your own loan');
      }
      senderType = 'BORROWER';
      senderId = currentUser.id;
      // Intended recipient is the loan officer managing this loan (or createdById / default)
      receiverId = loan.createdById || loan.borrowerId; 
    } else {
      // Loan officer / Admin sending message to borrower
      senderType = 'LOAN_OFFICER';
      senderId = currentUser.id;
      receiverId = loan.borrowerId;
    }

    return this.repo.createMessage({
      loanId,
      senderType,
      senderId,
      receiverId,
      message: messageText.trim(),
    });
  }

  async getLoanMessages(loanId: string, currentUser: { id: string; role: string }) {
    const loan = await this.repo.findLoanWithDetails(loanId);
    if (!loan) {
      throw new Error('Loan not found');
    }

    if (currentUser.role === 'BORROWER' && loan.borrowerId !== currentUser.id) {
      throw new Error('Forbidden: Access denied to this loan conversation');
    }

    // Automatically mark unread messages for current recipient as read
    await this.repo.markAsRead(loanId, currentUser.id);

    const messages = await this.repo.findMessagesByLoanId(loanId);

    return {
      loanId: loan.id,
      loanNumber: loan.loanNumber,
      borrower: {
        id: loan.borrower.id,
        fullName: loan.borrower.fullName,
        email: loan.borrower.email,
      },
      officer: loan.createdBy
        ? {
            id: loan.createdBy.id,
            name: loan.createdBy.name,
            email: loan.createdBy.email,
          }
        : null,
      messages,
    };
  }

  async markRead(loanId: string, userId: string) {
    return this.repo.markAsRead(loanId, userId);
  }
}

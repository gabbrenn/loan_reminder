import prisma from '../../lib/prisma';

export interface CreateBorrowerInput {
  fullName: string;
  nationalId: string;
  phone: string;
  email: string;
  address: string;
  occupation: string;
  guarantorName: string;
  guarantorPhone: string;
  photo?: string;
  passwordHash?: string;
}


export interface UpdateBorrowerInput {
  fullName?: string;
  phone?: string;
  email?: string;
  address?: string;
  occupation?: string;
  guarantorName?: string;
  guarantorPhone?: string;
  photo?: string;
}

const loanInclude = {
  include: {
    loans: {
      include: {
        repaymentSchedules: true,
      },
    },
  },
};

export class BorrowerRepository {
  async create(data: CreateBorrowerInput) {
    return prisma.borrower.create({ data });
  }

  async findById(id: string) {
    return prisma.borrower.findUnique({
      where: { id },
      ...loanInclude,
    });
  }

  async findByNationalId(nationalId: string) {
    return prisma.borrower.findUnique({ where: { nationalId } });
  }

  async findByPhone(phone: string) {
    return prisma.borrower.findUnique({ where: { phone } });
  }

  async findByEmail(email: string) {
    return prisma.borrower.findUnique({ where: { email } });
  }

  async findAll(search?: string) {
    if (search) {
      return prisma.borrower.findMany({
        where: {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { nationalId: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
        ...loanInclude,
        orderBy: { createdAt: 'desc' },
      });
    }
    return prisma.borrower.findMany({
      ...loanInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: UpdateBorrowerInput) {
    return prisma.borrower.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.borrower.delete({ where: { id } });
  }
}

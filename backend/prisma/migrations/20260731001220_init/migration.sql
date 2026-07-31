-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('BORROWER', 'LOAN_OFFICER');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'BORROWER';

-- AlterTable
ALTER TABLE "borrowers" ADD COLUMN     "passwordHash" TEXT;

-- AlterTable
ALTER TABLE "password_reset_tokens" ADD COLUMN     "borrowerId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "senderType" "SenderType" NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "borrowers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

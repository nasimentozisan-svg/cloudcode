-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "attachmentExpiresAt" TIMESTAMP(3),
ADD COLUMN     "attachmentName" TEXT,
ADD COLUMN     "attachmentPath" TEXT;

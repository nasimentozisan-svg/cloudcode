-- AlterTable
ALTER TABLE "User" ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "birthDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PendingCardImage" ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "birthDate" TIMESTAMP(3);

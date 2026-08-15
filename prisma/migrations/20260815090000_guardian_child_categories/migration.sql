-- AlterTable
ALTER TABLE "User" ADD COLUMN     "guardianChildCategories" "Category"[] DEFAULT ARRAY[]::"Category"[];

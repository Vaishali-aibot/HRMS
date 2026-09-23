-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "workEmail" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_workEmail_key" ON "Employee"("workEmail");

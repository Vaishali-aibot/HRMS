-- CreateEnum
CREATE TYPE "LeaveAccrualMethod" AS ENUM ('ANNUAL', 'MONTHLY');

-- CreateEnum
CREATE TYPE "LeaveEncashmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "LeaveBalance" ADD COLUMN     "encashed" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "LeaveType" ADD COLUMN     "accrualMethod" "LeaveAccrualMethod" NOT NULL DEFAULT 'ANNUAL';

-- CreateTable
CREATE TABLE "LeaveEncashmentRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "status" "LeaveEncashmentStatus" NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveEncashmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaveEncashmentRequest_employeeId_idx" ON "LeaveEncashmentRequest"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveEncashmentRequest_status_idx" ON "LeaveEncashmentRequest"("status");

-- AddForeignKey
ALTER TABLE "LeaveEncashmentRequest" ADD CONSTRAINT "LeaveEncashmentRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveEncashmentRequest" ADD CONSTRAINT "LeaveEncashmentRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


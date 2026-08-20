-- CreateEnum
CREATE TYPE "ResignationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ResignationRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "resignationDate" TIMESTAMP(3) NOT NULL,
    "noticePeriodDays" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "ResignationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResignationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResignationRequest_employeeId_idx" ON "ResignationRequest"("employeeId");

-- CreateIndex
CREATE INDEX "ResignationRequest_status_idx" ON "ResignationRequest"("status");

-- AddForeignKey
ALTER TABLE "ResignationRequest" ADD CONSTRAINT "ResignationRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateEnum
CREATE TYPE "RecognitionCategory" AS ENUM ('TEAMWORK', 'INNOVATION', 'CUSTOMER_FOCUS', 'LEADERSHIP', 'GOING_ABOVE_AND_BEYOND', 'OTHER');

-- CreateTable
CREATE TABLE "Recognition" (
    "id" TEXT NOT NULL,
    "fromEmployeeId" TEXT NOT NULL,
    "toEmployeeId" TEXT NOT NULL,
    "category" "RecognitionCategory" NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 10,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recognition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Recognition_toEmployeeId_idx" ON "Recognition"("toEmployeeId");

-- CreateIndex
CREATE INDEX "Recognition_fromEmployeeId_idx" ON "Recognition"("fromEmployeeId");

-- AddForeignKey
ALTER TABLE "Recognition" ADD CONSTRAINT "Recognition_fromEmployeeId_fkey" FOREIGN KEY ("fromEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recognition" ADD CONSTRAINT "Recognition_toEmployeeId_fkey" FOREIGN KEY ("toEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;


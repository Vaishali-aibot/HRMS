-- CreateEnum
CREATE TYPE "EmployeeAssetCategory" AS ENUM ('LAPTOP', 'CHARGER', 'MONITOR', 'OTHER');

-- CreateTable
CREATE TABLE "EmployeeAsset" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "category" "EmployeeAssetCategory" NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "processor" TEXT,
    "ram" TEXT,
    "operatingSystem" TEXT,
    "assetTag" TEXT,
    "otherDescription" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeAsset_employeeId_idx" ON "EmployeeAsset"("employeeId");

-- AddForeignKey
ALTER TABLE "EmployeeAsset" ADD CONSTRAINT "EmployeeAsset_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

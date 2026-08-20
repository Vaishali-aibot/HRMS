-- CreateTable
CREATE TABLE "WFHPolicy" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "maxDaysPerMonth" INTEGER,
    "maxDaysPerYear" INTEGER,
    "eligibleEmploymentTypes" "EmploymentType"[],
    "allowedLocations" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WFHPolicy_pkey" PRIMARY KEY ("id")
);


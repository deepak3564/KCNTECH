DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'NA');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "PlanType" AS ENUM ('CABLE', 'INTERNET');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "BillingStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'ADMIN_UPI', 'EMPLOYEE_UPI');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "BoxStatus" AS ENUM ('ACTIVE', 'REPAIRED', 'REPLACED', 'RETURNED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Organisation" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
  "preferredTheme" TEXT NOT NULL DEFAULT 'professional',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "deleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Plan" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "type" "PlanType" NOT NULL,
  "price" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "deleted" BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS "Customer" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "collectorId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT,
  "phone" TEXT,
  "address" TEXT NOT NULL,
  "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
  "cableStatus" "ServiceStatus" NOT NULL DEFAULT 'NA',
  "internetStatus" "ServiceStatus" NOT NULL DEFAULT 'NA',
  "cablePlanId" TEXT REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "internetPlanId" TEXT REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "cableStartMonth" INTEGER,
  "cableStartYear" INTEGER,
  "internetStartMonth" INTEGER,
  "internetStartYear" INTEGER,
  "notes" TEXT,
  "deleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "SetTopBox" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "boxNumber" TEXT NOT NULL,
  "pairedCardNumber" TEXT NOT NULL,
  "status" "BoxStatus" NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "deleted" BOOLEAN NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS "SetTopBox_organisationId_boxNumber_key" ON "SetTopBox"("organisationId", "boxNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "SetTopBox_organisationId_pairedCardNumber_key" ON "SetTopBox"("organisationId", "pairedCardNumber");

CREATE TABLE IF NOT EXISTS "CustomerBox" (
  "id" TEXT PRIMARY KEY,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "setTopBoxId" TEXT NOT NULL REFERENCES "SetTopBox"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unassignedAt" TIMESTAMP(3),
  "reason" TEXT
);

CREATE TABLE IF NOT EXISTS "MonthlyBilling" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "cableAmount" INTEGER NOT NULL DEFAULT 0,
  "internetAmount" INTEGER NOT NULL DEFAULT 0,
  "maintenanceAmount" INTEGER NOT NULL DEFAULT 0,
  "totalAmount" INTEGER NOT NULL,
  "paidAmount" INTEGER NOT NULL DEFAULT 0,
  "status" "BillingStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyBilling_customerId_month_year_key" ON "MonthlyBilling"("customerId", "month", "year");

CREATE TABLE IF NOT EXISTS "Payment" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL,
  "billingId" TEXT NOT NULL REFERENCES "MonthlyBilling"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "employeeId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "amount" INTEGER NOT NULL,
  "mode" "PaymentMode" NOT NULL,
  "proofImageUrl" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT
);

CREATE TABLE IF NOT EXISTS "MaintenanceCharge" (
  "id" TEXT PRIMARY KEY,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "EmployeeHandover" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "amount" INTEGER NOT NULL,
  "fromDate" TIMESTAMP(3) NOT NULL,
  "toDate" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "handedOverAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "CustomerRequest" (
  "id" TEXT PRIMARY KEY,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "title" TEXT NOT NULL,
  "details" TEXT,
  "isResolved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "CustomerHistory" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "comment" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "CustomerPlanHistory" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "cablePlanId" TEXT,
  "cablePlanName" TEXT,
  "cablePrice" INTEGER NOT NULL DEFAULT 0,
  "internetPlanId" TEXT,
  "internetPlanName" TEXT,
  "internetPrice" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerPlanHistory_customerId_month_year_key" ON "CustomerPlanHistory"("customerId", "month", "year");

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SetTopBox" ADD COLUMN IF NOT EXISTS "deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "cableStartMonth" INTEGER;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "cableStartYear" INTEGER;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "internetStartMonth" INTEGER;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "internetStartYear" INTEGER;

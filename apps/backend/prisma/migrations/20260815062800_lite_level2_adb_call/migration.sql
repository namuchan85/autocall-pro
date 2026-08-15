-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('REQUESTED', 'STARTED', 'FAILED');

-- CreateEnum
CREATE TYPE "CallProvider" AS ENUM ('ADB_GALAXY');

-- CreateTable
CREATE TABLE "calls" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "status" "CallStatus" NOT NULL,
    "provider" "CallProvider" NOT NULL DEFAULT 'ADB_GALAXY',
    "deviceId" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calls_customerId_idx" ON "calls"("customerId");

-- CreateIndex
CREATE INDEX "calls_createdAt_idx" ON "calls"("createdAt");

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

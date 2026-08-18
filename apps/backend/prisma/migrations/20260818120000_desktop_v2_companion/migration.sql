-- Desktop v2: Companion call tracking and customer outcome.
-- SQLite stores Prisma enums as TEXT; new CallStatus/CallProvider values
-- do not require a CHECK rewrite.

ALTER TABLE "customers" ADD COLUMN "lastOutcome" TEXT;

ALTER TABLE "calls" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "calls" ADD COLUMN "companionState" TEXT;
ALTER TABLE "calls" ADD COLUMN "observedActive" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "calls" ADD COLUMN "startedAt" DATETIME;
ALTER TABLE "calls" ADD COLUMN "endedAt" DATETIME;
ALTER TABLE "calls" ADD COLUMN "durationSeconds" INTEGER;
ALTER TABLE "calls" ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS "calls_sessionId_idx" ON "calls"("sessionId");

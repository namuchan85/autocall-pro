-- Desktop v3: Companion call lifecycle persistence (answeredAt, disconnectSource/cause).

ALTER TABLE "calls" ADD COLUMN "answeredAt" DATETIME;

ALTER TABLE "calls" ADD COLUMN "disconnectSource" TEXT;
ALTER TABLE "calls" ADD COLUMN "disconnectCause" TEXT;


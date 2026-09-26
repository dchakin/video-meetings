-- CreateEnum
CREATE TYPE "TranscriptionStatus" AS ENUM ('QUEUED', 'IN_PROGRESS', 'DONE', 'ERROR');

-- AlterTable
ALTER TABLE "MeetingFile" ADD COLUMN     "transcriptionStatus" "TranscriptionStatus",
ADD COLUMN     "transcriptionText" TEXT;

-- CreateEnum
CREATE TYPE "FunnelStage" AS ENUM ('LEAD', 'PIPELINE', 'CLIENT', 'LOST');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('REEL', 'CAROUSEL', 'STORY', 'KEYWORD', 'COMMENT', 'REFERRAL', 'CHALLENGE', 'WHATSAPP_GROUP', 'OTHER');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('NEW', 'FIRST_CONTACT', 'CALL_SCHEDULED', 'PRE_CALL', 'POST_CALL', 'PROPOSAL_SENT', 'FOLLOW_UP', 'NOT_SCHEDULED', 'NO_SHOW', 'CLOSED_WON', 'CLOSED_LOST', 'FUTURE');

-- CreateEnum
CREATE TYPE "SuccessStage" AS ENUM ('NEW_CLIENT', 'INTAKE_FORM_SENT', 'FIRST_SESSION', 'ONGOING', 'CLOSED', 'TESTIMONIAL', 'RENEWAL', 'REFERRAL');

-- CreateEnum
CREATE TYPE "FunnelModule" AS ENUM ('PIPELINE', 'SUCCESS');

-- CreateEnum
CREATE TYPE "AppointmentPurpose" AS ENUM ('COMMERCIAL_CALL', 'STYLING_SESSION');

-- AlterTable
ALTER TABLE "clients"
  ADD COLUMN "funnelStage" "FunnelStage" NOT NULL DEFAULT 'LEAD',
  ADD COLUMN "instagram" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "profession" TEXT,
  ADD COLUMN "leadSource" "LeadSource",
  ADD COLUMN "leadSourceContentRef" TEXT,
  ADD COLUMN "painPoints" TEXT,
  ADD COLUMN "desires" TEXT,
  ADD COLUMN "objections" TEXT,
  ADD COLUMN "leadNotes" TEXT,
  ADD COLUMN "pipelineStage" "PipelineStage",
  ADD COLUMN "pipelineStageEnteredAt" TIMESTAMP(3),
  ADD COLUMN "callDate" TIMESTAMP(3),
  ADD COLUMN "lastContactAt" TIMESTAMP(3),
  ADD COLUMN "nextActionNote" TEXT,
  ADD COLUMN "nextActionAt" TIMESTAMP(3),
  ADD COLUMN "proposalValue" DECIMAL(10,2),
  ADD COLUMN "paymentMethod" TEXT,
  ADD COLUMN "leadScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "successStage" "SuccessStage",
  ADD COLUMN "successStageEnteredAt" TIMESTAMP(3),
  ADD COLUMN "intakeFormSubmittedAt" TIMESTAMP(3),
  ADD COLUMN "renewalReminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "purpose" "AppointmentPurpose" NOT NULL DEFAULT 'STYLING_SESSION';

-- CreateTable
CREATE TABLE "funnel_stage_events" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "module" "FunnelModule" NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "changedByUserId" TEXT,
    "reason" TEXT,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" TIMESTAMP(3),

    CONSTRAINT "funnel_stage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "funnel_stage_events_clientId_module_idx" ON "funnel_stage_events"("clientId", "module");

-- AddForeignKey
ALTER TABLE "funnel_stage_events" ADD CONSTRAINT "funnel_stage_events_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_stage_events" ADD CONSTRAINT "funnel_stage_events_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

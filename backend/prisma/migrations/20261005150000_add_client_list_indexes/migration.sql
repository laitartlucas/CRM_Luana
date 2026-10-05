-- CreateIndex
CREATE INDEX "clients_funnelStage_createdAt_idx" ON "clients"("funnelStage", "createdAt");

-- CreateIndex
CREATE INDEX "clients_funnelStage_name_idx" ON "clients"("funnelStage", "name");

-- CreateIndex
CREATE INDEX "clients_leadSource_idx" ON "clients"("leadSource");


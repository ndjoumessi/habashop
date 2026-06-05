-- Ticket Z — clôture journalière de caisse. Nouvelle table, additif (aucun impact
-- sur l'existant). 1 ligne par (tenant, date) ; regénérable via upsert.

-- CreateTable
CREATE TABLE "TicketZ" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "caVentes" DOUBLE PRECISION NOT NULL,
    "nbVentes" INTEGER NOT NULL,
    "totalRemboursements" DOUBLE PRECISION NOT NULL,
    "caNets" DOUBLE PRECISION NOT NULL,
    "cashAmount" DOUBLE PRECISION NOT NULL,
    "mobileMoneyAmount" DOUBLE PRECISION NOT NULL,
    "cardAmount" DOUBLE PRECISION NOT NULL,
    "panierMoyen" DOUBLE PRECISION NOT NULL,
    "nbClients" INTEGER NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketZ_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TicketZ_tenantId_date_key" ON "TicketZ"("tenantId", "date");

-- CreateIndex
CREATE INDEX "TicketZ_tenantId_date_idx" ON "TicketZ"("tenantId", "date");

-- AddForeignKey
ALTER TABLE "TicketZ" ADD CONSTRAINT "TicketZ_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

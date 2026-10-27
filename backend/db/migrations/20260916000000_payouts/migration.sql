CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "school" "School" NOT NULL,
    "amount" NUMERIC NOT NULL,
    "commissionAmount" NUMERIC NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByAdminId" TEXT NOT NULL,
    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD COLUMN "payoutId" TEXT;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

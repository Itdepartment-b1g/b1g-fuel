BEGIN;
-- Existing history remains unreconciled; never invent past balances.
ALTER TABLE "stock_movement" ADD COLUMN "balance_before" DECIMAL(14,3),
  ADD COLUMN "balance_after" DECIMAL(14,3), ADD COLUMN "sequence" BIGSERIAL;
CREATE UNIQUE INDEX "stock_movement_sequence_key" ON "stock_movement"("sequence");
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_balances_valid" CHECK (
  (balance_before IS NULL AND balance_after IS NULL) OR
  (balance_before IS NOT NULL AND balance_after IS NOT NULL
   AND balance_before >= 0 AND balance_after >= 0
   AND balance_after = balance_before + CASE WHEN direction = 'in' THEN qty ELSE -qty END)
);
COMMIT;

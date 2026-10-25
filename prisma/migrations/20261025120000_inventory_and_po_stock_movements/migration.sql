-- Rename in place so existing balances and row-level security are preserved.
ALTER TABLE "stock_balance" RENAME TO "inventory";
ALTER TABLE "inventory" RENAME CONSTRAINT "stock_balance_pkey" TO "inventory_pkey";
ALTER TABLE "inventory" RENAME CONSTRAINT "stock_balance_location_id_fkey" TO "inventory_location_id_fkey";
ALTER TABLE "inventory" RENAME CONSTRAINT "stock_balance_product_id_fkey" TO "inventory_product_id_fkey";
ALTER TABLE "inventory" RENAME CONSTRAINT "stock_balance_qty_nonnegative" TO "inventory_qty_nonnegative";
ALTER INDEX "stock_balance_location_id_product_id_key" RENAME TO "inventory_location_id_product_id_key";
ALTER INDEX "stock_balance_product_id_idx" RENAME TO "inventory_product_id_idx";

ALTER TYPE "stock_movement_type" ADD VALUE 'po_receive_in';
ALTER TABLE "stock_movement" ADD COLUMN "po_receiving_item_id" UUID;
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_po_receiving_item_id_fkey"
  FOREIGN KEY ("po_receiving_item_id") REFERENCES "receiving_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "stock_movement_material_request_dispatch_item_id_idx";
DROP INDEX "stock_movement_material_request_receiving_item_id_idx";
CREATE UNIQUE INDEX "stock_movement_po_receiving_item_id_key" ON "stock_movement"("po_receiving_item_id");
CREATE UNIQUE INDEX "stock_movement_material_request_dispatch_item_id_key" ON "stock_movement"("material_request_dispatch_item_id");
CREATE UNIQUE INDEX "stock_movement_material_request_receiving_item_id_key" ON "stock_movement"("material_request_receiving_item_id");
CREATE INDEX "stock_movement_product_id_idx" ON "stock_movement"("product_id");

ALTER TABLE "stock_movement" DROP CONSTRAINT "stock_movement_one_source";
-- Compare as text so the new enum value is safe within a transactional migration.
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_one_source" CHECK (
  num_nonnulls(po_receiving_item_id, material_request_dispatch_item_id, material_request_receiving_item_id) = 1
  AND (
    (type::text = 'po_receive_in' AND direction = 'in' AND po_receiving_item_id IS NOT NULL)
    OR (type::text = 'dispatch_out' AND direction = 'out' AND material_request_dispatch_item_id IS NOT NULL)
    OR (type::text = 'receive_in' AND direction = 'in' AND material_request_receiving_item_id IS NOT NULL)
  )
);

CREATE FUNCTION reject_stock_movement_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Stock movements cannot be updated or deleted.' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER stock_movement_immutable
  BEFORE UPDATE OR DELETE ON "stock_movement"
  FOR EACH ROW EXECUTE FUNCTION reject_stock_movement_change();

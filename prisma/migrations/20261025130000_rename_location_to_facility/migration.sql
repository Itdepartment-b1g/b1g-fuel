-- Rename in place to preserve facility IDs, stock, assignments, history and RLS.
BEGIN;
ALTER TYPE "location_type" RENAME TO "facility_type";
ALTER TABLE "location" RENAME TO "facility";
ALTER TABLE "user_location" RENAME TO "user_facility";
ALTER TABLE "user_location_history" RENAME TO "user_facility_history";
ALTER TABLE "user_facility" RENAME COLUMN "location_id" TO "facility_id";
ALTER TABLE "user_facility_history" RENAME COLUMN "location_id" TO "facility_id";
ALTER TABLE "purchase_order" RENAME COLUMN "location_id" TO "facility_id";
ALTER TABLE "receiving" RENAME COLUMN "location_id" TO "facility_id";
ALTER TABLE "material_request_receiving" RENAME COLUMN "location_id" TO "facility_id";
ALTER TABLE "material_request_dispatch" RENAME COLUMN "location_id" TO "facility_id";
ALTER TABLE "inventory" RENAME COLUMN "location_id" TO "facility_id";
ALTER TABLE "stock_movement" RENAME COLUMN "location_id" TO "facility_id";

ALTER TABLE "inventory" RENAME CONSTRAINT "inventory_location_id_fkey" TO "inventory_facility_id_fkey";
ALTER TABLE "facility" RENAME CONSTRAINT "location_company_id_fkey" TO "facility_company_id_fkey";
ALTER TABLE "facility" RENAME CONSTRAINT "location_name_nonempty" TO "facility_name_nonempty";
ALTER TABLE "facility" RENAME CONSTRAINT "location_pkey" TO "facility_pkey";
ALTER TABLE "material_request_dispatch" RENAME CONSTRAINT "material_request_dispatch_location_id_fkey" TO "material_request_dispatch_facility_id_fkey";
ALTER TABLE "material_request_receiving" RENAME CONSTRAINT "material_request_receiving_location_id_fkey" TO "material_request_receiving_facility_id_fkey";
ALTER TABLE "purchase_order" RENAME CONSTRAINT "purchase_order_location_id_fkey" TO "purchase_order_facility_id_fkey";
ALTER TABLE "receiving" RENAME CONSTRAINT "receiving_location_id_fkey" TO "receiving_facility_id_fkey";
ALTER TABLE "stock_movement" RENAME CONSTRAINT "stock_movement_location_id_fkey" TO "stock_movement_facility_id_fkey";
ALTER TABLE "user_facility" RENAME CONSTRAINT "user_location_location_id_company_id_fkey" TO "user_facility_facility_id_company_id_fkey";
ALTER TABLE "user_facility" RENAME CONSTRAINT "user_location_pkey" TO "user_facility_pkey";
ALTER TABLE "user_facility" RENAME CONSTRAINT "user_location_user_company_id_company_id_fkey" TO "user_facility_user_company_id_company_id_fkey";
ALTER TABLE "user_facility_history" RENAME CONSTRAINT "user_location_history_date_check" TO "user_facility_history_date_check";
ALTER TABLE "user_facility_history" RENAME CONSTRAINT "user_location_history_location_id_company_id_fkey" TO "user_facility_history_facility_id_company_id_fkey";
ALTER TABLE "user_facility_history" RENAME CONSTRAINT "user_location_history_pkey" TO "user_facility_history_pkey";
ALTER INDEX "inventory_location_id_product_id_key" RENAME TO "inventory_facility_id_product_id_key";
ALTER INDEX "location_company_id_idx" RENAME TO "facility_company_id_idx";
ALTER INDEX "location_company_id_name_key" RENAME TO "facility_company_id_name_key";
ALTER INDEX "location_created_by_idx" RENAME TO "facility_created_by_idx";
ALTER INDEX "location_id_company_id_key" RENAME TO "facility_id_company_id_key";
ALTER INDEX "location_type_idx" RENAME TO "facility_type_idx";
ALTER INDEX "material_request_dispatch_location_id_idx" RENAME TO "material_request_dispatch_facility_id_idx";
ALTER INDEX "material_request_receiving_location_id_idx" RENAME TO "material_request_receiving_facility_id_idx";
ALTER INDEX "purchase_order_location_id_idx" RENAME TO "purchase_order_facility_id_idx";
ALTER INDEX "receiving_location_id_idx" RENAME TO "receiving_facility_id_idx";
ALTER INDEX "stock_movement_location_id_product_id_created_at_idx" RENAME TO "stock_movement_facility_id_product_id_created_at_idx";
ALTER INDEX "user_location_assigned_by_idx" RENAME TO "user_facility_assigned_by_idx";
ALTER INDEX "user_location_history_location_id_company_id_idx" RENAME TO "user_facility_history_facility_id_company_id_idx";
ALTER INDEX "user_location_history_location_id_user_created_at_assigned_at_i" RENAME TO "user_facility_history_facility_id_user_created_at_assigned_at_i";
ALTER INDEX "user_location_location_id_company_id_idx" RENAME TO "user_facility_facility_id_company_id_idx";
ALTER INDEX "user_location_user_company_id_company_id_idx" RENAME TO "user_facility_user_company_id_company_id_idx";
ALTER INDEX "user_location_user_company_id_location_id_key" RENAME TO "user_facility_user_company_id_facility_id_key";

-- PL/pgSQL source text must be updated explicitly after table and column renames.
ALTER FUNCTION record_user_location_history() RENAME TO record_user_facility_history;
CREATE OR REPLACE FUNCTION record_user_facility_history() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "user_facility_history" (
      "id", "company_id", "facility_id", "user_company_id", "user_id", "name", "email", "user_created_at",
      "assigned_by", "assigned_by_name", "assigned_at"
    )
    SELECT NEW."id", NEW."company_id", NEW."facility_id", NEW."user_company_id", u."id", u."name", u."email", u."created_at",
           NEW."assigned_by", actor."name", NEW."assigned_at"
    FROM "user_company" membership
    JOIN "user" u ON u."id" = membership."user_id"
    LEFT JOIN "user" actor ON actor."id" = NEW."assigned_by"
    WHERE membership."id" = NEW."user_company_id";
    RETURN NEW;
  END IF;
  UPDATE "user_facility_history"
    SET "unassigned_at" = GREATEST(clock_timestamp(), OLD."assigned_at")
    WHERE "id" = OLD."id" AND "unassigned_at" IS NULL;
  RETURN OLD;
END;
$$;
ALTER TRIGGER "user_location_history_insert" ON "user_facility" RENAME TO "user_facility_history_insert";
ALTER TRIGGER "user_location_history_delete" ON "user_facility" RENAME TO "user_facility_history_delete";
COMMIT;

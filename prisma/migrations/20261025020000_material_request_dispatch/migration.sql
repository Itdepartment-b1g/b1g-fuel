ALTER TABLE "material_request" DROP CONSTRAINT IF EXISTS "material_request_number_status";
ALTER TABLE "material_request" DROP CONSTRAINT IF EXISTS "material_request_approved_warehouse";
ALTER TABLE "material_request_item" DROP CONSTRAINT IF EXISTS "material_request_received_qty";

DROP TYPE IF EXISTS "material_request_status_new";
CREATE TYPE "material_request_status_new" AS ENUM ('draft', 'submitted', 'approved', 'partially_dispatched', 'fully_dispatched', 'partially_received', 'received', 'closed', 'rejected', 'cancelled');

ALTER TABLE "material_request" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "material_request" ALTER COLUMN "status" TYPE "material_request_status_new" USING ("status"::text::"material_request_status_new");
ALTER TABLE "material_request" ALTER COLUMN "status" SET DEFAULT 'draft';
ALTER TABLE "material_request_event" ALTER COLUMN "from_status" TYPE "material_request_status_new" USING ("from_status"::text::"material_request_status_new");
ALTER TABLE "material_request_event" ALTER COLUMN "to_status" TYPE "material_request_status_new" USING ("to_status"::text::"material_request_status_new");
DROP TYPE "material_request_status";
ALTER TYPE "material_request_status_new" RENAME TO "material_request_status";

DROP TYPE IF EXISTS "material_request_event_kind_new";
CREATE TYPE "material_request_event_kind_new" AS ENUM ('created', 'updated', 'submitted', 'approved', 'rejected', 'cancelled', 'receipt_posted', 'dispatched', 'closed');
ALTER TABLE "material_request_event" ALTER COLUMN "kind" TYPE "material_request_event_kind_new" USING ("kind"::text::"material_request_event_kind_new");
DROP TYPE "material_request_event_kind";
ALTER TYPE "material_request_event_kind_new" RENAME TO "material_request_event_kind";

CREATE TYPE "material_request_dispatch_status" AS ENUM ('posted');
CREATE TYPE "stock_movement_direction" AS ENUM ('in', 'out');
CREATE TYPE "stock_movement_type" AS ENUM ('dispatch_out', 'receive_in');

ALTER TABLE "material_request_item" ADD COLUMN "dispatched_qty" DECIMAL(14,3) NOT NULL DEFAULT 0;
UPDATE "material_request_item" SET "dispatched_qty" = "received_qty";

CREATE TABLE "material_request_dispatch" (
    "id" UUID NOT NULL,
    "supplying_company_id" UUID NOT NULL,
    "material_request_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "status" "material_request_dispatch_status" NOT NULL DEFAULT 'posted',
    "dispatch_seq" INTEGER NOT NULL,
    "dispatch_no" VARCHAR(64) NOT NULL,
    "notes" VARCHAR(1000) NOT NULL DEFAULT '',
    "created_by" UUID NOT NULL,
    "posted_by" UUID NOT NULL,
    "posted_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "material_request_dispatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "material_request_dispatch_item" (
    "id" UUID NOT NULL,
    "material_request_dispatch_id" UUID NOT NULL,
    "material_request_item_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "content_per_unit" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "base_qty" DECIMAL(14,3) NOT NULL,
    CONSTRAINT "material_request_dispatch_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_balance" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "stock_balance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_movement" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "direction" "stock_movement_direction" NOT NULL,
    "type" "stock_movement_type" NOT NULL,
    "material_request_dispatch_item_id" UUID,
    "material_request_receiving_item_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_movement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mr_dispatch_company_seq_key" ON "material_request_dispatch"("supplying_company_id", "dispatch_seq");
CREATE UNIQUE INDEX "material_request_dispatch_dispatch_no_key" ON "material_request_dispatch"("dispatch_no");
CREATE INDEX "material_request_dispatch_material_request_id_idx" ON "material_request_dispatch"("material_request_id");
CREATE INDEX "material_request_dispatch_location_id_idx" ON "material_request_dispatch"("location_id");
CREATE INDEX "material_request_dispatch_created_by_idx" ON "material_request_dispatch"("created_by");
CREATE UNIQUE INDEX "mr_dispatch_item_line_key" ON "material_request_dispatch_item"("material_request_dispatch_id", "material_request_item_id");
CREATE INDEX "material_request_dispatch_item_material_request_item_id_idx" ON "material_request_dispatch_item"("material_request_item_id");
CREATE INDEX "material_request_dispatch_item_product_id_idx" ON "material_request_dispatch_item"("product_id");
CREATE INDEX "material_request_dispatch_item_unit_id_idx" ON "material_request_dispatch_item"("unit_id");
CREATE UNIQUE INDEX "stock_balance_location_id_product_id_key" ON "stock_balance"("location_id", "product_id");
CREATE INDEX "stock_balance_product_id_idx" ON "stock_balance"("product_id");
CREATE INDEX "stock_movement_location_id_product_id_created_at_idx" ON "stock_movement"("location_id", "product_id", "created_at");
CREATE INDEX "stock_movement_material_request_dispatch_item_id_idx" ON "stock_movement"("material_request_dispatch_item_id");
CREATE INDEX "stock_movement_material_request_receiving_item_id_idx" ON "stock_movement"("material_request_receiving_item_id");
CREATE INDEX "stock_movement_created_by_idx" ON "stock_movement"("created_by");

ALTER TABLE "material_request_dispatch" ADD CONSTRAINT "material_request_dispatch_supplying_company_id_fkey" FOREIGN KEY ("supplying_company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_request_dispatch" ADD CONSTRAINT "material_request_dispatch_material_request_id_fkey" FOREIGN KEY ("material_request_id") REFERENCES "material_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_request_dispatch" ADD CONSTRAINT "material_request_dispatch_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_request_dispatch_item" ADD CONSTRAINT "mr_dispatch_item_dispatch_fkey" FOREIGN KEY ("material_request_dispatch_id") REFERENCES "material_request_dispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "material_request_dispatch_item" ADD CONSTRAINT "mr_dispatch_item_request_item_fkey" FOREIGN KEY ("material_request_item_id") REFERENCES "material_request_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_request_dispatch_item" ADD CONSTRAINT "material_request_dispatch_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_request_dispatch_item" ADD CONSTRAINT "material_request_dispatch_item_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "measurement_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_balance" ADD CONSTRAINT "stock_balance_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_balance" ADD CONSTRAINT "stock_balance_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_dispatch_item_fkey" FOREIGN KEY ("material_request_dispatch_item_id") REFERENCES "material_request_dispatch_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_receiving_item_fkey" FOREIGN KEY ("material_request_receiving_item_id") REFERENCES "material_request_receiving_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "material_request" ADD CONSTRAINT "material_request_number_status" CHECK ((status = 'draft' AND request_no IS NULL AND submitted_at IS NULL) OR status = 'cancelled' OR (status <> 'draft' AND request_no IS NOT NULL AND submitted_at IS NOT NULL));
ALTER TABLE "material_request" ADD CONSTRAINT "material_request_approved_warehouse" CHECK (status NOT IN ('approved', 'partially_dispatched', 'fully_dispatched', 'partially_received', 'received', 'closed') OR supplying_warehouse_id IS NOT NULL);
ALTER TABLE "material_request_item" ADD CONSTRAINT "material_request_dispatch_qty" CHECK (dispatched_qty >= 0 AND received_qty >= 0 AND dispatched_qty <= requested_qty AND received_qty <= dispatched_qty AND ((approved_qty IS NULL AND dispatched_qty = 0) OR approved_qty IS NOT NULL));
ALTER TABLE "material_request_dispatch_item" ADD CONSTRAINT "material_request_dispatch_item_qty_positive" CHECK (qty > 0 AND content_per_unit > 0 AND base_qty > 0);
ALTER TABLE "stock_balance" ADD CONSTRAINT "stock_balance_qty_nonnegative" CHECK (qty >= 0);
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_qty_positive" CHECK (qty > 0);
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_one_source" CHECK ((type = 'dispatch_out' AND direction = 'out' AND material_request_dispatch_item_id IS NOT NULL AND material_request_receiving_item_id IS NULL) OR (type = 'receive_in' AND direction = 'in' AND material_request_receiving_item_id IS NOT NULL AND material_request_dispatch_item_id IS NULL));

ALTER TABLE "material_request_dispatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "material_request_dispatch_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_balance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_movement" ENABLE ROW LEVEL SECURITY;

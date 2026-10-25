ALTER TABLE "material_request" DROP CONSTRAINT IF EXISTS "material_request_number_status";
ALTER TABLE "material_request" DROP CONSTRAINT IF EXISTS "material_request_approved_warehouse";

DROP TYPE IF EXISTS "material_request_status_new";
CREATE TYPE "material_request_status_new" AS ENUM ('draft', 'submitted', 'approved', 'partially_received', 'received', 'closed', 'rejected', 'cancelled');

ALTER TABLE "material_request" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "material_request"
  ALTER COLUMN "status" TYPE "material_request_status_new"
  USING ("status"::text::"material_request_status_new");
ALTER TABLE "material_request" ALTER COLUMN "status" SET DEFAULT 'draft';

ALTER TABLE "material_request_event"
  ALTER COLUMN "from_status" TYPE "material_request_status_new"
  USING ("from_status"::text::"material_request_status_new");
ALTER TABLE "material_request_event"
  ALTER COLUMN "to_status" TYPE "material_request_status_new"
  USING ("to_status"::text::"material_request_status_new");

DROP TYPE "material_request_status";
ALTER TYPE "material_request_status_new" RENAME TO "material_request_status";

CREATE TYPE "material_request_event_kind_new" AS ENUM ('created', 'updated', 'submitted', 'approved', 'rejected', 'cancelled', 'receipt_posted', 'closed');

ALTER TABLE "material_request_event"
  ALTER COLUMN "kind" TYPE "material_request_event_kind_new"
  USING ("kind"::text::"material_request_event_kind_new");

DROP TYPE "material_request_event_kind";
ALTER TYPE "material_request_event_kind_new" RENAME TO "material_request_event_kind";

CREATE TYPE "material_request_receiving_status" AS ENUM ('draft', 'posted');

ALTER TABLE "material_request_item" ADD COLUMN "received_qty" DECIMAL(14,3) NOT NULL DEFAULT 0;
ALTER TABLE "material_request_event" ADD COLUMN "material_request_receiving_id" UUID;

CREATE UNIQUE INDEX "material_request_hub_company_key" ON "material_request"("id", "requesting_hub_id", "requesting_company_id");

CREATE TABLE "material_request_receiving" (
    "id" UUID NOT NULL,
    "requesting_company_id" UUID NOT NULL,
    "material_request_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "status" "material_request_receiving_status" NOT NULL DEFAULT 'draft',
    "receipt_seq" INTEGER,
    "receiving_no" VARCHAR(64),
    "notes" VARCHAR(1000) NOT NULL DEFAULT '',
    "created_by" UUID NOT NULL,
    "posted_by" UUID,
    "posted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "material_request_receiving_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "material_request_receiving_item" (
    "id" UUID NOT NULL,
    "material_request_receiving_id" UUID NOT NULL,
    "material_request_item_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "content_per_unit" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "base_qty" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "material_request_receiving_item_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "material_request_receiving_requesting_company_id_receipt_seq_key" ON "material_request_receiving"("requesting_company_id", "receipt_seq");
CREATE UNIQUE INDEX "material_request_receiving_receiving_no_key" ON "material_request_receiving"("receiving_no");
CREATE INDEX "material_request_receiving_material_request_id_idx" ON "material_request_receiving"("material_request_id");
CREATE INDEX "material_request_receiving_location_id_idx" ON "material_request_receiving"("location_id");
CREATE INDEX "material_request_receiving_status_idx" ON "material_request_receiving"("status");
CREATE INDEX "material_request_receiving_created_by_idx" ON "material_request_receiving"("created_by");
CREATE UNIQUE INDEX "material_request_receiving_one_draft" ON "material_request_receiving"("material_request_id") WHERE "status" = 'draft';

CREATE UNIQUE INDEX "mr_receiving_item_line_key" ON "material_request_receiving_item"("material_request_receiving_id", "material_request_item_id");
CREATE INDEX "material_request_receiving_item_material_request_item_id_idx" ON "material_request_receiving_item"("material_request_item_id");
CREATE INDEX "material_request_receiving_item_product_id_idx" ON "material_request_receiving_item"("product_id");
CREATE INDEX "material_request_receiving_item_unit_id_idx" ON "material_request_receiving_item"("unit_id");
CREATE INDEX "material_request_event_material_request_receiving_id_idx" ON "material_request_event"("material_request_receiving_id");

ALTER TABLE "material_request_receiving" ADD CONSTRAINT "material_request_receiving_requesting_company_id_fkey" FOREIGN KEY ("requesting_company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_request_receiving" ADD CONSTRAINT "material_request_receiving_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_request_receiving" ADD CONSTRAINT "material_request_receiving_request_fkey" FOREIGN KEY ("material_request_id", "location_id", "requesting_company_id") REFERENCES "material_request"("id", "requesting_hub_id", "requesting_company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_request_receiving_item" ADD CONSTRAINT "mr_receiving_item_receiving_fkey" FOREIGN KEY ("material_request_receiving_id") REFERENCES "material_request_receiving"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "material_request_receiving_item" ADD CONSTRAINT "mr_receiving_item_request_item_fkey" FOREIGN KEY ("material_request_item_id") REFERENCES "material_request_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_request_receiving_item" ADD CONSTRAINT "material_request_receiving_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_request_receiving_item" ADD CONSTRAINT "material_request_receiving_item_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "measurement_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_request_event" ADD CONSTRAINT "material_request_event_receiving_fkey" FOREIGN KEY ("material_request_receiving_id") REFERENCES "material_request_receiving"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "material_request" ADD CONSTRAINT "material_request_number_status" CHECK ((status = 'draft' AND request_no IS NULL AND submitted_at IS NULL) OR status = 'cancelled' OR (status <> 'draft' AND request_no IS NOT NULL AND submitted_at IS NOT NULL));
ALTER TABLE "material_request" ADD CONSTRAINT "material_request_approved_warehouse" CHECK (status NOT IN ('approved', 'partially_received', 'received', 'closed') OR supplying_warehouse_id IS NOT NULL);
ALTER TABLE "material_request_item" ADD CONSTRAINT "material_request_received_qty" CHECK (received_qty >= 0 AND ((approved_qty IS NULL AND received_qty = 0) OR (approved_qty IS NOT NULL AND received_qty <= approved_qty)));
ALTER TABLE "material_request_receiving" ADD CONSTRAINT "material_request_receiving_posted_fields" CHECK (
    ("status" = 'draft' AND "posted_at" IS NULL AND "posted_by" IS NULL AND "receipt_seq" IS NULL AND "receiving_no" IS NULL)
    OR ("status" = 'posted' AND "posted_at" IS NOT NULL AND "posted_by" IS NOT NULL AND "receipt_seq" IS NOT NULL AND "receiving_no" IS NOT NULL)
);
ALTER TABLE "material_request_receiving_item" ADD CONSTRAINT "material_request_receiving_item_qty_positive" CHECK ("qty" > 0);
ALTER TABLE "material_request_receiving_item" ADD CONSTRAINT "material_request_receiving_item_content_positive" CHECK ("content_per_unit" > 0);
ALTER TABLE "material_request_receiving_item" ADD CONSTRAINT "material_request_receiving_item_base_qty_positive" CHECK ("base_qty" > 0);

ALTER TABLE "material_request_receiving" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "material_request_receiving_item" ENABLE ROW LEVEL SECURITY;

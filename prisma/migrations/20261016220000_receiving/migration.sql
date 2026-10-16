CREATE TYPE "purchase_order_status_new" AS ENUM ('draft', 'awaiting_receipt', 'partially_received', 'received', 'closed');

ALTER TABLE "purchase_order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "purchase_order"
  ALTER COLUMN "status" TYPE "purchase_order_status_new"
  USING (
    CASE "status"::text
      WHEN 'open' THEN 'awaiting_receipt'
      ELSE "status"::text
    END
  )::"purchase_order_status_new";
ALTER TABLE "purchase_order" ALTER COLUMN "status" SET DEFAULT 'draft';

DROP TYPE "purchase_order_status";
ALTER TYPE "purchase_order_status_new" RENAME TO "purchase_order_status";

CREATE TYPE "purchase_order_event_kind" AS ENUM ('created', 'confirmed', 'receipt_posted', 'closed');
CREATE TYPE "receiving_status" AS ENUM ('draft', 'posted');

CREATE TABLE "purchase_order_event" (
    "id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "receiving_id" UUID,
    "kind" "purchase_order_event_kind" NOT NULL,
    "status" "purchase_order_status" NOT NULL,
    "note" VARCHAR(160) NOT NULL DEFAULT '',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "receiving" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "status" "receiving_status" NOT NULL DEFAULT 'draft',
    "notes" VARCHAR(1000) NOT NULL DEFAULT '',
    "created_by" UUID,
    "posted_by" UUID,
    "posted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "receiving_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "receiving_item" (
    "id" UUID NOT NULL,
    "receiving_id" UUID NOT NULL,
    "purchase_order_item_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "content_per_unit" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "base_qty" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "receiving_item_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "purchase_order_event_purchase_order_id_created_at_idx" ON "purchase_order_event"("purchase_order_id", "created_at");
CREATE INDEX "purchase_order_event_receiving_id_idx" ON "purchase_order_event"("receiving_id");
CREATE INDEX "purchase_order_event_created_by_idx" ON "purchase_order_event"("created_by");

CREATE INDEX "receiving_company_id_idx" ON "receiving"("company_id");
CREATE INDEX "receiving_purchase_order_id_idx" ON "receiving"("purchase_order_id");
CREATE INDEX "receiving_location_id_idx" ON "receiving"("location_id");
CREATE INDEX "receiving_status_idx" ON "receiving"("status");
CREATE INDEX "receiving_created_by_idx" ON "receiving"("created_by");
CREATE UNIQUE INDEX "receiving_one_draft_per_order" ON "receiving"("purchase_order_id") WHERE "status" = 'draft';

CREATE UNIQUE INDEX "receiving_item_receiving_id_purchase_order_item_id_key" ON "receiving_item"("receiving_id", "purchase_order_item_id");
CREATE INDEX "receiving_item_purchase_order_item_id_idx" ON "receiving_item"("purchase_order_item_id");
CREATE INDEX "receiving_item_product_id_idx" ON "receiving_item"("product_id");
CREATE INDEX "receiving_item_unit_id_idx" ON "receiving_item"("unit_id");

ALTER TABLE "receiving" ADD CONSTRAINT "receiving_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receiving" ADD CONSTRAINT "receiving_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receiving" ADD CONSTRAINT "receiving_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receiving_item" ADD CONSTRAINT "receiving_item_receiving_id_fkey" FOREIGN KEY ("receiving_id") REFERENCES "receiving"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "receiving_item" ADD CONSTRAINT "receiving_item_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "purchase_order_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receiving_item" ADD CONSTRAINT "receiving_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receiving_item" ADD CONSTRAINT "receiving_item_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "measurement_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order_event" ADD CONSTRAINT "purchase_order_event_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_order_event" ADD CONSTRAINT "purchase_order_event_receiving_id_fkey" FOREIGN KEY ("receiving_id") REFERENCES "receiving"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "receiving" ADD CONSTRAINT "receiving_posted_fields" CHECK (
    ("status" = 'draft' AND "posted_at" IS NULL AND "posted_by" IS NULL)
    OR ("status" = 'posted' AND "posted_at" IS NOT NULL)
);
ALTER TABLE "receiving_item" ADD CONSTRAINT "receiving_item_qty_positive" CHECK ("qty" > 0);
ALTER TABLE "receiving_item" ADD CONSTRAINT "receiving_item_content_positive" CHECK ("content_per_unit" > 0);
ALTER TABLE "receiving_item" ADD CONSTRAINT "receiving_item_base_qty_positive" CHECK ("base_qty" > 0);

ALTER TABLE "purchase_order_event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "receiving" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "receiving_item" ENABLE ROW LEVEL SECURITY;

INSERT INTO "role_pages" ("role_id", "page_key")
SELECT "role_id", 'receiving'
FROM "role_pages"
WHERE "page_key" = 'purchaseOrders'
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_key", "access_scope")
SELECT "role_id", replace("permission_key", 'purchaseOrders.', 'receiving.'), "access_scope"
FROM "role_permissions"
WHERE "permission_key" LIKE 'purchaseOrders.%'
ON CONFLICT DO NOTHING;

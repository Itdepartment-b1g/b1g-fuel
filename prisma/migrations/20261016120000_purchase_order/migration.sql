CREATE TYPE "purchase_order_status" AS ENUM ('draft', 'open', 'closed');

CREATE TABLE "purchase_order" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "created_by" UUID,
    "status" "purchase_order_status" NOT NULL DEFAULT 'draft',
    "payment_terms" VARCHAR(160) NOT NULL DEFAULT '',
    "payment_method" VARCHAR(32),
    "estimated_delivery_at" TIMESTAMPTZ(6),
    "notes" VARCHAR(1000) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "purchase_order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_order_item" (
    "id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "ordered_qty" DECIMAL(14,3) NOT NULL,
    "received_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_order_item_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "purchase_order_created_by_idx" ON "purchase_order"("created_by");
CREATE INDEX "purchase_order_company_id_idx" ON "purchase_order"("company_id");
CREATE INDEX "purchase_order_location_id_idx" ON "purchase_order"("location_id");
CREATE INDEX "purchase_order_supplier_id_idx" ON "purchase_order"("supplier_id");
CREATE INDEX "purchase_order_status_idx" ON "purchase_order"("status");

CREATE UNIQUE INDEX "purchase_order_item_purchase_order_id_product_id_key" ON "purchase_order_item"("purchase_order_id", "product_id");
CREATE INDEX "purchase_order_item_product_id_idx" ON "purchase_order_item"("product_id");
CREATE INDEX "purchase_order_item_unit_id_idx" ON "purchase_order_item"("unit_id");

ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "measurement_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_payment_method_valid" CHECK (
    "payment_method" IS NULL OR "payment_method" IN ('cash', 'bank_transfer', 'gcash', 'check')
);
ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_ordered_qty_positive" CHECK ("ordered_qty" > 0);
ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_received_qty_nonnegative" CHECK ("received_qty" >= 0);

ALTER TABLE "purchase_order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase_order_item" ENABLE ROW LEVEL SECURITY;

-- CreateEnum
CREATE TYPE "material_request_status" AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "material_request_event_kind" AS ENUM ('created', 'updated', 'submitted', 'approved', 'rejected', 'cancelled');

-- AlterTable
ALTER TABLE "company" ADD COLUMN     "code" VARCHAR(16);

-- CreateTable
CREATE TABLE "material_request" (
    "id" UUID NOT NULL,
    "request_no" VARCHAR(64),
    "supply_relationship_id" UUID NOT NULL,
    "requesting_company_id" UUID NOT NULL,
    "supplying_company_id" UUID NOT NULL,
    "requesting_hub_id" UUID NOT NULL,
    "supplying_warehouse_id" UUID,
    "status" "material_request_status" NOT NULL DEFAULT 'draft',
    "notes" VARCHAR(1000) NOT NULL DEFAULT '',
    "needed_at" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,
    "submitted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "material_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_request_item" (
    "id" UUID NOT NULL,
    "material_request_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "requested_qty" DECIMAL(14,3) NOT NULL,
    "approved_qty" DECIMAL(14,3),
    "product_label" VARCHAR(600) NOT NULL,
    "unit_label" VARCHAR(120) NOT NULL,

    CONSTRAINT "material_request_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_request_event" (
    "id" UUID NOT NULL,
    "material_request_id" UUID NOT NULL,
    "kind" "material_request_event_kind" NOT NULL,
    "from_status" "material_request_status",
    "to_status" "material_request_status" NOT NULL,
    "note" VARCHAR(1000) NOT NULL DEFAULT '',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_request_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_request_counter" (
    "company_id" UUID NOT NULL,
    "period" VARCHAR(6) NOT NULL,
    "last_value" INTEGER NOT NULL,

    CONSTRAINT "material_request_counter_pkey" PRIMARY KEY ("company_id","period")
);

-- CreateIndex
CREATE UNIQUE INDEX "material_request_request_no_key" ON "material_request"("request_no");

-- CreateIndex
CREATE INDEX "material_request_requesting_company_id_created_at_idx" ON "material_request"("requesting_company_id", "created_at");

-- CreateIndex
CREATE INDEX "material_request_supplying_company_id_status_created_at_idx" ON "material_request"("supplying_company_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "material_request_requesting_hub_id_idx" ON "material_request"("requesting_hub_id");

-- CreateIndex
CREATE INDEX "material_request_supplying_warehouse_id_idx" ON "material_request"("supplying_warehouse_id");

-- CreateIndex
CREATE INDEX "material_request_supply_relationship_id_idx" ON "material_request"("supply_relationship_id");

-- CreateIndex
CREATE INDEX "material_request_created_by_idx" ON "material_request"("created_by");

-- CreateIndex
CREATE INDEX "material_request_item_product_id_idx" ON "material_request_item"("product_id");

-- CreateIndex
CREATE INDEX "material_request_item_unit_id_idx" ON "material_request_item"("unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_request_item_material_request_id_product_id_key" ON "material_request_item"("material_request_id", "product_id");

-- CreateIndex
CREATE INDEX "material_request_event_material_request_id_created_at_idx" ON "material_request_event"("material_request_id", "created_at");

-- CreateIndex
CREATE INDEX "material_request_event_created_by_idx" ON "material_request_event"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "company_code_key" ON "company"("code");

-- AddForeignKey
ALTER TABLE "material_request" ADD CONSTRAINT "material_request_supply_relationship_id_fkey" FOREIGN KEY ("supply_relationship_id") REFERENCES "company_supply_relationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request" ADD CONSTRAINT "material_request_requesting_company_id_fkey" FOREIGN KEY ("requesting_company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request" ADD CONSTRAINT "material_request_supplying_company_id_fkey" FOREIGN KEY ("supplying_company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request" ADD CONSTRAINT "material_request_requesting_hub_id_fkey" FOREIGN KEY ("requesting_hub_id") REFERENCES "location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request" ADD CONSTRAINT "material_request_supplying_warehouse_id_fkey" FOREIGN KEY ("supplying_warehouse_id") REFERENCES "location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_item" ADD CONSTRAINT "material_request_item_material_request_id_fkey" FOREIGN KEY ("material_request_id") REFERENCES "material_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_item" ADD CONSTRAINT "material_request_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_item" ADD CONSTRAINT "material_request_item_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "measurement_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_event" ADD CONSTRAINT "material_request_event_material_request_id_fkey" FOREIGN KEY ("material_request_id") REFERENCES "material_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_counter" ADD CONSTRAINT "material_request_counter_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

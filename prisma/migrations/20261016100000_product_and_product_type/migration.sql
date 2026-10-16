-- CreateTable
CREATE TABLE "product_type" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "created_by" UUID,
    "name" VARCHAR(160) NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "base_unit_id" UUID NOT NULL,
    "product_type_id" UUID NOT NULL,
    "created_by" UUID,
    "note" VARCHAR(160) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_type_created_by_idx" ON "product_type"("created_by");
CREATE INDEX "product_type_company_id_idx" ON "product_type"("company_id");
CREATE UNIQUE INDEX "product_type_company_id_key_key" ON "product_type"("company_id", "key");
CREATE UNIQUE INDEX "product_type_company_id_name_key" ON "product_type"("company_id", "name");
CREATE UNIQUE INDEX "product_type_global_key_key" ON "product_type"("key") WHERE "company_id" IS NULL;
CREATE UNIQUE INDEX "product_type_global_name_key" ON "product_type"("name") WHERE "company_id" IS NULL;

CREATE INDEX "product_created_by_idx" ON "product"("created_by");
CREATE INDEX "product_company_id_idx" ON "product"("company_id");
CREATE INDEX "product_variant_id_idx" ON "product"("variant_id");
CREATE INDEX "product_base_unit_id_idx" ON "product"("base_unit_id");
CREATE INDEX "product_product_type_id_idx" ON "product"("product_type_id");
CREATE UNIQUE INDEX "product_company_id_variant_id_product_type_id_key" ON "product"("company_id", "variant_id", "product_type_id");

-- AddForeignKey
ALTER TABLE "product_type" ADD CONSTRAINT "product_type_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product" ADD CONSTRAINT "product_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product" ADD CONSTRAINT "product_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product" ADD CONSTRAINT "product_base_unit_id_fkey" FOREIGN KEY ("base_unit_id") REFERENCES "measurement_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product" ADD CONSTRAINT "product_product_type_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "product_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_type" ADD CONSTRAINT "product_type_name_nonempty" CHECK (length(btrim("name")) > 0);
ALTER TABLE "product_type" ADD CONSTRAINT "product_type_key_nonempty" CHECK (length(btrim("key")) > 0);

ALTER TABLE "product_type" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product" ENABLE ROW LEVEL SECURITY;

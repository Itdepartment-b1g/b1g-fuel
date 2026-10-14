-- CreateTable
CREATE TABLE "brand" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "company_id" UUID,

    CONSTRAINT "brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant" (
    "id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "company_id" UUID,

    CONSTRAINT "variant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brand_created_by_idx" ON "brand"("created_by");

-- CreateIndex
CREATE INDEX "brand_company_id_idx" ON "brand"("company_id");

-- CreateIndex
CREATE INDEX "variant_created_by_idx" ON "variant"("created_by");

-- CreateIndex
CREATE INDEX "variant_company_id_idx" ON "variant"("company_id");

-- AddForeignKey
ALTER TABLE "brand" ADD CONSTRAINT "brand_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant" ADD CONSTRAINT "variant_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant" ADD CONSTRAINT "variant_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

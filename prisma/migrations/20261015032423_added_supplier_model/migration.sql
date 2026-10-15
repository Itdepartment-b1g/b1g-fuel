-- CreateTable
CREATE TABLE "supplier" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "created_by" UUID,
    "name" VARCHAR(160) NOT NULL,
    "contact_person" VARCHAR(160) NOT NULL,
    "contact_email" VARCHAR(160) NOT NULL,
    "contact_phone" VARCHAR(160) NOT NULL,
    "contact_address" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_created_by_idx" ON "supplier"("created_by");

-- CreateIndex
CREATE INDEX "supplier_company_id_idx" ON "supplier"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_company_id_name_key" ON "supplier"("company_id", "name");

-- AddForeignKey
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

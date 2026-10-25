ALTER TABLE "brand" ADD COLUMN "supplier_id" UUID;

CREATE INDEX "brand_supplier_id_idx" ON "brand"("supplier_id");

ALTER TABLE "brand" ADD CONSTRAINT "brand_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

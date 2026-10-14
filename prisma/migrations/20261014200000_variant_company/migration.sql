-- A variant stores the creator's company. Super-admin variants have no company, like shared brands.
ALTER TABLE "variant" ADD COLUMN "company_id" UUID;
ALTER TABLE "variant" ADD CONSTRAINT "variant_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "variant_company_id_idx" ON "variant"("company_id");

DROP INDEX "variant_brand_id_name_key";
DROP INDEX "variant_brand_name_ci_key";
CREATE UNIQUE INDEX "variant_brand_id_company_id_name_key" ON "variant"("brand_id", "company_id", "name");
CREATE UNIQUE INDEX "variant_brand_company_name_ci_key" ON "variant" ("brand_id", "company_id", lower("name"));
CREATE UNIQUE INDEX "variant_brand_global_name_key" ON "variant" ("brand_id", "name") WHERE "company_id" IS NULL;
CREATE UNIQUE INDEX "variant_brand_global_name_ci_key" ON "variant" ("brand_id", lower("name")) WHERE "company_id" IS NULL;

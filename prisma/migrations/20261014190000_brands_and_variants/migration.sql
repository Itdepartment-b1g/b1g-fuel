-- Variants take their company from the brand. Names are unique within a company or brand, ignoring case.
ALTER TABLE "variant" DROP CONSTRAINT "variant_company_id_fkey";
DROP INDEX "variant_company_id_idx";
ALTER TABLE "variant" DROP COLUMN "company_id";

CREATE INDEX "variant_brand_id_idx" ON "variant"("brand_id");
CREATE UNIQUE INDEX "brand_company_id_name_key" ON "brand"("company_id", "name");
CREATE UNIQUE INDEX "brand_company_name_ci_key" ON "brand" ("company_id", lower("name"));
CREATE UNIQUE INDEX "brand_global_name_key" ON "brand" ("name") WHERE "company_id" IS NULL;
CREATE UNIQUE INDEX "brand_global_name_ci_key" ON "brand" (lower("name")) WHERE "company_id" IS NULL;
CREATE UNIQUE INDEX "variant_brand_id_name_key" ON "variant"("brand_id", "name");
CREATE UNIQUE INDEX "variant_brand_name_ci_key" ON "variant" ("brand_id", lower("name"));

ALTER TABLE "brand" ADD CONSTRAINT "brand_name_nonempty" CHECK (length(btrim("name")) > 0);
ALTER TABLE "variant" ADD CONSTRAINT "variant_name_nonempty" CHECK (length(btrim("name")) > 0);

ALTER TABLE "brand" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "variant" ENABLE ROW LEVEL SECURITY;

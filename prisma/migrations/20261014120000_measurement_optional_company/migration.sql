-- Shared measurements created by a super admin have no owning company.
ALTER TABLE "measurement" ALTER COLUMN "company_id" DROP NOT NULL;

-- Unique indexes treat NULL company ids as distinct, so shared names need their own rules.
CREATE UNIQUE INDEX "measurement_global_name_key" ON "measurement" ("name") WHERE "company_id" IS NULL;
CREATE UNIQUE INDEX "measurement_global_name_ci_key" ON "measurement" (lower("name")) WHERE "company_id" IS NULL;

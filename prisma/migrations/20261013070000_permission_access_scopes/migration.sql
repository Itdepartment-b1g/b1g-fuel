ALTER TABLE "user" ADD COLUMN "created_by" UUID;
ALTER TABLE "company" ADD COLUMN "created_by" UUID;
ALTER TABLE "roles" ADD COLUMN "created_by" UUID;
CREATE INDEX "user_created_by_idx" ON "user"("created_by");
CREATE INDEX "company_created_by_idx" ON "company"("created_by");
CREATE INDEX "roles_created_by_idx" ON "roles"("created_by");
ALTER TABLE "role_permissions" ADD COLUMN "access_scope" VARCHAR(16) NOT NULL DEFAULT 'company';
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_access_scope_check"
  CHECK ("access_scope" IN ('all', 'company', 'own'));
UPDATE "role_permissions" p SET "access_scope" = 'all'
  FROM "roles" r WHERE p."role_id" = r."id" AND r."scope" = 'global' AND p."permission_key" NOT LIKE '%.add';

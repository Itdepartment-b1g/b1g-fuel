ALTER TABLE "roles" ADD COLUMN "company_id" UUID;
CREATE INDEX "roles_company_id_idx" ON "roles"("company_id");
ALTER TABLE "roles" ADD CONSTRAINT "roles_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "roles" ADD CONSTRAINT "roles_company_scope_check"
  CHECK ("company_id" IS NULL OR "scope" = 'company');

-- Serialize membership assignments against changes to a role's company.
CREATE FUNCTION "check_role_company_assignment"() RETURNS trigger AS $$
DECLARE role_company UUID; membership_company UUID;
BEGIN
  SELECT "company_id" INTO role_company FROM "roles" WHERE "id" = NEW."role_id" FOR SHARE;
  SELECT "company_id" INTO membership_company FROM "user_company" WHERE "id" = NEW."user_company_id";
  IF role_company IS NOT NULL AND role_company IS DISTINCT FROM membership_company THEN
    RAISE EXCEPTION 'Role does not belong to the membership company' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "user_company_role_company_check" BEFORE INSERT OR UPDATE ON "user_company_role"
  FOR EACH ROW EXECUTE FUNCTION "check_role_company_assignment"();

CREATE FUNCTION "check_assigned_role_company_change"() RETURNS trigger AS $$
BEGIN
  IF NEW."company_id" IS DISTINCT FROM OLD."company_id"
     AND EXISTS (SELECT 1 FROM "user_company_role" WHERE "role_id" = OLD."id") THEN
    RAISE EXCEPTION 'Assigned role company cannot be changed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "roles_assigned_company_check" BEFORE UPDATE OF "company_id" ON "roles"
  FOR EACH ROW EXECUTE FUNCTION "check_assigned_role_company_change"();

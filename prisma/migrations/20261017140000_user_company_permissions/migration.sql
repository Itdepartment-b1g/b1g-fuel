-- Actions a supervisor checked for one staff membership.
CREATE TABLE "user_company_permission" (
    "user_company_id" UUID NOT NULL,
    "permission_key" VARCHAR(120) NOT NULL,
    "access_scope" VARCHAR(16) NOT NULL DEFAULT 'company',

    CONSTRAINT "user_company_permission_pkey" PRIMARY KEY ("user_company_id", "permission_key")
);

ALTER TABLE "user_company_permission" ADD CONSTRAINT "user_company_permission_user_company_id_fkey" FOREIGN KEY ("user_company_id") REFERENCES "user_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_company_permission" ADD CONSTRAINT "user_company_permission_access_scope_check"
  CHECK ("access_scope" IN ('all', 'company', 'own'));

ALTER TABLE "user_company_permission" ENABLE ROW LEVEL SECURITY;

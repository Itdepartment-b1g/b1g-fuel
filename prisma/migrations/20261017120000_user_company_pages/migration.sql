-- Membership page grants. role_pages keeps every page on the assigned role.
-- assigned_pages keeps only the rows in user_company_page.
CREATE TYPE "page_grant_mode" AS ENUM ('role_pages', 'assigned_pages');

ALTER TABLE "user_company" ADD COLUMN "page_grant_mode" "page_grant_mode" NOT NULL DEFAULT 'role_pages';

CREATE TABLE "user_company_page" (
    "user_company_id" UUID NOT NULL,
    "page_key" VARCHAR(120) NOT NULL,

    CONSTRAINT "user_company_page_pkey" PRIMARY KEY ("user_company_id", "page_key")
);

ALTER TABLE "user_company_page" ADD CONSTRAINT "user_company_page_user_company_id_fkey" FOREIGN KEY ("user_company_id") REFERENCES "user_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_company_page" ENABLE ROW LEVEL SECURITY;

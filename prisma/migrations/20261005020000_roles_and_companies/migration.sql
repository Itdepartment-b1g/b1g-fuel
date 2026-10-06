-- CreateEnum
CREATE TYPE "role_scope" AS ENUM ('global', 'company');

-- CreateTable
CREATE TABLE "user_role" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "scope" "role_scope" NOT NULL DEFAULT 'global',
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_role_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "company" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_company" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "scope" "role_scope" NOT NULL DEFAULT 'company',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_default_role" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_company_role" (
    "user_company_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "scope" "role_scope" NOT NULL DEFAULT 'company',
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_company_role_pkey" PRIMARY KEY ("user_company_id","role_id")
);

-- CreateTable
CREATE TABLE "role_pages" (
    "role_id" UUID NOT NULL,
    "page_key" VARCHAR(120) NOT NULL,

    CONSTRAINT "role_pages_pkey" PRIMARY KEY ("role_id","page_key")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_key" VARCHAR(120) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_key")
);

-- CreateIndex
CREATE INDEX "user_role_role_id_scope_idx" ON "user_role"("role_id", "scope");

-- CreateIndex
CREATE INDEX "user_company_company_id_idx" ON "user_company"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_company_user_id_company_id_key" ON "user_company"("user_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_slug_key" ON "roles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "roles_id_scope_key" ON "roles"("id", "scope");

-- CreateIndex
CREATE INDEX "user_company_role_role_id_scope_idx" ON "user_company_role"("role_id", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_scope_fkey" FOREIGN KEY ("role_id", "scope") REFERENCES "roles"("id", "scope") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_company" ADD CONSTRAINT "user_company_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_company" ADD CONSTRAINT "user_company_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_company_role" ADD CONSTRAINT "user_company_role_user_company_id_fkey" FOREIGN KEY ("user_company_id") REFERENCES "user_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_company_role" ADD CONSTRAINT "user_company_role_role_id_scope_fkey" FOREIGN KEY ("role_id", "scope") REFERENCES "roles"("id", "scope") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "role_pages" ADD CONSTRAINT "role_pages_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep assignment scope consistent with the role definition.
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_global_scope_check" CHECK ("scope" = 'global');
ALTER TABLE "user_company_role" ADD CONSTRAINT "user_company_role_company_scope_check" CHECK ("scope" = 'company');
ALTER TABLE "roles" ADD CONSTRAINT "roles_default_company_scope_check" CHECK (NOT "is_default_role" OR "scope" = 'company');
CREATE UNIQUE INDEX "roles_single_default_role_idx" ON "roles" ("is_default_role") WHERE "is_default_role" = true;

-- Prevent public Supabase Data API access; authorization is enforced by Express.
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_company" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_company_role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_pages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;

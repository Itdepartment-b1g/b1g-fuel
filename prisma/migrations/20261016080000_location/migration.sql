-- CreateTable
CREATE TABLE "location" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "created_by" UUID,
    "name" VARCHAR(160) NOT NULL,
    "type" VARCHAR(32) NOT NULL DEFAULT 'warehouse',
    "address" VARCHAR(160) NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "location_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "location_created_by_idx" ON "location"("created_by");

-- CreateIndex
CREATE INDEX "location_company_id_idx" ON "location"("company_id");

-- CreateIndex
CREATE INDEX "location_type_idx" ON "location"("type");

-- CreateIndex
CREATE UNIQUE INDEX "location_company_id_name_key" ON "location"("company_id", "name");

-- AddForeignKey
ALTER TABLE "location" ADD CONSTRAINT "location_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "location" ADD CONSTRAINT "location_name_nonempty" CHECK (length(btrim("name")) > 0);
ALTER TABLE "location" ADD CONSTRAINT "location_type_valid" CHECK ("type" IN ('warehouse', 'hub'));

ALTER TABLE "location" ENABLE ROW LEVEL SECURITY;

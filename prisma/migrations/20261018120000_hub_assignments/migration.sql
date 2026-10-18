CREATE UNIQUE INDEX "user_company_id_company_id_key" ON "user_company"("id", "company_id");
CREATE UNIQUE INDEX "location_id_company_id_key" ON "location"("id", "company_id");

CREATE TABLE "user_location" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_company_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "assigned_by" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_location_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_location_user_company_id_location_id_key" ON "user_location"("user_company_id", "location_id");
CREATE INDEX "user_location_location_id_company_id_idx" ON "user_location"("location_id", "company_id");
CREATE INDEX "user_location_user_company_id_company_id_idx" ON "user_location"("user_company_id", "company_id");
CREATE INDEX "user_location_assigned_by_idx" ON "user_location"("assigned_by");

ALTER TABLE "user_location" ADD CONSTRAINT "user_location_user_company_id_company_id_fkey"
    FOREIGN KEY ("user_company_id", "company_id") REFERENCES "user_company"("id", "company_id") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "user_location" ADD CONSTRAINT "user_location_location_id_company_id_fkey"
    FOREIGN KEY ("location_id", "company_id") REFERENCES "location"("id", "company_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Access is enforced by the authenticated Express API, consistent with other resource tables.
ALTER TABLE "user_location" ENABLE ROW LEVEL SECURITY;

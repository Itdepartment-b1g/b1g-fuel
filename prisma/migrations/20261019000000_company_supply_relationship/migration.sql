CREATE TABLE "company_supply_relationship" (
    "id" UUID NOT NULL,
    "requesting_company_id" UUID NOT NULL,
    "supplying_company_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "company_supply_relationship_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "company_supply_distinct_companies_check"
      CHECK ("requesting_company_id" <> "supplying_company_id")
);

CREATE UNIQUE INDEX "company_supply_requester_supplier_key"
    ON "company_supply_relationship"("requesting_company_id", "supplying_company_id");
CREATE INDEX "company_supply_supplier_active_idx"
    ON "company_supply_relationship"("supplying_company_id", "is_active");
CREATE INDEX "company_supply_created_by_idx"
    ON "company_supply_relationship"("created_by");

ALTER TABLE "company_supply_relationship" ADD CONSTRAINT "company_supply_requester_fkey"
    FOREIGN KEY ("requesting_company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_supply_relationship" ADD CONSTRAINT "company_supply_supplier_fkey"
    FOREIGN KEY ("supplying_company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Setup will be exposed through Super Admin-only API operations; no public database policies.
ALTER TABLE "company_supply_relationship" ENABLE ROW LEVEL SECURITY;

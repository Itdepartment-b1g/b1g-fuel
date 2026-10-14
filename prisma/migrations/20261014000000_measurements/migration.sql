-- CreateTable
CREATE TABLE "measurement" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "created_by" UUID,
    "name" VARCHAR(160) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurement_field" (
    "id" UUID NOT NULL,
    "measurement_id" UUID NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "measurement_field_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurement_unit" (
    "id" UUID NOT NULL,
    "measurement_id" UUID NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "measurement_unit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "measurement_created_by_idx" ON "measurement"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_company_id_name_key" ON "measurement"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_field_measurement_id_key_key" ON "measurement_field"("measurement_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_unit_measurement_id_key_key" ON "measurement_unit"("measurement_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_unit_measurement_id_symbol_key" ON "measurement_unit"("measurement_id", "symbol");

-- AddForeignKey
ALTER TABLE "measurement" ADD CONSTRAINT "measurement_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurement_field" ADD CONSTRAINT "measurement_field_measurement_id_fkey" FOREIGN KEY ("measurement_id") REFERENCES "measurement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurement_unit" ADD CONSTRAINT "measurement_unit_measurement_id_fkey" FOREIGN KEY ("measurement_id") REFERENCES "measurement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prevent duplicate display names and symbols regardless of capitalization.
CREATE UNIQUE INDEX "measurement_company_name_ci_key" ON "measurement" ("company_id", lower("name"));
CREATE UNIQUE INDEX "measurement_unit_symbol_ci_key" ON "measurement_unit" ("measurement_id", lower("symbol"));
ALTER TABLE "measurement" ADD CONSTRAINT "measurement_name_nonempty" CHECK (length(btrim("name")) > 0);
ALTER TABLE "measurement_field" ADD CONSTRAINT "measurement_field_valid" CHECK (
    "key" ~ '^[a-z][a-z0-9_]*$' AND length(btrim("label")) > 0 AND "position" BETWEEN 0 AND 1000
);
ALTER TABLE "measurement_unit" ADD CONSTRAINT "measurement_unit_valid" CHECK (
    "key" ~ '^[a-z][a-z0-9_]*$' AND length(btrim("name")) > 0 AND length(btrim("symbol")) > 0 AND "position" BETWEEN 0 AND 1000
);

-- Access goes through the authenticated Express API, as with existing catalog tables.
ALTER TABLE "measurement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "measurement_field" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "measurement_unit" ENABLE ROW LEVEL SECURITY;

-- Units are name and symbol only. Archive stays on the measurement.
ALTER TABLE "measurement_unit" DROP CONSTRAINT "measurement_unit_valid";
ALTER TABLE "measurement_unit" DROP COLUMN "is_active";
ALTER TABLE "measurement_unit" DROP COLUMN "position";
ALTER TABLE "measurement_unit" ADD CONSTRAINT "measurement_unit_valid" CHECK (
    "key" ~ '^[a-z][a-z0-9_]*$' AND length(btrim("name")) > 0 AND length(btrim("symbol")) > 0
);

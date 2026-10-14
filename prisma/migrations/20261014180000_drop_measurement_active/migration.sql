-- Measurements are deleted instead of archived.
ALTER TABLE "measurement" DROP COLUMN "is_active";

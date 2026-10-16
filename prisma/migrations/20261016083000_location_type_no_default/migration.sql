-- Require callers to set location.type explicitly (e.g. warehouse on company create).
ALTER TABLE "location" ALTER COLUMN "type" DROP DEFAULT;

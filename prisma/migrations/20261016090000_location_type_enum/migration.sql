-- Replace varchar location.type with a Postgres enum (warehouse | hub).
ALTER TABLE "location" DROP CONSTRAINT IF EXISTS "location_type_valid";

CREATE TYPE "location_type" AS ENUM ('warehouse', 'hub');

ALTER TABLE "location"
  ALTER COLUMN "type" TYPE "location_type"
  USING ("type"::"location_type");

CREATE TABLE "user_location_history" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "user_company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(250) NOT NULL,
    "email" TEXT,
    "user_created_at" TIMESTAMPTZ(6) NOT NULL,
    "assigned_by" UUID NOT NULL,
    "assigned_by_name" VARCHAR(250),
    "assigned_at" TIMESTAMPTZ(6) NOT NULL,
    "unassigned_at" TIMESTAMPTZ(6),
    CONSTRAINT "user_location_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_location_history_date_check" CHECK ("unassigned_at" IS NULL OR "unassigned_at" >= "assigned_at")
);
CREATE INDEX "user_location_history_location_id_company_id_idx" ON "user_location_history"("location_id", "company_id");
CREATE INDEX "user_location_history_location_id_user_created_at_assigned_at_idx" ON "user_location_history"("location_id", "user_created_at", "assigned_at");
ALTER TABLE "user_location_history" ADD CONSTRAINT "user_location_history_location_id_company_id_fkey"
    FOREIGN KEY ("location_id", "company_id") REFERENCES "location"("id", "company_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "user_location_history" ENABLE ROW LEVEL SECURITY;

-- Preserve current assignments; previously deleted assignments have no recoverable dates.
INSERT INTO "user_location_history" (
    "id", "company_id", "location_id", "user_company_id", "user_id", "name", "email", "user_created_at",
    "assigned_by", "assigned_by_name", "assigned_at"
)
SELECT a."id", a."company_id", a."location_id", a."user_company_id", u."id", u."name", u."email", u."created_at",
       a."assigned_by", actor."name", a."assigned_at"
FROM "user_location" a
JOIN "user_company" membership ON membership."id" = a."user_company_id"
JOIN "user" u ON u."id" = membership."user_id"
LEFT JOIN "user" actor ON actor."id" = a."assigned_by";

-- Database triggers also cover membership-cascade removals and keep audit writes atomic.
CREATE FUNCTION record_user_location_history() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "user_location_history" (
      "id", "company_id", "location_id", "user_company_id", "user_id", "name", "email", "user_created_at",
      "assigned_by", "assigned_by_name", "assigned_at"
    )
    SELECT NEW."id", NEW."company_id", NEW."location_id", NEW."user_company_id", u."id", u."name", u."email", u."created_at",
           NEW."assigned_by", actor."name", NEW."assigned_at"
    FROM "user_company" membership
    JOIN "user" u ON u."id" = membership."user_id"
    LEFT JOIN "user" actor ON actor."id" = NEW."assigned_by"
    WHERE membership."id" = NEW."user_company_id";
    RETURN NEW;
  END IF;
  UPDATE "user_location_history"
    SET "unassigned_at" = GREATEST(clock_timestamp(), OLD."assigned_at")
    WHERE "id" = OLD."id" AND "unassigned_at" IS NULL;
  RETURN OLD;
END;
$$;
CREATE TRIGGER user_location_history_insert AFTER INSERT ON "user_location"
  FOR EACH ROW EXECUTE FUNCTION record_user_location_history();
CREATE TRIGGER user_location_history_delete AFTER DELETE ON "user_location"
  FOR EACH ROW EXECUTE FUNCTION record_user_location_history();

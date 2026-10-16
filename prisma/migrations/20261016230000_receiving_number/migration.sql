ALTER TABLE "receiving" ADD COLUMN "receipt_seq" INTEGER;
ALTER TABLE "receiving" ADD COLUMN "receiving_no" VARCHAR(32);

WITH numbered AS (
  SELECT
    r.id,
    ROW_NUMBER() OVER (PARTITION BY r.company_id ORDER BY r.posted_at, r.id) AS seq,
    UPPER(SUBSTRING(COALESCE(NULLIF(regexp_replace(lower(c.name), '[^a-z0-9]', '', 'g'), ''), 'xx') FROM 1 FOR 2)) AS code,
    to_char(r.posted_at AT TIME ZONE 'Asia/Manila', 'YYYYMM') AS year_month
  FROM "receiving" r
  JOIN "company" c ON c.id = r.company_id
  WHERE r.status = 'posted' AND r.posted_at IS NOT NULL
)
UPDATE "receiving" AS r
SET
  receipt_seq = numbered.seq,
  receiving_no = 'RR-' || RPAD(numbered.code, 2, 'X') || '-' || numbered.year_month || '-' || LPAD(numbered.seq::text, 7, '0')
FROM numbered
WHERE r.id = numbered.id;

ALTER TABLE "receiving" ADD CONSTRAINT "receiving_number_check" CHECK (
  (status = 'draft' AND receipt_seq IS NULL AND receiving_no IS NULL)
  OR (status = 'posted' AND receipt_seq IS NOT NULL AND receiving_no IS NOT NULL)
);

CREATE UNIQUE INDEX "receiving_company_id_receipt_seq_key" ON "receiving"("company_id", "receipt_seq");
CREATE UNIQUE INDEX "receiving_receiving_no_key" ON "receiving"("receiving_no");

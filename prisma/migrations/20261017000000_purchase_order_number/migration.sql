ALTER TABLE "purchase_order" ADD COLUMN "order_seq" INTEGER;
ALTER TABLE "purchase_order" ADD COLUMN "purchase_order_no" VARCHAR(48);

CREATE OR REPLACE FUNCTION purchase_order_company_code(raw text) RETURNS text AS $$
DECLARE
  word text;
  initials text := '';
  extra text := '';
BEGIN
  FOREACH word IN ARRAY regexp_split_to_array(upper(raw), '[^A-Z0-9]+')
  LOOP
    IF word IS NULL OR word = '' THEN
      CONTINUE;
    END IF;
    initials := initials || substr(word, 1, 1);
    extra := extra || substr(word, 2);
  END LOOP;
  IF length(initials) >= 3 THEN
    RETURN initials;
  END IF;
  RETURN substr(initials || extra || 'XXX', 1, 3);
END;
$$ LANGUAGE plpgsql;

WITH numbered AS (
  SELECT
    p.id,
    ROW_NUMBER() OVER (PARTITION BY p.company_id ORDER BY p.created_at, p.id) AS seq,
    purchase_order_company_code(c.name) AS code,
    to_char(p.created_at AT TIME ZONE 'Asia/Manila', 'YYYYMM') AS year_month
  FROM "purchase_order" p
  JOIN "company" c ON c.id = p.company_id
)
UPDATE "purchase_order" AS p
SET
  order_seq = numbered.seq,
  purchase_order_no = 'PO-' || numbered.code || '-' || numbered.year_month || '-' || LPAD(numbered.seq::text, 7, '0')
FROM numbered
WHERE p.id = numbered.id;

DROP FUNCTION purchase_order_company_code(text);

ALTER TABLE "purchase_order" ALTER COLUMN "order_seq" SET NOT NULL;
ALTER TABLE "purchase_order" ALTER COLUMN "purchase_order_no" SET NOT NULL;

CREATE UNIQUE INDEX "purchase_order_company_id_order_seq_key" ON "purchase_order"("company_id", "order_seq");
CREATE UNIQUE INDEX "purchase_order_purchase_order_no_key" ON "purchase_order"("purchase_order_no");

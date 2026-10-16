UPDATE "receiving" AS r
SET receiving_no = 'RR-' || RPAD(
  UPPER(SUBSTRING(COALESCE(NULLIF(regexp_replace(lower(c.name), '[^a-z0-9]', '', 'g'), ''), 'xxx') FROM 1 FOR 3)),
  3,
  'X'
) || '-' || to_char(r.posted_at AT TIME ZONE 'Asia/Manila', 'YYYYMM') || '-' || LPAD(r.receipt_seq::text, 7, '0')
FROM "company" c
WHERE r.company_id = c.id
  AND r.status = 'posted'
  AND r.receipt_seq IS NOT NULL
  AND r.posted_at IS NOT NULL;

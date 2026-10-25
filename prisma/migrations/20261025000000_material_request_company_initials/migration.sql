BEGIN;
CREATE UNIQUE INDEX "material_request_requesting_company_id_request_no_key" ON "material_request"("requesting_company_id", "request_no");
DROP INDEX "material_request_request_no_key";
COMMIT;

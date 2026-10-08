import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "./pagination";
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ content: { "application/json": { schema } } });
const error = { description: "Request failed", ...json(ref("Error")) };
const errors = { "400": error, "401": error, "403": error, "404": error, "409": error, "500": error };
const name = { type: "string", minLength: 1, maxLength: 160, example: "B1G Fuel Manila" };
const id = { type: "string", format: "uuid" };
export const companySchemas = {
  Company: { type: "object", required: ["id", "name", "created_at", "updated_at", "member_count"], properties: { id, name, created_at: { type: "string", format: "date-time" }, updated_at: { type: "string", format: "date-time" }, member_count: { type: "integer", minimum: 0, readOnly: true } } },
  CompaniesPage: { type: "object", required: ["companies", "total", "page", "page_size"], properties: { companies: { type: "array", items: ref("Company") }, total: { type: "integer" }, page: { type: "integer" }, page_size: { type: "integer", enum: [...PAGE_SIZE_OPTIONS] } } },
  CompanyResponse: { type: "object", required: ["company"], properties: { company: ref("Company") } },
  CreateCompany: { type: "object", additionalProperties: false, required: ["name"], properties: { name } },
  UpdateCompany: { type: "object", additionalProperties: false, required: ["id", "name"], properties: { id, name } },
  DeleteCompanyResponse: { type: "object", required: ["id", "message"], properties: { id, message: { type: "string" } } },
};
export const companyPaths = {
  "/api/companies": {
    get: { tags: ["Companies"], security: [{ session: [] }], summary: "List companies or load one for editing (super_admin only)", parameters: [
      { name: "id", in: "query", schema: id, description: "When provided, returns one company and ignores list filters." },
      { name: "page", in: "query", schema: { type: "integer", minimum: 1, maximum: 1000000, default: 1 } },
      { name: "page_size", in: "query", schema: { type: "integer", enum: [...PAGE_SIZE_OPTIONS], default: DEFAULT_PAGE_SIZE } },
      { name: "search", in: "query", schema: { type: "string", maxLength: 160 }, description: "Case-insensitive company-name search" },
    ], responses: { "200": { description: "Companies with membership counts", ...json({ oneOf: [ref("CompaniesPage"), ref("CompanyResponse")] }) }, ...errors } },
    post: { tags: ["Companies"], security: [{ session: [] }], summary: "Create company (super_admin only)", requestBody: { required: true, ...json(ref("CreateCompany")) }, responses: { "201": { description: "Company created", ...json(ref("CompanyResponse")) }, ...errors } },
    patch: { tags: ["Companies"], security: [{ session: [] }], summary: "Rename company (super_admin only)", requestBody: { required: true, ...json(ref("UpdateCompany")) }, responses: { "200": { description: "Company updated; memberships preserved", ...json(ref("CompanyResponse")) }, ...errors } },
    delete: { tags: ["Companies"], security: [{ session: [] }], summary: "Delete empty company (super_admin only)", description: "Requires APP_ORIGIN. Companies with memberships return 409; membership creation is protected by a transaction lock during the check/delete workflow.", parameters: [{ name: "id", in: "query", required: true, schema: id }], responses: { "200": { description: "Company deleted", ...json(ref("DeleteCompanyResponse")) }, ...errors } },
  },
};

const uuid = { type: "string", format: "uuid" };
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ content: { "application/json": { schema } } });
const body = (schema: object) => ({ required: true, ...json(schema) });
const query = (name: string, schema: object, required = false) => ({ name, in: "query", required, schema });
const company = { type: "object", required: ["id", "name"], properties: { id: uuid, name: { type: "string" } } };
const metadata = { total: { type: "integer" }, page: { type: "integer" }, page_size: { type: "integer" } };
const error = { description: "Request failed", ...json(ref("Error")) };
const errors = { "400": error, "401": error, "403": error, "404": error, "409": error, "500": error };
const parameters = [
  query("company_id", uuid, true),
  query("direction", { type: "string", enum: ["requesting", "supplying"], default: "requesting", description: "requesting: suppliers for this company; supplying: companies supplied by this company." }),
  query("search", { type: "string", maxLength: 160 }),
  query("page", { type: "integer", minimum: 1, default: 1 }),
  query("page_size", { type: "integer", enum: [10, 20, 50, 100], default: 10 }),
];
export const companySupplySchemas = {
  CompanySupplyRelationship: {
    type: "object",
    required: ["id", "requesting_company_id", "supplying_company_id", "requesting_company", "supplying_company", "is_active", "created_by", "created_by_name", "created_at", "updated_at"],
    properties: {
      id: uuid, requesting_company_id: uuid, supplying_company_id: uuid,
      requesting_company: company, supplying_company: company, is_active: { type: "boolean" },
      created_by: uuid, created_by_name: { type: "string", nullable: true },
      created_at: { type: "string", format: "date-time" }, updated_at: { type: "string", format: "date-time" },
    },
  },
  CreateCompanySupply: {
    type: "object", additionalProperties: false, required: ["requesting_company_id", "supplying_company_id"],
    properties: { requesting_company_id: uuid, supplying_company_id: uuid },
  },
  UpdateCompanySupply: {
    type: "object", additionalProperties: false, required: ["id", "is_active"],
    properties: { id: uuid, is_active: { type: "boolean" } },
  },
};
export const companySupplyPaths = {
  "/api/company-supply-relationships": {
    get: {
      tags: ["Company supply"], summary: "List a company's supply links", security: [{ session: [] }],
      description: "Super Admin only, regardless of company permissions. Links are directed and newest first. Search matches the counterpart company's name.",
      parameters: [...parameters, query("status", { type: "string", enum: ["all", "active", "inactive"], default: "all" })],
      responses: { "200": { description: "Paginated supply links", ...json({ type: "object", required: ["relationships", "total", "page", "page_size"], properties: { relationships: { type: "array", items: ref("CompanySupplyRelationship") }, ...metadata } }) }, ...errors },
    },
    post: {
      tags: ["Company supply"], summary: "Link a requester to a supplier", security: [{ session: [] }],
      description: "Super Admin only. Captures the signed-in creator and starts active. Companies must differ. Duplicate pairs, including inactive links, return 409. Does not grant access to another company's data.",
      requestBody: body(ref("CreateCompanySupply")),
      responses: { "201": { description: "Supply link created", ...json({ type: "object", required: ["relationship"], properties: { relationship: ref("CompanySupplyRelationship") } }) }, ...errors },
    },
    patch: {
      tags: ["Company supply"], summary: "Activate or deactivate a supply link", security: [{ session: [] }],
      description: "Super Admin only. Only is_active can change; company IDs and creation history are preserved. No physical-delete endpoint.",
      requestBody: body(ref("UpdateCompanySupply")),
      responses: { "200": { description: "Supply link updated", ...json({ type: "object", required: ["relationship"], properties: { relationship: ref("CompanySupplyRelationship") } }) }, ...errors },
    },
  },
  "/api/company-supply-relationships/options": {
    get: {
      tags: ["Company supply"], summary: "Find eligible companies to link", security: [{ session: [] }],
      description: "Super Admin only. Excludes the selected company and existing links in the chosen direction, including inactive links. Reverse-direction relationships are independent.",
      parameters,
      responses: { "200": { description: "Paginated company choices", ...json({ type: "object", required: ["companies", "total", "page", "page_size"], properties: { companies: { type: "array", items: company }, ...metadata } }) }, ...errors },
    },
  },
};

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ content: { "application/json": { schema } } });
const id = { type: "string", format: "uuid" };
const text = { type: "string", minLength: 1, maxLength: 160 };
const optionalText = { type: "string", maxLength: 160 };

export const supplierSchemas = {
  Supplier: {
    type: "object",
    required: ["id", "company_id", "company", "created_by", "created_by_name", "name", "contact_person", "contact_email", "contact_phone", "contact_address", "created_at", "updated_at"],
    properties: {
      id,
      company_id: { ...id, nullable: true },
      company: { type: "object", nullable: true, required: ["id", "name"], properties: { id, name: { type: "string" } } },
      created_by: { ...id, nullable: true, readOnly: true },
      created_by_name: { type: "string", nullable: true, readOnly: true },
      name: text,
      contact_person: text,
      contact_email: text,
      contact_phone: optionalText,
      contact_address: optionalText,
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },
  CreateSupplier: {
    type: "object",
    required: ["name", "contact_person", "contact_email"],
    properties: { company_id: id, name: text, contact_person: text, contact_email: text, contact_phone: optionalText, contact_address: optionalText },
  },
  UpdateSupplier: {
    type: "object",
    required: ["id"],
    properties: { id, name: text, contact_person: text, contact_email: text, contact_phone: optionalText, contact_address: optionalText },
  },
  SupplierResponse: {
    type: "object",
    required: ["supplier"],
    properties: { supplier: ref("Supplier") },
  },
  SuppliersPage: {
    type: "object",
    required: ["suppliers", "total", "page", "page_size"],
    properties: {
      suppliers: { type: "array", items: ref("Supplier") },
      total: { type: "integer" },
      page: { type: "integer" },
      page_size: { type: "integer" },
    },
  },
};

const error = { description: "Request failed", ...json(ref("Error")) };
const errors = { "401": error, "403": error, "404": error, "409": error, "500": error };
const common = { tags: ["Suppliers"], security: [{ session: [] }] };

export const supplierPaths = {
  "/api/suppliers": {
    get: {
      ...common,
      summary: "List suppliers, or get one by ID",
      description: "Requires suppliers.view. Pass id to load one supplier. Search, filters, and pagination apply to the list.",
      parameters: [
        { name: "id", in: "query", schema: id },
        { name: "search", in: "query", schema: { type: "string", maxLength: 160 } },
        { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
        { name: "page_size", in: "query", schema: { type: "integer", default: 10 } },
        { name: "sort_by", in: "query", schema: { type: "string", enum: ["id", "name", "created_at", "updated_at"] } },
        { name: "sort_order", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
        { name: "filters", in: "query", schema: { type: "string" } },
      ],
      responses: {
        "200": { description: "Suppliers page or one supplier", ...json({ oneOf: [ref("SuppliersPage"), ref("SupplierResponse")] }) },
        ...errors,
      },
    },
    post: {
      ...common,
      summary: "Create a supplier",
      description: "Requires suppliers.add. A duplicate company and name returns 409.",
      requestBody: { required: true, ...json(ref("CreateSupplier")) },
      responses: {
        "201": { description: "Supplier created", ...json(ref("SupplierResponse")) },
        ...errors,
      },
    },
    patch: {
      ...common,
      summary: "Update a supplier",
      description: "Requires suppliers.edit. A duplicate company and name returns 409.",
      requestBody: { required: true, ...json(ref("UpdateSupplier")) },
      responses: {
        "200": { description: "Supplier updated", ...json(ref("SupplierResponse")) },
        ...errors,
      },
    },
    delete: {
      ...common,
      summary: "Delete a supplier",
      description: "Requires suppliers.delete.",
      parameters: [{ name: "id", in: "query", required: true, schema: id }],
      responses: {
        "200": { description: "Supplier deleted", ...json({ type: "object", required: ["id", "message"], properties: { id, message: { type: "string" } } }) },
        ...errors,
      },
    },
  },
};

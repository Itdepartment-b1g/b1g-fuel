const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ content: { "application/json": { schema } } });
const id = { type: "string", format: "uuid" };
const text = { type: "string", minLength: 1, maxLength: 160 };

export const supplierSchemas = {
  Supplier: {
    type: "object",
    required: ["id", "company_id", "created_by", "name", "contact_person", "contact_email", "contact_phone", "contact_address", "created_at", "updated_at"],
    properties: {
      id,
      company_id: { ...id, nullable: true },
      created_by: { ...id, nullable: true, readOnly: true },
      name: text,
      contact_person: text,
      contact_email: text,
      contact_phone: text,
      contact_address: text,
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },
  CreateSupplier: {
    type: "object",
    required: ["name", "contact_person", "contact_email", "contact_phone", "contact_address"],
    properties: { company_id: id, name: text, contact_person: text, contact_email: text, contact_phone: text, contact_address: text },
  },
  UpdateSupplier: {
    type: "object",
    required: ["id"],
    properties: { id, name: text, contact_person: text, contact_email: text, contact_phone: text, contact_address: text },
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
      summary: "List the first page of suppliers, or get one by ID",
      description: "Requires suppliers.view. A list request returns the first 10 suppliers the caller can see. Pass id to load one supplier.",
      parameters: [{ name: "id", in: "query", schema: id }],
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

const uuid = { type: "string", format: "uuid" };
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ content: { "application/json": { schema } } });
const body = (name: string) => ({ required: true, ...json(ref(name)) });
const named = { type: "object", required: ["id", "name"], properties: { id: uuid, name: { type: "string" } } };
const note = { type: "string", maxLength: 1000 };
const qty = { type: "string", pattern: "^\\d{1,11}(\\.\\d{1,3})?$", example: "10.500" };
const status = { type: "string", enum: ["draft", "submitted", "approved", "rejected", "cancelled"] };
const errors = Object.fromEntries([400, 401, 403, 404, 409, 500].map((code) => [code, { description: "Request failed", ...json(ref("Error")) }]));
const query = (name: string, schema: object = { type: "string" }, required = false) => ({ name, in: "query", required, schema });
const pagination = [query("page", { type: "integer", minimum: 1, default: 1 }), query("page_size", { type: "integer", enum: [10, 25, 50, 100], default: 10 })];
export const materialRequestSchemas = {
  MaterialRequestInput: { type: "object", additionalProperties: false, required: ["requesting_hub_id", "supplying_company_id", "items"], properties: {
    requesting_hub_id: uuid, supplying_company_id: uuid, notes: note, needed_at: { type: "string", format: "date", nullable: true },
    items: { type: "array", minItems: 1, maxItems: 100, items: { type: "object", additionalProperties: false, required: ["product_id", "requested_qty"], properties: { product_id: uuid, requested_qty: qty } } },
  } },
  MaterialRequestAction: { type: "object", additionalProperties: false, required: ["id", "action"], properties: {
    id: uuid, action: { type: "string", enum: ["submit", "approve", "reject", "cancel"] }, note: { ...note, description: "Required for rejection." }, supplying_warehouse_id: { ...uuid, description: "Required for approval; must belong to the supplying company." },
  } },
  MaterialRequest: { type: "object", properties: {
    id: uuid, request_no: { type: "string", nullable: true, example: "MR-BFW-202610-0000001" }, status,
    supply_relationship_id: uuid, requesting_company_id: uuid, supplying_company_id: uuid, requesting_hub_id: uuid, supplying_warehouse_id: { ...uuid, nullable: true },
    requesting_company: named, supplying_company: named, requesting_hub: named, supplying_warehouse: { ...named, nullable: true }, notes: note,
    needed_at: { type: "string", format: "date-time", nullable: true }, submitted_at: { type: "string", format: "date-time", nullable: true },
    created_by: uuid, created_by_name: { type: "string", nullable: true }, created_at: { type: "string", format: "date-time" }, updated_at: { type: "string", format: "date-time" },
    items: { type: "array", items: { type: "object", properties: { id: uuid, product_id: uuid, unit_id: uuid, product_label: { type: "string" }, unit_label: { type: "string" }, requested_qty: qty, approved_qty: { ...qty, nullable: true } } } },
    events: { type: "array", items: { type: "object", properties: { id: uuid, kind: { type: "string", enum: ["created", "updated", "submitted", "approved", "rejected", "cancelled"] }, from_status: { ...status, nullable: true }, to_status: status, note, created_by: uuid, created_by_name: { type: "string", nullable: true }, created_at: { type: "string", format: "date-time" } } } },
    permissions: { type: "object", description: "Included on detail reads; server-derived allowed actions.", properties: { edit: { type: "boolean" }, submit: { type: "boolean" }, cancel: { type: "boolean" }, review: { type: "boolean" } } },
  } },
  MaterialRequestResponse: { type: "object", properties: { request: ref("MaterialRequest") } },
};
const base = { tags: ["Material requests"], security: [{ session: [] }] };
export const materialRequestPaths = {
  "/api/material-requests": {
    get: { ...base, summary: "List accessible requests or load one by ID", description: "Requires materialRequests.view. Supplier-side access starts after submission. Own scope follows current location assignments.", parameters: [query("id", uuid), query("search"), query("status", status), ...pagination], responses: { "200": { description: "Request detail when id is supplied, otherwise paginated requests, total, page, page_size", ...json({ oneOf: [ref("MaterialRequestResponse"), { type: "object", properties: { requests: { type: "array", items: ref("MaterialRequest") }, total: { type: "integer" }, page: { type: "integer" }, page_size: { type: "integer" } } }] }) }, ...errors } },
    post: { ...base, summary: "Create a material request draft", description: "Requires materialRequests.add for the hub. Company and actor IDs are derived server-side. Products must belong to the active linked supplier. Quantities use each product's base unit.", requestBody: body("MaterialRequestInput"), responses: { "201": { description: "Draft created with a timeline event; no number allocated yet", ...json(ref("MaterialRequestResponse")) }, ...errors } },
    patch: { ...base, summary: "Edit a draft", description: "Requires requesting-side materialRequests.edit. Hub and supplier cannot change. Replaces the complete item list and records an update event.", parameters: [query("id", uuid, true)], requestBody: body("MaterialRequestInput"), responses: { "200": { description: "Draft updated", ...json(ref("MaterialRequestResponse")) }, ...errors } },
  },
  "/api/material-requests/action": { post: { ...base, summary: "Submit, approve, reject, or cancel a material request", description: "Requires materialRequests.edit. Submit/cancel belong to the requester; approve/reject belong to the supplier. Submission revalidates the active link and catalog, snapshots labels, and atomically allocates MR-{requesting company code}-{YYYYMM}-{7-digit sequence} using Asia/Manila. Approval accepts all quantities and requires a supplier warehouse. Rejection requires a reason. Cancellation is allowed before approval. Status and timeline update in one transaction; no inventory movement occurs.", requestBody: body("MaterialRequestAction"), responses: { "200": { description: "Request updated", ...json(ref("MaterialRequestResponse")) }, ...errors } } },
  "/api/material-requests/options": { get: { ...base, summary: "Get accessible hubs, active linked suppliers, and reviewer warehouse choices", parameters: [query("hub_id", uuid), query("supplier_id", uuid)], responses: { "200": { description: "Scoped options", ...json({ type: "object", properties: { hubs: { type: "array", items: { ...named, properties: { ...named.properties, company_id: uuid, company: { type: "object", properties: { name: { type: "string" } } } } } }, suppliers: { type: "array", items: named }, warehouses: { type: "array", items: named } } }) }, ...errors } } },
  "/api/material-requests/catalog": { get: { ...base, summary: "Browse a linked supplier's requestable product catalog", description: "Requires hub add/edit permission and an active company supply link. Returns product label, ID, and base unit only; excludes costs and unrelated supplier records.", parameters: [query("hub_id", uuid, true), query("supplier_id", uuid, true), query("search"), ...pagination], responses: { "200": { description: "Paginated products, total, page, page_size", ...json({ type: "object", properties: { products: { type: "array", items: { type: "object", properties: { id: uuid, label: { type: "string" }, unit_id: uuid, unit_label: { type: "string" } } } }, total: { type: "integer" }, page: { type: "integer" }, page_size: { type: "integer" } } }) }, ...errors } } },
};

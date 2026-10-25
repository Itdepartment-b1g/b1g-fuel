import { PURCHASE_ORDER_SORT_FIELDS } from "@/server/schema/purchase_order_schema";
import { PAGE_SIZE_OPTIONS } from "@/utils/pagination";

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({
  content: { "application/json": { schema } },
});
const error = { description: "Request failed", ...json(ref("Error")) };
const errors = {
  "400": error,
  "401": error,
  "403": error,
  "404": error,
  "409": error,
  "500": error,
};
const id = { type: "string", format: "uuid" };

const lineInput = {
  type: "object",
  additionalProperties: false,
  required: ["variant_id", "product_type_id", "base_unit_id", "ordered_qty"],
  properties: {
    variant_id: id,
    product_type_id: id,
    base_unit_id: id,
    ordered_qty: { type: "string", example: "10" },
  },
};

export const purchaseOrderSchemas = {
  CreatePurchaseOrder: {
    type: "object",
    additionalProperties: false,
    required: ["supplier_id", "lines"],
    properties: {
      company_id: id,
      supplier_id: id,
      payment_terms: { type: "string", maxLength: 160 },
      payment_method: {
        type: "string",
        nullable: true,
        enum: ["cash", "bank_transfer", "gcash", "check"],
      },
      estimated_delivery_on: { type: "string", nullable: true, example: "2026-10-20" },
      notes: { type: "string", maxLength: 1000 },
      lines: { type: "array", minItems: 1, maxItems: 50, items: lineInput },
    },
  },
  PurchaseOrder: {
    type: "object",
    required: ["id", "company_id", "supplier_id", "facility_id", "status", "items"],
    properties: {
      id,
      status: {
        type: "string",
        enum: ["draft", "awaiting_receipt", "partially_received", "received", "closed"],
      },
      payment_terms: { type: "string" },
      line_count: { type: "integer" },
      estimated_delivery_on: { type: "string", nullable: true },
    },
  },
};

const listParameters = [
  {
    name: "page",
    in: "query",
    schema: { type: "integer", minimum: 1, default: 1 },
  },
  {
    name: "page_size",
    in: "query",
    schema: { type: "integer", enum: [...PAGE_SIZE_OPTIONS] },
  },
  {
    name: "sort_by",
    in: "query",
    schema: { type: "string", enum: [...PURCHASE_ORDER_SORT_FIELDS] },
  },
  {
    name: "sort_order",
    in: "query",
    schema: { type: "string", enum: ["asc", "desc"] },
  },
  {
    name: "search",
    in: "query",
    schema: { type: "string", maxLength: 160 },
  },
  {
    name: "filters",
    in: "query",
    schema: { type: "string", maxLength: 12000 },
  },
  { name: "id", in: "query", schema: id },
];

export const purchaseOrderPaths = {
  "/api/purchase-orders": {
    get: {
      tags: ["Purchase orders"],
      summary: "List purchase orders or load one",
      description:
        "Requires purchaseOrders.view. A purchase order does not change stock. Pass id to load one order.",
      security: [{ session: [] }],
      parameters: listParameters,
      responses: { "200": { description: "Purchase orders" }, ...errors },
    },
    post: {
      tags: ["Purchase orders"],
      summary: "Create a draft purchase order",
      description:
        "Requires purchaseOrders.add. The warehouse is the company's active warehouse. Each line finds or creates the company product from variant, product type, and base unit.",
      security: [{ session: [] }],
      requestBody: {
        required: true,
        ...json(ref("CreatePurchaseOrder")),
      },
      responses: { "201": { description: "Draft created" }, ...errors },
    },
    patch: {
      tags: ["Purchase orders"],
      summary: "Update a draft purchase order",
      security: [{ session: [] }],
      responses: { "200": { description: "Draft updated" }, ...errors },
    },
    delete: {
      tags: ["Purchase orders"],
      summary: "Delete a draft purchase order",
      security: [{ session: [] }],
      parameters: [{ name: "id", in: "query", required: true, schema: id }],
      responses: { "200": { description: "Draft deleted" }, ...errors },
    },
  },
  "/api/purchase-orders/confirm": {
    post: {
      tags: ["Purchase orders"],
      summary: "Confirm a draft purchase order",
      description: "Requires payment terms and at least one line. Does not change stock.",
      security: [{ session: [] }],
      responses: { "200": { description: "Order opened" }, ...errors },
    },
  },
  "/api/purchase-orders/close": {
    post: {
      tags: ["Purchase orders"],
      summary: "Close an open purchase order",
      security: [{ session: [] }],
      responses: { "200": { description: "Order closed" }, ...errors },
    },
  },
};

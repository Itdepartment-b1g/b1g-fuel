import { PRODUCT_SORT_FIELDS } from "@/server/schema/product_schema";
import { PRODUCT_TYPE_SORT_FIELDS } from "@/server/schema/product_type_schema";
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
const text = { type: "string", minLength: 1, maxLength: 160 };
const key = { type: "string", minLength: 1, maxLength: 64 };

export const productSchemas = {
  ProductType: {
    type: "object",
    required: ["id", "name", "key", "created_at", "updated_at"],
    properties: {
      id,
      company_id: { type: "string", format: "uuid", nullable: true },
      company: {
        nullable: true,
        allOf: [ref("CompanyOption")],
      },
      created_by: { type: "string", format: "uuid", nullable: true },
      created_by_name: { type: "string", nullable: true },
      name: text,
      key,
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },
  Product: {
    type: "object",
    required: [
      "id",
      "company_id",
      "variant_id",
      "base_unit_id",
      "product_type_id",
      "display_name",
      "note",
      "created_at",
      "updated_at",
    ],
    properties: {
      id,
      company_id: id,
      display_name: { type: "string" },
      note: { type: "string", maxLength: 160 },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },
  CreateProductType: {
    type: "object",
    additionalProperties: false,
    required: ["name", "key"],
    properties: {
      company_id: id,
      name: text,
      key,
    },
  },
  CreateProduct: {
    type: "object",
    additionalProperties: false,
    required: ["company_id", "variant_id", "base_unit_id", "product_type_id"],
    properties: {
      company_id: id,
      variant_id: id,
      base_unit_id: id,
      product_type_id: id,
      note: { type: "string", maxLength: 160 },
    },
  },
};

export const productPaths = {
  "/api/product-types": {
    get: {
      tags: ["Product types"],
      security: [{ session: [] }],
      summary: "List product types or load one",
      parameters: [
        { name: "id", in: "query", schema: id },
        { name: "search", in: "query", schema: { type: "string" } },
        { name: "page", in: "query", schema: { type: "integer" } },
        {
          name: "page_size",
          in: "query",
          schema: { type: "integer", enum: [...PAGE_SIZE_OPTIONS] },
        },
        {
          name: "sort_by",
          in: "query",
          schema: { type: "string", enum: [...PRODUCT_TYPE_SORT_FIELDS] },
        },
      ],
      responses: { "200": { description: "OK" }, ...errors },
    },
    post: {
      tags: ["Product types"],
      security: [{ session: [] }],
      summary: "Create product type",
      requestBody: {
        required: true,
        ...json(ref("CreateProductType")),
      },
      responses: { "201": { description: "Created" }, ...errors },
    },
    patch: {
      tags: ["Product types"],
      security: [{ session: [] }],
      summary: "Update product type",
      responses: { "200": { description: "OK" }, ...errors },
    },
    delete: {
      tags: ["Product types"],
      security: [{ session: [] }],
      summary: "Delete product type",
      responses: { "200": { description: "OK" }, ...errors },
    },
  },
  "/api/products": {
    get: {
      tags: ["Products"],
      security: [{ session: [] }],
      summary: "List products or load one",
      parameters: [
        { name: "id", in: "query", schema: id },
        { name: "search", in: "query", schema: { type: "string" } },
        {
          name: "sort_by",
          in: "query",
          schema: { type: "string", enum: [...PRODUCT_SORT_FIELDS] },
        },
      ],
      responses: { "200": { description: "OK" }, ...errors },
    },
    post: {
      tags: ["Products"],
      security: [{ session: [] }],
      summary: "Create product",
      requestBody: { required: true, ...json(ref("CreateProduct")) },
      responses: { "201": { description: "Created" }, ...errors },
    },
    patch: {
      tags: ["Products"],
      security: [{ session: [] }],
      summary: "Update product",
      responses: { "200": { description: "OK" }, ...errors },
    },
    delete: {
      tags: ["Products"],
      security: [{ session: [] }],
      summary: "Delete product",
      responses: { "200": { description: "OK" }, ...errors },
    },
  },
};

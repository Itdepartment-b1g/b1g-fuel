import { BRAND_SORT_FIELDS } from "@/server/schema/brands_schema";
import { VARIANT_SORT_FIELDS } from "@/server/schema/variants_schema";
import { PAGE_SIZE_OPTIONS } from "@/utils/pagination";

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ content: { "application/json": { schema } } });
const id = { type: "string", format: "uuid" };
const name = { type: "string", minLength: 1, maxLength: 160 };
const company = {
  type: "object",
  nullable: true,
  required: ["id", "name"],
  properties: { id, name: { type: "string" } },
};
const error = { description: "Request failed", ...json(ref("Error")) };
const errors = { "400": error, "401": error, "403": error, "404": error, "409": error, "500": error };
const pageQuery = [
  { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
  { name: "page_size", in: "query", schema: { type: "integer", enum: [...PAGE_SIZE_OPTIONS], default: 10 } },
];
function sortQuery(fields: readonly string[]) {
  return [
    { name: "sort_by", in: "query", schema: { type: "string", enum: [...fields] } },
    { name: "sort_order", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
  ];
}
function collection(tag: string, summary: string, extra: object[]) {
  return {
    get: {
      tags: [tag],
      security: [{ session: [] }],
      summary,
      parameters: [
        { name: "id", in: "query", schema: id },
        { name: "search", in: "query", schema: { type: "string", maxLength: 160 } },
        ...extra,
        ...pageQuery,
        ...sortQuery(tag === "Brands" ? BRAND_SORT_FIELDS : VARIANT_SORT_FIELDS),
      ],
      responses: { "200": { description: summary, ...json({ oneOf: [ref(`${tag.slice(0, -1)}Page`.replace("BrandPage", "BrandsPage").replace("VariantPage", "VariantsPage")), ref(`${tag.slice(0, -1)}Response`)] }) }, ...errors },
    },
  };
}

export const brandAndVariantSchemas = {
  Brand: {
    type: "object",
    required: ["id", "company_id", "company", "name", "variant_count", "created_at", "updated_at"],
    properties: {
      id,
      company_id: { ...id, nullable: true },
      company,
      created_by: { ...id, nullable: true, readOnly: true },
      created_by_name: { type: "string", nullable: true, readOnly: true },
      name,
      variant_count: { type: "integer", readOnly: true },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },
  CreateBrand: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: { company_id: id, name },
  },
  UpdateBrand: {
    type: "object",
    additionalProperties: false,
    required: ["id", "name"],
    properties: { id, name },
  },
  BrandResponse: { type: "object", required: ["brand"], properties: { brand: ref("Brand") } },
  BrandsPage: {
    type: "object",
    required: ["brands", "total", "page", "page_size"],
    properties: {
      brands: { type: "array", items: ref("Brand") },
      total: { type: "integer" },
      page: { type: "integer" },
      page_size: { type: "integer" },
    },
  },
  Variant: {
    type: "object",
    required: ["id", "brand_id", "brand", "company_id", "company", "name", "created_at", "updated_at"],
    properties: {
      id,
      brand_id: id,
      brand: { type: "object", required: ["id", "name"], properties: { id, name: { type: "string" } } },
      company_id: { ...id, nullable: true },
      company,
      created_by: { ...id, nullable: true, readOnly: true },
      created_by_name: { type: "string", nullable: true, readOnly: true },
      name,
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },
  CreateVariant: {
    type: "object",
    additionalProperties: false,
    required: ["brand_id", "name"],
    properties: { brand_id: id, company_id: id, name },
  },
  UpdateVariant: {
    type: "object",
    additionalProperties: false,
    required: ["id", "name"],
    properties: { id, name },
  },
  VariantResponse: { type: "object", required: ["variant"], properties: { variant: ref("Variant") } },
  VariantsPage: {
    type: "object",
    required: ["variants", "total", "page", "page_size"],
    properties: {
      variants: { type: "array", items: ref("Variant") },
      total: { type: "integer" },
      page: { type: "integer" },
      page_size: { type: "integer" },
    },
  },
};

const deleted = { type: "object", required: ["id", "message"], properties: { id, message: { type: "string" } } };
function mutation(tag: string, create: string, update: string, remove: string) {
  const common = { tags: [tag], security: [{ session: [] }] };
  const response = ref(`${tag.slice(0, -1)}Response`);
  return {
    post: { ...common, summary: `Create a ${tag.slice(0, -1).toLowerCase()}`, requestBody: { required: true, ...json(ref(create)) }, responses: { "201": { description: `${tag.slice(0, -1)} created`, ...json(response) }, ...errors } },
    patch: { ...common, summary: `Rename a ${tag.slice(0, -1).toLowerCase()}`, description: "Company and brand ownership cannot be changed.", requestBody: { required: true, ...json(ref(update)) }, responses: { "200": { description: `${tag.slice(0, -1)} updated`, ...json(response) }, ...errors } },
    delete: { ...common, summary: remove, parameters: [{ name: "id", in: "query", required: true, schema: id }], responses: { "200": { description: `${tag.slice(0, -1)} deleted`, ...json(deleted) }, ...errors } },
  };
}

export const brandAndVariantPaths = {
  "/api/brands/options": {
    get: {
      tags: ["Brands"],
      security: [{ session: [] }],
      summary: "List companies permitted for creating brands",
      description: "Requires brandsAndVariants.add. Does not require companies.view.",
      responses: { "200": { description: "Permitted companies", ...json({ type: "object", required: ["companies"], properties: { companies: { type: "array", items: company } } }) }, ...errors },
    },
  },
  "/api/brands": {
    ...collection("Brands", "List brands or get one by ID", [{ name: "company_id", in: "query", schema: id }]),
    ...mutation("Brands", "CreateBrand", "UpdateBrand", "Delete a brand that has no variants"),
  },
  "/api/variants/options": {
    get: {
      tags: ["Variants"],
      security: [{ session: [] }],
      summary: "List brands permitted for creating variants",
      description: "Requires brandsAndVariants.add. Includes the user's company brands and shared brands. Super admins see every brand.",
      responses: {
        "200": {
          description: "Permitted brands",
          ...json({
            type: "object",
            required: ["brands", "companies"],
            properties: {
              brands: { type: "array", items: { type: "object", required: ["id", "name", "company_id", "company"], properties: { id, name: { type: "string" }, company_id: { ...id, nullable: true }, company } } },
              companies: { type: "array", items: company },
            },
          }),
        },
        ...errors,
      },
    },
  },
  "/api/variants": {
    ...collection("Variants", "List variants or get one by ID", [{ name: "brand_id", in: "query", schema: id }, { name: "company_id", in: "query", schema: id }]),
    ...mutation("Variants", "CreateVariant", "UpdateVariant", "Delete a variant"),
  },
};

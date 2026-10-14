import { MEASUREMENT_SORT_FIELDS } from "@/server/schema/measurements_schema";
import { PAGE_SIZE_OPTIONS } from "./pagination";

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ content: { "application/json": { schema } } });
const id = { type: "string", format: "uuid" };
const active = { type: "boolean", default: true };
const key = { type: "string", maxLength: 64, pattern: "^[a-z][a-z0-9_]*$" };
const name = { type: "string", minLength: 1, maxLength: 160 };
const child = { key, is_active: active, position: { type: "integer", minimum: 0, maximum: 1000 } };
const field = { ...child, label: { type: "string", minLength: 1, maxLength: 100 }, required: { type: "boolean", default: true } };
const unit = { ...child, name: { type: "string", minLength: 1, maxLength: 100 }, symbol: { type: "string", minLength: 1, maxLength: 20 } };
const fields = { type: "array", minItems: 1, maxItems: 30, items: ref("MeasurementFieldInput") };
const units = { type: "array", minItems: 1, maxItems: 30, items: ref("MeasurementUnitInput") };
export const measurementSchemas = {
  MeasurementFieldInput: { type: "object", additionalProperties: false, required: ["key", "label"], properties: field },
  MeasurementUnitInput: { type: "object", additionalProperties: false, required: ["key", "name", "symbol"], properties: unit },
  Measurement: { type: "object", required: ["id", "company_id", "name", "is_active", "created_at", "updated_at", "fields", "units"], properties: {
    id, company_id: id, created_by: { ...id, nullable: true, readOnly: true }, name, is_active: active,
    created_at: { type: "string", format: "date-time" }, updated_at: { type: "string", format: "date-time" },
    fields: { type: "array", items: { type: "object", properties: { id, ...field } } },
    units: { type: "array", items: { type: "object", properties: { id, ...unit } } },
  } },
  CreateMeasurement: { type: "object", additionalProperties: false, required: ["company_id", "name", "fields", "units"], properties: { company_id: id, name, fields, units } },
  UpdateMeasurement: { type: "object", additionalProperties: false, required: ["id"], minProperties: 2, properties: { id, name, is_active: active, fields, units } },
  MeasurementResponse: { type: "object", required: ["measurement"], properties: { measurement: ref("Measurement") } },
  MeasurementsPage: { type: "object", required: ["measurements", "total", "page", "page_size"], properties: {
    measurements: { type: "array", items: ref("Measurement") }, total: { type: "integer" }, page: { type: "integer" }, page_size: { type: "integer" },
  } },
};
const error = { description: "Request failed", ...json(ref("Error")) };
const errors = { "400": error, "401": error, "403": error, "404": error, "409": error, "500": error };
const common = { tags: ["Measurements"], security: [{ session: [] }] };
export const measurementPaths = {
  "/api/measurements": {
    get: { ...common, summary: "List measurements or get one by ID", parameters: [
      { name: "id", in: "query", schema: id }, { name: "company_id", in: "query", schema: id },
      { name: "search", in: "query", schema: { type: "string", maxLength: 160 } },
      { name: "is_active", in: "query", schema: { type: "boolean" } },
      { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
      { name: "page_size", in: "query", schema: { type: "integer", enum: [...PAGE_SIZE_OPTIONS], default: 10 } },
      { name: "sort_by", in: "query", schema: { type: "string", enum: [...MEASUREMENT_SORT_FIELDS] } },
      { name: "sort_order", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
    ], responses: { "200": { description: "Scoped measurements, including active and inactive children", ...json({ oneOf: [ref("MeasurementsPage"), ref("MeasurementResponse")] }) }, ...errors } },
    post: { ...common, summary: "Create a measurement with numeric fields and units", requestBody: { required: true, ...json(ref("CreateMeasurement")) }, responses: { "201": { description: "Measurement created", ...json(ref("MeasurementResponse")) }, ...errors } },
    patch: { ...common, summary: "Update measurement and upsert children by stable key", description: "Omitted children are preserved. Use is_active:false to deactivate a field or unit. Company ownership is immutable. At least one field and unit must remain active.", requestBody: { required: true, ...json(ref("UpdateMeasurement")) }, responses: { "200": { description: "Measurement updated", ...json(ref("MeasurementResponse")) }, ...errors } },
    delete: { ...common, summary: "Archive measurement without removing its definition", parameters: [{ name: "id", in: "query", required: true, schema: id }], responses: { "200": { description: "Measurement archived", ...json({ type: "object", properties: { id, message: { type: "string" } } }) }, ...errors } },
  },
};

import { HUB_SORT_FIELDS } from "@/server/schema/hubs_schema";
import { HUB_FILTER_OPTIONS } from "@/utils/hubs-filters";

const uuid = { type: "string", format: "uuid" };
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ content: { "application/json": { schema } } });
const body = (schema: object) => ({ required: true, ...json(schema) });
const query = (name: string, schema: object, required = false) => ({ name, in: "query", required, schema });
const error = { description: "Request failed", ...json(ref("Error")) };
const errors = { "400": error, "401": error, "403": error, "404": error, "409": error, "500": error };
const pagination = [query("page", { type: "integer", minimum: 1, default: 1 }), query("page_size", { type: "integer", enum: [10, 20, 50, 100] })];
const locationId = query("location_id", uuid, true);
const name = { type: "string", minLength: 1, maxLength: 160 };
const address = { type: "string", maxLength: 160 };
const company = { type: "object", required: ["id", "name"], properties: { id: uuid, name: { type: "string" } } };
const user = { type: "object", properties: { id: uuid, name: { type: "string" }, email: { type: "string", nullable: true } } };
const roles = { type: "array", description: "Current roles on this membership in the hub's company.", items: { type: "object", required: ["id", "name"], properties: { id: uuid, name: { type: "string" } } } };
const metadata = { total: { type: "integer" }, page: { type: "integer" }, page_size: { type: "integer" } };

export const hubSchemas = {
  HubQuickFilters: {
    type: "object", required: ["date", "conditions", "status", "additional"],
    properties: {
      date: { $ref: "#/components/schemas/QuickFilters/properties/date" },
      conditions: {
        type: "array", minItems: 1, maxItems: 50,
        items: { type: "object", required: ["id", "field", "value"], properties: {
          id: { type: "string", minLength: 1, maxLength: 64 },
          field: { type: "string", enum: ["", ...HUB_FILTER_OPTIONS.fields.map((field) => field.key)] },
          value: { type: "string", maxLength: 160 },
        } },
      },
      status: { type: "string", enum: ["all", "active", "inactive"] },
      additional: { type: "object", additionalProperties: false },
    },
  },
  HubMutationResult: { type: "object", required: ["id", "message"], properties: { id: uuid, message: { type: "string" } } },
  UnassignHubResult: { type: "object", required: ["location_id", "user_company_id", "message"], properties: { location_id: uuid, user_company_id: uuid, message: { type: "string" } } },
  Hub: {
    type: "object",
    required: ["id", "company_id", "company", "type", "name", "address", "is_active", "created_by", "created_by_name", "assigned_user_ids", "staff_count", "created_at", "updated_at"],
    properties: {
      id: uuid, company_id: uuid, company, type: { type: "string", enum: ["hub"] }, name, address,
      is_active: { type: "boolean" }, created_by: { ...uuid, nullable: true },
      created_by_name: { type: "string", nullable: true }, assigned_user_ids: { type: "array", items: uuid },
      staff_count: { type: "integer" }, created_at: { type: "string", format: "date-time" }, updated_at: { type: "string", format: "date-time" },
    },
  },
  HubAssignment: {
    type: "object",
    required: ["id", "user_company_id", "location_id", "user", "roles", "assigned_by", "assigned_by_name", "assigned_at"],
    properties: {
      id: uuid, user_company_id: uuid, location_id: uuid, user, roles, assigned_by: uuid,
      assigned_by_name: { type: "string", nullable: true }, assigned_at: { type: "string", format: "date-time" },
    },
  },
  HubAssignmentHistory: {
    type: "object",
    required: ["id", "location_id", "user_company_id", "user_id", "name", "email", "assigned_by", "assigned_by_name", "assigned_at", "unassigned_at"],
    properties: {
      id: uuid, location_id: uuid, user_company_id: uuid, user_id: uuid,
      name: { type: "string" }, email: { type: "string", nullable: true },
      assigned_by: uuid, assigned_by_name: { type: "string", nullable: true },
      assigned_at: { type: "string", format: "date-time" },
      unassigned_at: { type: "string", format: "date-time", nullable: true, description: "Null while the assignment is active." },
    },
  },
  CreateHub: {
    type: "object", additionalProperties: false, required: ["name"],
    properties: {
      name, address, company_id: { ...uuid, description: "Required for super-admins and users with multiple permitted companies. Automatically selected for a user with exactly one permitted company." },
    },
  },
  UpdateHub: {
    type: "object", additionalProperties: false, required: ["id"],
    description: "Provide at least one of name, address, or is_active. Company, type, and creator cannot be changed.",
    properties: { id: uuid, name, address, is_active: { type: "boolean" } },
  },
  AssignHub: {
    type: "object", additionalProperties: false, required: ["location_id", "user_company_id"],
    properties: { location_id: uuid, user_company_id: uuid },
  },
};

export const hubPaths = {
  "/api/hubs": {
    get: {
      tags: ["Hubs"], summary: "List hubs or load one", security: [{ session: [] }],
      description: "Requires hubs.view. Company scope lists company hubs. Own scope lists assigned hubs, regardless of creator. Warehouses are always excluded. Pass id to load a single hub.",
      parameters: [
        query("id", uuid), query("company_id", uuid), query("search", { type: "string", maxLength: 160 }),
        { ...query("filters", { type: "string" }), description: "JSON-encoded HubQuickFilters: name/company conditions, creation date, and active status." },
        query("is_active", { type: "boolean" }), ...pagination,
        query("sort_by", { type: "string", enum: HUB_SORT_FIELDS }), query("sort_order", { type: "string", enum: ["asc", "desc"] }),
      ],
      responses: { "200": { description: "Hub or paginated hubs", ...json({ oneOf: [
        { type: "object", required: ["hub"], properties: { hub: ref("Hub") } },
        { type: "object", required: ["hubs", "total", "page", "page_size"], properties: { hubs: { type: "array", items: ref("Hub") }, ...metadata } },
      ] }) }, ...errors },
    },
    post: {
      tags: ["Hubs"], summary: "Create a company-owned hub", security: [{ session: [] }],
      description: "Requires hubs.add. Creator is captured from the authenticated user. Location names are unique within a company, including warehouse names. Creating a hub does not assign staff.",
      requestBody: body(ref("CreateHub")), responses: { "201": { description: "Hub created", ...json({ type: "object", properties: { hub: ref("Hub") } }) }, ...errors },
    },
    patch: {
      tags: ["Hubs"], summary: "Update or reactivate a hub", security: [{ session: [] }],
      description: "Requires hubs.edit for this hub. Ownership and creation history remain unchanged.",
      requestBody: body(ref("UpdateHub")), responses: { "200": { description: "Hub updated", ...json({ type: "object", properties: { hub: ref("Hub") } }) }, ...errors },
    },
    delete: {
      tags: ["Hubs"], summary: "Deactivate a hub", security: [{ session: [] }],
      description: "Requires hubs.delete. Sets is_active=false; preserves the hub and staff assignments. No physical deletion.",
      parameters: [query("id", uuid, true)], responses: { "200": { description: "Hub deactivated", ...json(ref("HubMutationResult")) }, ...errors },
    },
  },
  "/api/hubs/options": {
    get: {
      tags: ["Hubs"], summary: "List permitted companies for hub creation", security: [{ session: [] }],
      description: "Requires hubs.add; does not require Companies page access.",
      responses: { "200": { description: "Permitted companies", ...json({ type: "object", properties: { companies: { type: "array", items: company } } }) }, ...errors },
    },
  },
  "/api/hubs/filter-options": {
    get: {
      tags: ["Hubs"], summary: "Load hub filter choices and counts", security: [{ session: [] }],
      description: "Requires hubs.view. Choices are restricted to hubs the user can view.",
      responses: { "200": { description: "Hub filters", ...json({ type: "object", properties: {
        fields: { type: "array", items: { type: "object", properties: { key: { type: "string" }, label: { type: "string" }, options: { type: "array", items: ref("FilterOption") } } } },
        statusOptions: { type: "array", items: ref("FilterOption") }, additionalFilters: { type: "array", items: { type: "object" } },
      } }) }, ...errors },
    },
  },
  "/api/hubs/assignment-options": {
    get: {
      tags: ["Hubs"], summary: "List unassigned company members", security: [{ session: [] }],
      description: "Requires company-level hubs.edit for this hub. Returns only members of the hub's company who are not already assigned. Search name or email. Sorted by user.created_at descending, with membership ID as the stable tie-breaker.",
      parameters: [locationId, query("search", { type: "string", maxLength: 160 }), ...pagination],
      responses: { "200": { description: "Eligible members", ...json({ type: "object", properties: {
        members: { type: "array", items: { type: "object", required: ["user_company_id", "user", "roles"], properties: { user_company_id: uuid, user, roles } } }, ...metadata,
      } }) }, ...errors },
    },
  },
  "/api/hubs/assignments": {
    get: {
      tags: ["Hubs"], summary: "List assigned staff", security: [{ session: [] }],
      description: "Requires company-level hubs.edit for this hub. Search name or email. Sorted by user.created_at descending, with assignment ID as the stable tie-breaker.",
      parameters: [locationId, query("search", { type: "string", maxLength: 160 }), ...pagination],
      responses: { "200": { description: "Assignments", ...json({ type: "object", properties: { assignments: { type: "array", items: ref("HubAssignment") }, ...metadata } }) }, ...errors },
    },
    post: {
      tags: ["Hubs"], summary: "Assign a staff member or agent", security: [{ session: [] }],
      description: "Requires company-level hubs.edit. Hub must be active and the membership must belong to its company. Does not grant roles or permissions. Repeating the assignment preserves its original audit fields.",
      requestBody: body(ref("AssignHub")), responses: { "201": { description: "Staff assigned", ...json({ type: "object", properties: { assignment: ref("HubAssignment") } }) }, ...errors },
    },
    delete: {
      tags: ["Hubs"], summary: "Unassign a staff member or agent", security: [{ session: [] }],
      description: "Requires company-level hubs.edit. Also allowed for an inactive hub. Historical transactions are unaffected.",
      parameters: [locationId, query("user_company_id", uuid, true)],
      responses: { "200": { description: "Staff unassigned", ...json(ref("UnassignHubResult")) }, ...errors },
    },
  },
  "/api/hubs/assignment-history": {
    get: {
      tags: ["Hubs"], summary: "List current and previous hub user assignments", security: [{ session: [] }],
      description: "Requires company-level hubs.edit. Includes assignment periods preserved after unassigning or company membership removal. Names and emails are snapshots from assignment time. Existing active assignments are backfilled; previously deleted assignments cannot be recovered. Newest-created users first.",
      parameters: [locationId, query("search", { type: "string", maxLength: 160 }), ...pagination],
      responses: { "200": { description: "Assignment history", ...json({ type: "object", required: ["assignments", "total", "page", "page_size"], properties: {
        assignments: { type: "array", items: ref("HubAssignmentHistory") }, ...metadata,
      } }) }, ...errors },
    },
  },
};

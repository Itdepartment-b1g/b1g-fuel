import { USER_SORT_FIELDS } from "@/server/schema/users_schema";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "./pagination";
import { rolePaths, roleSchemas } from "./openapi-roles";
import { quickFilterSchemas } from "./openapi-quick-filter";
import { companyPaths, companySchemas } from "./openapi-companies";

const errorResponse = { description: "Request failed", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
const jsonBody = (schema: object) => ({ required: true, content: { "application/json": { schema } } });

export const openapi = {
  openapi: "3.0.3",
  info: { title: "B1G Fuel API", version: "0.1.0", description: "Express API accessed through the Next.js /api proxy." },
  servers: [{ url: "/" }],
  tags: [{ name: "Auth" }, { name: "Health" }, { name: "Users" }, { name: "Roles" }, { name: "Companies" }],
  components: {
    securitySchemes: { session: { type: "apiKey", in: "cookie", name: "supabase-session", description: "Sign in through /api/auth/login to set the project-specific Supabase session cookies. This name is illustrative; Swagger sends actual browser cookies." } },
    schemas: {
      ...roleSchemas,
      ...quickFilterSchemas,
      ...companySchemas,
      Error: { type: "object", required: ["error"], properties: { error: { type: "string" } } },
      Credentials: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string", minLength: 8 } } },
      CreateUser: { type: "object", additionalProperties: false, required: ["name", "email", "password"], properties: {
        name: { type: "string", minLength: 1, maxLength: 250, example: "Juan Dela Cruz", description: "Required display name; whitespace is trimmed before saving." },
        email: { type: "string", format: "email", maxLength: 254 }, password: { type: "string", minLength: 8, maxLength: 128, writeOnly: true },
        company_id: { type: "string", format: "uuid", description: "Delegated creators must select a permitted company. Super-admins may omit company_id." }, role_ids: { type: "array", maxItems: 50, uniqueItems: true, items: { type: "string", format: "uuid" }, description: "Optional company-scoped roles; defaults to an empty array. Nonempty role_ids require company_id and super-admin access." },
      } },
      AssignUser: { type: "object", additionalProperties: false, required: ["company_id", "role_ids"], properties: {
        company_id: { type: "string", format: "uuid" },
        role_ids: { type: "array", minItems: 1, maxItems: 50, uniqueItems: true, items: { type: "string", format: "uuid" } },
      } },
      RoleOption: { type: "object", required: ["id", "name", "slug"], properties: { id: { type: "string", format: "uuid" }, name: { type: "string" }, slug: { type: "string" }, company_id: { type: "string", format: "uuid", nullable: true } } },
      CompanyOption: { type: "object", required: ["id", "name"], properties: { id: { type: "string", format: "uuid" }, name: { type: "string" } } },
      User: { type: "object", required: ["id", "name", "email", "created_at", "global_roles", "companies"], properties: {
        created_by: { type: "string", format: "uuid", nullable: true, readOnly: true },
        created_by_name: { type: "string", nullable: true, readOnly: true, description: "Display name of the user who created this record." },
        name: { type: "string", maxLength: 250 },
        id: { type: "string", format: "uuid" }, email: { type: "string", nullable: true }, created_at: { type: "string", format: "date-time" },
        global_roles: { type: "array", items: { $ref: "#/components/schemas/RoleOption" } },
        companies: { type: "array", items: { allOf: [{ $ref: "#/components/schemas/CompanyOption" }, { type: "object", required: ["roles"], properties: { roles: { type: "array", items: { $ref: "#/components/schemas/RoleOption" } } } }] } },
      } },
      UsersPage: { type: "object", required: ["users", "total", "page", "page_size"], properties: {
        users: { type: "array", items: { $ref: "#/components/schemas/User" } }, total: { type: "integer" }, page: { type: "integer" }, page_size: { type: "integer" },
      } },
      UserOptions: { type: "object", required: ["companies", "roles"], properties: {
        companies: { type: "array", items: { $ref: "#/components/schemas/CompanyOption" } }, roles: { type: "array", items: { $ref: "#/components/schemas/RoleOption" } },
      } },
      SessionUser: { type: "object", required: ["id", "email", "name"], properties: {
        id: { type: "string", format: "uuid" }, email: { type: "string", nullable: true }, name: { type: "string", nullable: true, maxLength: 250, description: "Database profile name when available; session lookup falls back to Auth metadata." },
      } },
      Session: { type: "object", required: ["user", "global_roles"], properties: {
        access: { type: "object", description: "Current server-computed pages, permission grants, company IDs and super-admin flag." },
        user: { $ref: "#/components/schemas/SessionUser" }, global_roles: { type: "array", items: { type: "string" } },
      } },
      LoginResponse: { type: "object", required: ["user", "message"], properties: {
        user: { allOf: [{ $ref: "#/components/schemas/SessionUser" }], nullable: true }, message: { type: "string" },
      } },
      CreateUserResponse: { type: "object", required: ["user"], properties: { user: { $ref: "#/components/schemas/User" } } },
      GoogleLoginResponse: { type: "object", required: ["url"], properties: { url: { type: "string", format: "uri", description: "Navigate the browser to this URL to continue sign-in." } } },
    },
  },
  paths: {
    ...rolePaths,
    ...companyPaths,
    "/api/auth/google": { post: { tags: ["Auth"], summary: "Start Google login", description: "Requires APP_ORIGIN in the Origin header. Sets the HttpOnly PKCE verifier cookie and returns a URL for browser navigation. No credentials or bearer token are required.", responses: {
      "200": { description: "OAuth URL and verifier cookie", content: { "application/json": { schema: { $ref: "#/components/schemas/GoogleLoginResponse" } } } }, "403": errorResponse, "429": errorResponse, "502": errorResponse,
    } } },
    "/api/auth/google/callback": { get: { tags: ["Auth"], summary: "Finish Google login", description: "Browser callback from Supabase. Requires the verifier cookie from initiation and a valid PKCE code. Only existing admin-provisioned profiles can enter the app. Do not call this manually to start login.", parameters: [
      { name: "code", in: "query", schema: { type: "string" }, description: "Single-use code supplied by Supabase." },
      { name: "error", in: "query", schema: { type: "string" }, description: "Provider failure or cancellation." },
    ], responses: { "303": { description: "Redirect to /dashboard on success, or /login with a fixed auth_error code on failure", headers: { Location: { schema: { type: "string", format: "uri" } } } }, "429": errorResponse } } },
    "/api/users": {
      get: { tags: ["Users"], summary: "List users (permission required)", security: [{ session: [] }], parameters: [
        { name: "page", in: "query", schema: { type: "integer", minimum: 1, maximum: 1000000, default: 1 } },
        { name: "sort_by", in: "query", description: "Sort before pagination; defaults to created_at.", schema: { type: "string", enum: [...USER_SORT_FIELDS] } },
        { name: "sort_order", in: "query", description: "asc or desc; defaults to desc for created_at and asc for other fields.", schema: { type: "string", enum: ["asc", "desc"] } },
        { name: "page_size", in: "query", schema: { type: "integer", enum: [...PAGE_SIZE_OPTIONS], default: DEFAULT_PAGE_SIZE } },
        { name: "search", in: "query", description: "Case-insensitive name or email search", schema: { type: "string", maxLength: 254 } },
        { name: "filters", in: "query", description: "JSON-encoded QuickFilters. Same-field conditions use OR; different fields, date, role status, membership and search combine with AND. Applied before pagination; company/role values are UUIDs.", schema: { type: "string", maxLength: 12000 } },
      ], responses: { "200": { description: "Paginated users", content: { "application/json": { schema: { $ref: "#/components/schemas/UsersPage" } } } }, "400": errorResponse, "401": errorResponse, "403": errorResponse, "500": errorResponse } },
      post: { tags: ["Users"], summary: "Create an email-confirmed account with optional company roles (permission required)", description: "Requires the application's Origin header. Admin sets the initial password; no invitation email is sent. Company and roles may be omitted. Roles require a company; a company can have no roles.", security: [{ session: [] }], requestBody: jsonBody({ $ref: "#/components/schemas/CreateUser" }), responses: {
        "201": { description: "User created", content: { "application/json": { schema: { $ref: "#/components/schemas/CreateUserResponse" } } } },
        "400": errorResponse, "401": errorResponse, "403": errorResponse, "409": errorResponse, "429": errorResponse, "500": errorResponse, "502": errorResponse,
      } },
    },
    "/api/users/{id}/assignments": { post: { tags: ["Users"], summary: "Assign a company and company roles to a user", description: "Creates or updates one membership and replaces that membership's roles. Roles are shared templates; their pages and permissions come from the role.", security: [{ session: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], requestBody: jsonBody({ $ref: "#/components/schemas/AssignUser" }), responses: { "200": { description: "Updated user", content: { "application/json": { schema: { $ref: "#/components/schemas/CreateUserResponse" } } } }, "400": errorResponse, "401": errorResponse, "403": errorResponse, "404": errorResponse, "500": errorResponse } } },
    "/api/users/filter-options": { get: { tags: ["Users"], summary: "Get Quick Filter choices from visible users", security: [{ session: [] }], responses: { "200": { description: "Fields, role-status and membership choices. Counts describe all visible records before the current search filters.", content: { "application/json": { schema: { $ref: "#/components/schemas/UserFilterOptions" } } } }, "401": errorResponse, "403": errorResponse, "500": errorResponse } } },
    "/api/users/options": { get: { tags: ["Users"], summary: "Get companies and company roles (permission required)", security: [{ session: [] }], responses: {
      "200": { description: "Creation options", content: { "application/json": { schema: { $ref: "#/components/schemas/UserOptions" } } } }, "401": errorResponse, "403": errorResponse, "500": errorResponse,
    } } },
    "/api/health": { get: { tags: ["Health"], summary: "API liveness", responses: { "200": { description: "API is running" } } } },
    "/api/auth/session": { get: { tags: ["Auth"], summary: "Get verified user and global roles", security: [{ session: [] }], responses: { "200": { description: "Verified user with display name and global role slugs", content: { "application/json": { schema: { $ref: "#/components/schemas/Session" } } } }, "401": errorResponse, "403": errorResponse } } },
    "/api/auth/login": { post: { tags: ["Auth"], summary: "Sign in", requestBody: jsonBody({ $ref: "#/components/schemas/Credentials" }), responses: { "200": { description: "Session cookies set; user includes profile name", content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } } } }, "400": errorResponse, "401": errorResponse, "403": errorResponse, "429": errorResponse } } },
    "/api/auth/logout": { post: { tags: ["Auth"], summary: "Sign out", responses: { "200": { description: "Session cleared" }, "400": errorResponse, "403": errorResponse, "429": errorResponse } } },
  },
};

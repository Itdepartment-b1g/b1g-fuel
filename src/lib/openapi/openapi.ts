import { USER_SORT_FIELDS } from "@/server/schema/users_schema";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/utils/pagination";
import { rolePaths, roleSchemas } from "./openapi-roles";
import { quickFilterSchemas } from "./openapi-quick-filter";
import { companyPaths, companySchemas } from "./openapi-companies";
import { measurementPaths, measurementSchemas } from "./openapi-measurements";
import { brandAndVariantPaths, brandAndVariantSchemas } from "./openapi-brand-and-variant";
import { supplierPaths, supplierSchemas } from "./openapi-suppliers";
import { productPaths, productSchemas } from "./openapi-products";
import { purchaseOrderPaths, purchaseOrderSchemas } from "./openapi-purchase-orders";
import { receivingPaths, receivingSchemas } from "./openapi-receiving";
import { hubPaths, hubSchemas } from "./openapi-hubs";
import { companySupplyPaths, companySupplySchemas } from "./openapi-company-supply";
import { materialRequestPaths, materialRequestSchemas } from "./openapi-material-requests";

const errorResponse = {
  description: "Request failed",
  content: {
    "application/json": { schema: { $ref: "#/components/schemas/Error" } },
  },
};
const jsonBody = (schema: object) => ({
  required: true,
  content: { "application/json": { schema } },
});

export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "B1G Fuel API",
    version: "0.1.0",
    description: "Express API accessed through the Next.js /api proxy.",
  },
  servers: [{ url: "/" }],
  tags: [
    { name: "Auth" },
    { name: "Health" },
    { name: "Users" },
    { name: "Roles" },
    { name: "Companies" },
    { name: "Measurements" },
    { name: "Brands" },
    { name: "Variants" },
    { name: "Suppliers" },
    { name: "Product types" },
    { name: "Products" },
    { name: "Purchase orders" },
    { name: "Receiving" },
    { name: "Hubs" },
    { name: "Company supply" },
    { name: "Material requests" },
  ],
  components: {
    securitySchemes: {
      session: {
        type: "apiKey",
        in: "cookie",
        name: "supabase-session",
        description:
          "Sign in through /api/auth/login to set the project-specific Supabase session cookies. This name is illustrative; Swagger sends actual browser cookies.",
      },
    },
    schemas: {
      ...roleSchemas,
      ...quickFilterSchemas,
      ...companySchemas,
      ...measurementSchemas,
      ...brandAndVariantSchemas,
      ...supplierSchemas,
      ...productSchemas,
      ...purchaseOrderSchemas,
      ...receivingSchemas,
      ...hubSchemas,
      ...companySupplySchemas,
      ...materialRequestSchemas,
      Error: {
        type: "object",
        required: ["error"],
        properties: { error: { type: "string" } },
      },
      Credentials: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8 },
        },
      },
      CreateUser: {
        type: "object",
        additionalProperties: false,
        required: ["name", "email", "password"],
        properties: {
          name: {
            type: "string",
            minLength: 1,
            maxLength: 250,
            example: "Juan Dela Cruz",
            description:
              "Required display name; whitespace is trimmed before saving.",
          },
          email: { type: "string", format: "email", maxLength: 254 },
          password: {
            type: "string",
            minLength: 8,
            maxLength: 128,
            writeOnly: true,
          },
          company_id: {
            type: "string",
            format: "uuid",
            description:
              "Delegated creators must select a permitted company. Super-admins may omit company_id.",
          },
          role_ids: {
            type: "array",
            maxItems: 50,
            uniqueItems: true,
            items: { type: "string", format: "uuid" },
            description:
              "Company-scoped roles for Super Admin. A company supervisor sends role_name or role_id instead.",
          },
          role_name: {
            type: "string",
            minLength: 1,
            maxLength: 100,
            example: "Warehouse Staff",
            description:
              "New role name from a company supervisor. The server saves a unique slug such as warehouse_staff. Send role_id instead to reuse a role this company already has. Super Admin omits this field.",
          },
          role_id: {
            type: "string",
            format: "uuid",
            description:
              "Existing company role selected by a supervisor. Omit when sending role_name.",
          },
          page_keys: {
            type: "array",
            maxItems: 50,
            uniqueItems: true,
            items: { type: "string" },
            description:
              "Dashboards checked for this staff membership. Required for a company supervisor, who cannot include users. Omit for Super Admin so the membership uses every page on the role.",
          },
          permissions: {
            type: "array",
            maxItems: 200,
            uniqueItems: true,
            items: { type: "string" },
            description: "View, edit, add, and delete keys checked for this staff member. Required for a company supervisor. Each key must be one the supervisor already has, and must belong to a checked dashboard.",
          },
          permission_scopes: {
            type: "object",
            additionalProperties: { type: "string", enum: ["all", "company", "own"] },
            description: "All, My company, or Only me for each checked action except Create. A supervisor cannot choose a scope broader than their own.",
          },
        },
      },
      AssignUser: {
        type: "object",
        additionalProperties: false,
        required: ["company_id", "role_ids"],
        properties: {
          company_id: { type: "string", format: "uuid" },
          role_ids: {
            type: "array",
            minItems: 1,
            maxItems: 50,
            uniqueItems: true,
            items: { type: "string", format: "uuid" },
          },
          page_keys: {
            type: "array",
            maxItems: 50,
            uniqueItems: true,
            items: { type: "string" },
            description:
              "Required when a company supervisor updates the membership. Saving switches that membership to assigned pages. Super Admin omits this field and restores every page on the selected roles.",
          },
          permissions: {
            type: "array",
            maxItems: 200,
            uniqueItems: true,
            items: { type: "string" },
            description: "Actions to save on the membership. Required for a company supervisor.",
          },
          permission_scopes: {
            type: "object",
            additionalProperties: { type: "string", enum: ["all", "company", "own"] },
          },
        },
      },
      RoleOption: {
        type: "object",
        required: ["id", "name", "slug"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          slug: { type: "string" },
          company_id: { type: "string", format: "uuid", nullable: true },
        },
      },
      AssignableRole: {
        allOf: [
          { $ref: "#/components/schemas/RoleOption" },
          {
            type: "object",
            required: ["pages", "permissions", "permission_scopes", "created_at"],
            properties: {
              pages: { type: "array", items: { type: "string" } },
              permissions: { type: "array", items: { type: "string" } },
              created_at: { type: "string", format: "date-time" },
              permission_scopes: {
                type: "object",
                additionalProperties: {
                  type: "string",
                  enum: ["all", "company", "own"],
                },
              },
            },
          },
        ],
      },
      CompanyOption: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
        },
      },
      User: {
        type: "object",
        required: [
          "id",
          "name",
          "email",
          "created_at",
          "global_roles",
          "companies",
        ],
        properties: {
          created_by: {
            type: "string",
            format: "uuid",
            nullable: true,
            readOnly: true,
          },
          created_by_name: {
            type: "string",
            nullable: true,
            readOnly: true,
            description: "Display name of the user who created this record.",
          },
          name: { type: "string", maxLength: 250 },
          id: { type: "string", format: "uuid" },
          email: { type: "string", nullable: true },
          created_at: { type: "string", format: "date-time" },
          global_roles: {
            type: "array",
            items: { $ref: "#/components/schemas/RoleOption" },
          },
          companies: {
            type: "array",
            items: {
              allOf: [
                { $ref: "#/components/schemas/CompanyOption" },
                {
                  type: "object",
                  required: ["roles", "page_grant_mode", "pages"],
                  properties: {
                    roles: {
                      type: "array",
                      items: { $ref: "#/components/schemas/RoleOption" },
                    },
                    page_grant_mode: { type: "string", enum: ["role_pages", "assigned_pages"] },
                    pages: { type: "array", items: { type: "string" } },
                  },
                },
              ],
            },
          },
        },
      },
      UsersPage: {
        type: "object",
        required: ["users", "total", "page", "page_size"],
        properties: {
          users: {
            type: "array",
            items: { $ref: "#/components/schemas/User" },
          },
          total: { type: "integer" },
          page: { type: "integer" },
          page_size: { type: "integer" },
        },
      },
      UserOptions: {
        type: "object",
        required: ["companies", "roles"],
        properties: {
          companies: {
            type: "array",
            items: { $ref: "#/components/schemas/CompanyOption" },
          },
          roles: {
            type: "array",
            items: { $ref: "#/components/schemas/AssignableRole" },
          },
        },
      },
      SessionUser: {
        type: "object",
        required: ["id", "email", "name"],
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", nullable: true },
          name: {
            type: "string",
            nullable: true,
            maxLength: 250,
            description:
              "Database profile name when available; session lookup falls back to Auth metadata.",
          },
          company: {
            type: "string",
            nullable: true,
            description:
              "Company names for this user's memberships. Null for Super Admin and accounts with no company.",
          },
        },
      },
      Session: {
        type: "object",
        required: ["user", "global_roles", "roles"],
        properties: {
          access: {
            type: "object",
            description:
              "Current server-computed pages, permission grants, company IDs and super-admin flag.",
          },
          user: { $ref: "#/components/schemas/SessionUser" },
          global_roles: { type: "array", items: { type: "string" } },
          roles: {
            type: "array",
            items: { type: "string" },
            description:
              "Display names of roles assigned globally or through a company membership.",
          },
        },
      },
      LoginResponse: {
        type: "object",
        required: ["user", "message"],
        properties: {
          user: {
            allOf: [{ $ref: "#/components/schemas/SessionUser" }],
            nullable: true,
          },
          message: { type: "string" },
        },
      },
      CreateUserResponse: {
        type: "object",
        required: ["user"],
        properties: { user: { $ref: "#/components/schemas/User" } },
      },
      GoogleLoginResponse: {
        type: "object",
        required: ["url"],
        properties: {
          url: {
            type: "string",
            format: "uri",
            description:
              "Navigate the browser to this URL to continue sign-in.",
          },
        },
      },
    },
  },
  paths: {
    ...rolePaths,
    ...companyPaths,
    ...measurementPaths,
    ...brandAndVariantPaths,
    ...supplierPaths,
    ...productPaths,
    ...purchaseOrderPaths,
    ...receivingPaths,
    ...hubPaths,
    ...companySupplyPaths,
    ...materialRequestPaths,
    "/api/auth/google": {
      post: {
        tags: ["Auth"],
        summary: "Start Google login",
        description:
          "Requires APP_ORIGIN in the Origin header. Sets the HttpOnly PKCE verifier cookie and returns a URL for browser navigation. No credentials or bearer token are required.",
        responses: {
          "200": {
            description: "OAuth URL and verifier cookie",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GoogleLoginResponse" },
              },
            },
          },
          "403": errorResponse,
          "429": errorResponse,
          "502": errorResponse,
        },
      },
    },
    "/api/auth/google/callback": {
      get: {
        tags: ["Auth"],
        summary: "Finish Google login",
        description:
          "Browser callback from Supabase. Requires the verifier cookie from initiation and a valid PKCE code. Only existing admin-provisioned profiles can enter the app. Do not call this manually to start login.",
        parameters: [
          {
            name: "code",
            in: "query",
            schema: { type: "string" },
            description: "Single-use code supplied by Supabase.",
          },
          {
            name: "error",
            in: "query",
            schema: { type: "string" },
            description: "Provider failure or cancellation.",
          },
        ],
        responses: {
          "303": {
            description:
              "Redirect to /dashboard on success, or /login with a fixed auth_error code on failure",
            headers: {
              Location: { schema: { type: "string", format: "uri" } },
            },
          },
          "429": errorResponse,
        },
      },
    },
    "/api/users": {
      get: {
        tags: ["Users"],
        summary: "List users (permission required)",
        security: [{ session: [] }],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 1000000,
              default: 1,
            },
          },
          {
            name: "sort_by",
            in: "query",
            description: "Sort before pagination; defaults to created_at.",
            schema: { type: "string", enum: [...USER_SORT_FIELDS] },
          },
          {
            name: "sort_order",
            in: "query",
            description:
              "asc or desc; defaults to desc for created_at and asc for other fields.",
            schema: { type: "string", enum: ["asc", "desc"] },
          },
          {
            name: "page_size",
            in: "query",
            schema: {
              type: "integer",
              enum: [...PAGE_SIZE_OPTIONS],
              default: DEFAULT_PAGE_SIZE,
            },
          },
          {
            name: "search",
            in: "query",
            description: "Case-insensitive name or email search",
            schema: { type: "string", maxLength: 254 },
          },
          {
            name: "filters",
            in: "query",
            description:
              "JSON-encoded QuickFilters. Same-field conditions use OR; different fields, date, role status, membership and search combine with AND. Applied before pagination; company/role values are UUIDs.",
            schema: { type: "string", maxLength: 12000 },
          },
        ],
        responses: {
          "200": {
            description: "Paginated users",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UsersPage" },
              },
            },
          },
          "400": errorResponse,
          "401": errorResponse,
          "403": errorResponse,
          "500": errorResponse,
        },
      },
      post: {
        tags: ["Users"],
        summary:
          "Create an email-confirmed account with optional company roles (permission required)",
        description:
          "Requires the application's Origin header. Admin sets the initial password; no invitation email is sent. Company and roles may be omitted. Roles require a company; a company can have no roles.",
        security: [{ session: [] }],
        requestBody: jsonBody({ $ref: "#/components/schemas/CreateUser" }),
        responses: {
          "201": {
            description: "User created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateUserResponse" },
              },
            },
          },
          "400": errorResponse,
          "401": errorResponse,
          "403": errorResponse,
          "409": errorResponse,
          "429": errorResponse,
          "500": errorResponse,
          "502": errorResponse,
        },
      },
    },
    "/api/users/{id}/assignments": {
      post: {
        tags: ["Users"],
        summary: "Assign a company and company roles to a user",
        description:
          "Creates or updates one membership and replaces that membership's roles. Roles are shared templates; their pages and permissions come from the role.",
        security: [{ session: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: jsonBody({ $ref: "#/components/schemas/AssignUser" }),
        responses: {
          "200": {
            description: "Updated user",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateUserResponse" },
              },
            },
          },
          "400": errorResponse,
          "401": errorResponse,
          "403": errorResponse,
          "404": errorResponse,
          "500": errorResponse,
        },
      },
    },
    "/api/users/filter-options": {
      get: {
        tags: ["Users"],
        summary: "Get Quick Filter choices from visible users",
        security: [{ session: [] }],
        responses: {
          "200": {
            description:
              "Fields, role-status and membership choices. Counts describe all visible records before the current search filters.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserFilterOptions" },
              },
            },
          },
          "401": errorResponse,
          "403": errorResponse,
          "500": errorResponse,
        },
      },
    },
    "/api/users/options": {
      get: {
        tags: ["Users"],
        summary: "Get companies and company roles (permission required)",
        security: [{ session: [] }],
        responses: {
          "200": {
            description: "Creation options",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserOptions" },
              },
            },
          },
          "401": errorResponse,
          "403": errorResponse,
          "500": errorResponse,
        },
      },
    },
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "API liveness",
        responses: { "200": { description: "API is running" } },
      },
    },
    "/api/auth/session": {
      get: {
        tags: ["Auth"],
        summary: "Get verified user and global roles",
        security: [{ session: [] }],
        responses: {
          "200": {
            description:
              "Verified user with display name and global role slugs",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Session" },
              },
            },
          },
          "401": errorResponse,
          "403": errorResponse,
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Sign in",
        requestBody: jsonBody({ $ref: "#/components/schemas/Credentials" }),
        responses: {
          "200": {
            description: "Session cookies set; user includes profile name",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginResponse" },
              },
            },
          },
          "400": errorResponse,
          "401": errorResponse,
          "403": errorResponse,
          "429": errorResponse,
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Sign out",
        responses: {
          "200": { description: "Session cleared" },
          "400": errorResponse,
          "403": errorResponse,
          "429": errorResponse,
        },
      },
    },
  },
};

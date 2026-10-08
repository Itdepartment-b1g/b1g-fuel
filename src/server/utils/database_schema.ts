import { randomUUID } from "node:crypto";
import { boolean, pgEnum, pgTable, primaryKey, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

// Query mappings for the existing database. Prisma migrations remain the schema authority.
const createdAt = () => timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true, precision: 6 }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date());
const assignedAt = () => timestamp("assigned_at", { withTimezone: true, precision: 6 }).notNull().defaultNow();
const generatedId = () => uuid("id").primaryKey().$defaultFn(randomUUID);

export const roleScope = pgEnum("role_scope", ["global", "company"]);
export const userTable = pgTable("user", {
  id: uuid("id").primaryKey(),
  name: varchar("name", { length: 250 }).notNull(),
  email: text("email"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
export const companyTable = pgTable("company", {
  id: generatedId(), name: varchar("name", { length: 160 }).notNull(),
  created_at: createdAt(), updated_at: updatedAt(),
});
export const roleTable = pgTable("roles", {
  id: generatedId(), name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  scope: roleScope("scope").notNull().default("company"),
  is_system: boolean("is_system").notNull().default(false),
  is_default_role: boolean("is_default_role").notNull().default(false),
  created_at: createdAt(), updated_at: updatedAt(),
});
export const userRoleTable = pgTable("user_role", {
  user_id: uuid("user_id").notNull(), role_id: uuid("role_id").notNull(),
  scope: roleScope("scope").notNull().default("global"), assigned_at: assignedAt(),
}, (table) => [primaryKey({ columns: [table.user_id, table.role_id] })]);
export const userCompanyTable = pgTable("user_company", {
  id: generatedId(), user_id: uuid("user_id").notNull(), company_id: uuid("company_id").notNull(),
  assigned_at: assignedAt(), created_at: createdAt(), updated_at: updatedAt(),
});
export const userCompanyRoleTable = pgTable("user_company_role", {
  user_company_id: uuid("user_company_id").notNull(), role_id: uuid("role_id").notNull(),
  scope: roleScope("scope").notNull().default("company"), assigned_at: assignedAt(),
}, (table) => [primaryKey({ columns: [table.user_company_id, table.role_id] })]);
export const rolePageTable = pgTable("role_pages", {
  role_id: uuid("role_id").notNull(), page_key: varchar("page_key", { length: 120 }).notNull(),
}, (table) => [primaryKey({ columns: [table.role_id, table.page_key] })]);
export const rolePermissionTable = pgTable("role_permissions", {
  role_id: uuid("role_id").notNull(), permission_key: varchar("permission_key", { length: 120 }).notNull(),
}, (table) => [primaryKey({ columns: [table.role_id, table.permission_key] })]);

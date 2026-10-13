import { PAGE_CATALOG } from "./catalog";

export const PERMISSION_ACTIONS = ["view", "edit", "add", "delete"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];
export type PermissionCatalogItem = {
  key: string;
  label: string;
  page_key: string;
  action: PermissionAction;
};

// These keys describe saved role settings. Administrative routes still require super-admin access.
export const PERMISSION_CATALOG: readonly PermissionCatalogItem[] = PAGE_CATALOG.flatMap((page) =>
  PERMISSION_ACTIONS.map((action) => ({
    key: action === "view" ? page.view_permission ?? `${page.key}.view` : `${page.key}.${action}`,
    label: action[0].toUpperCase() + action.slice(1),
    page_key: page.key,
    action,
  })),
);

import { PAGE_CATALOG } from "./catalog";

// Register supported action permissions here when their enforcement is implemented.
export const PERMISSION_CATALOG: readonly { key: string; label: string }[] = PAGE_CATALOG.flatMap((page) =>
  page.view_permission ? [{ key: page.view_permission, label: `View ${page.label}` }] : [],
);

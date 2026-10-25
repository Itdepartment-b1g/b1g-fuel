export const PAGE_KEYS = {
  home: "home",
  users: "users",
  roles: "roles",
  companies: "companies",
  measurements: "measurements",
  brandsAndVariants: "brandsAndVariants",
  suppliers: "suppliers",
  productTypes: "productTypes",
  purchaseOrders: "purchaseOrders",
  receiving: "receiving",
  hubs: "hubs",
  materialRequests: "materialRequests",
  materialRequestReceiving: "materialRequestReceiving",
} as const;

export type PageKey = (typeof PAGE_KEYS)[keyof typeof PAGE_KEYS];

export type PageCatalogItem = {
  key: PageKey;
  label: string;
  href: string;
  group?: string;
  view_permission?: string;
  navigation?: boolean;
};

export type PageCatalogGroup = {
  key: string;
  label: string;
};

// Register pages and groups here when their features are added.
// A later item may reuse a key so the sidebar can open another screen with the same access.
// Role pages and permissions use the first item for that key.
export function uniquePageCatalog(
  items: readonly PageCatalogItem[] = PAGE_CATALOG,
) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

export const PAGE_CATALOG: readonly PageCatalogItem[] = [
  {
    key: PAGE_KEYS.home,
    label: "Dashboard",
    href: "/dashboard",
    view_permission: "home.view",
  },
  {
    key: PAGE_KEYS.users,
    label: "Users",
    href: "/users",
    view_permission: "users.view",
  },
  {
    key: PAGE_KEYS.roles,
    label: "Roles",
    href: "/roles",
    view_permission: "roles.view",
  },
  {
    key: PAGE_KEYS.companies,
    label: "Companies",
    href: "/companies",
    view_permission: "companies.view",
  },
  {
    key: PAGE_KEYS.hubs,
    label: "Hubs",
    href: "/hubs",
    view_permission: "hubs.view",
  },
  {
    key: PAGE_KEYS.suppliers,
    label: "Suppliers",
    href: "/suppliers",
    view_permission: "suppliers.view",
    group: "procurement",
  },
  {
    key: PAGE_KEYS.brandsAndVariants,
    label: "Brands & Variants",
    href: "/brands-and-variants",
    view_permission: "brandsAndVariants.view",
    navigation: true,
    group: "procurement",
  },
  {
    key: PAGE_KEYS.productTypes,
    label: "Product types",
    href: "/product-types",
    view_permission: "productTypes.view",
    group: "procurement",
  },
  {
    key: PAGE_KEYS.measurements,
    label: "Measurements",
    href: "/measurements",
    view_permission: "measurements.view",
    group: "procurement",
  },
  {
    key: PAGE_KEYS.purchaseOrders,
    label: "Purchase orders",
    href: "/purchase-orders",
    view_permission: "purchaseOrders.view",
    group: "procurement",
  },
  {
    key: PAGE_KEYS.receiving,
    label: "Purchase order receiving",
    href: "/purchase-order-receiving",
    view_permission: "receiving.view",
    group: "procurement",
  },
  {
    key: PAGE_KEYS.materialRequests,
    label: "Material requests",
    href: "/material-requests",
    view_permission: "materialRequests.view",
    group: "procurement",
  },
  {
    key: PAGE_KEYS.materialRequestReceiving,
    label: "Material request receiving",
    href: "/material-request-receiving",
    view_permission: "materialRequestReceiving.view",
    group: "procurement",
  },
];
export const PAGE_GROUPS: readonly PageCatalogGroup[] = [
  { key: "procurement", label: "Procurement" },
];

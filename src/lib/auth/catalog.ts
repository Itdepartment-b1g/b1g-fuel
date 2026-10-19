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
export const PAGE_CATALOG: readonly PageCatalogItem[] = [
  { key: PAGE_KEYS.materialRequests, label: "Material requests", href: "/material-requests", view_permission: "materialRequests.view" },
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
    key: PAGE_KEYS.measurements,
    label: "Measurements",
    href: "/measurements",
    view_permission: "measurements.view",
  },
  {
    key: PAGE_KEYS.brandsAndVariants,
    label: "Brands & Variants",
    href: "/brands-and-variants",
    view_permission: "brandsAndVariants.view",
    navigation: true,
  },
  {
    key: PAGE_KEYS.suppliers,
    label: "Suppliers",
    href: "/suppliers",
    view_permission: "suppliers.view",
  },
  {
    key: PAGE_KEYS.productTypes,
    label: "Product types",
    href: "/product-types",
    view_permission: "productTypes.view",
  },
  {
    key: PAGE_KEYS.purchaseOrders,
    label: "Purchase orders",
    href: "/purchase-orders",
    view_permission: "purchaseOrders.view",
  },
  {
    key: PAGE_KEYS.receiving,
    label: "Receiving",
    href: "/receiving",
    view_permission: "receiving.view",
  },
  {
    key: PAGE_KEYS.hubs,
    label: "Hubs",
    href: "/hubs",
    view_permission: "hubs.view",
  },
];
export const PAGE_GROUPS: readonly PageCatalogGroup[] = [];

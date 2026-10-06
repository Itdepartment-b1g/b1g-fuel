export const PAGE_KEYS = {
  home: "home",
} as const;

export type PageKey = (typeof PAGE_KEYS)[keyof typeof PAGE_KEYS];

export type PageCatalogItem = {
  key: PageKey;
  label: string;
  href: string;
  group?: string;
  view_permission?: string;
};

export type PageCatalogGroup = {
  key: string;
  label: string;
};

// Register pages and groups here when their features are added.
export const PAGE_CATALOG: readonly PageCatalogItem[] = [];
export const PAGE_GROUPS: readonly PageCatalogGroup[] = [];

export interface PaginationMetadata {
  // Current page number, starting at 1.
  page: number;
  // Maximum number of items displayed per page.
  limit: number;
  // Total number of matching items.
  total: number;
  // Total number of pages, or zero when there are no items.
  total_pages: number;
  // Whether another page follows the current page.
  has_next_page: boolean;
  // Whether a page precedes the current page.
  has_prev_page: boolean;
}

export interface PaginatedItems<T> extends PaginationMetadata {
  // Items belonging to the current page.
  items: T[];
}

export type PageNumber = number | "ellipsis";

export interface ApiPaginationMetadata {
  // Page number returned by the API.
  page: number;
  // Maximum number of records per API page.
  page_size: number;
  // Total number of matching records across all pages.
  total: number;
}

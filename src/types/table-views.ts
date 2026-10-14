export interface TableSort {
  // Field used to order the table rows.
  field: string;
  // Ascending or descending sort direction.
  direction: "asc" | "desc";
}

export type SortValue = string | number | boolean | Date | null | undefined;

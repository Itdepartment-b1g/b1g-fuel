export type DatePreset =
  | "all"
  | "this_month"
  | "last_month"
  | "last_3_months"
  | "last_6_months"
  | "this_year"
  | "last_year"
  | "custom";

export interface DateRangeFilterValue {
  // Selected predefined range or custom date selection.
  preset: DatePreset;
  // Optional starting date for a custom range.
  customStart?: Date;
  // Optional ending date for a custom range.
  customEnd?: Date;
}

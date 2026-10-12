export type DatePreset =
  | "all"
  | "this_month"
  | "last_month"
  | "last_3_months"
  | "last_6_months"
  | "this_year"
  | "last_year"
  | "custom";

export type DateRangeFilterValue = {
  preset: DatePreset;
  customStart?: Date;
  customEnd?: Date;
};

export const ALL_TIME_DATE_RANGE: DateRangeFilterValue = { preset: "all" };

const PRESET_LABELS: Record<DatePreset, string> = {
  all: "All Time",
  this_month: "This Month",
  last_month: "Last Month",
  last_3_months: "Last 3 Months",
  last_6_months: "Last 6 Months",
  this_year: "This Year",
  last_year: "Last Year",
  custom: "Select dates...",
};

export const DATE_PRESET_BUTTONS: {
  preset: Exclude<DatePreset, "all" | "custom">;
  label: string;
}[] = [
  { preset: "this_month", label: PRESET_LABELS.this_month },
  { preset: "last_month", label: PRESET_LABELS.last_month },
  { preset: "last_3_months", label: PRESET_LABELS.last_3_months },
  { preset: "last_6_months", label: PRESET_LABELS.last_6_months },
  { preset: "this_year", label: PRESET_LABELS.this_year },
  { preset: "last_year", label: PRESET_LABELS.last_year },
];

export function formatDateForInput(date?: Date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseDateFromInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(`${value}T00:00:00`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

export function getDatePresetLabel(
  preset: DatePreset,
  customStart?: Date,
  customEnd?: Date,
) {
  if (preset === "custom") {
    if (customStart && customEnd) {
      return `${formatDateForInput(customStart)} to ${formatDateForInput(customEnd)}`;
    }
    return "Select dates...";
  }
  return PRESET_LABELS[preset] ?? "All Time";
}

function startOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
}

function endOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

function monthsBeforeToday(months: number, today: Date) {
  return new Date(
    today.getFullYear(),
    today.getMonth() - months,
    today.getDate(),
    0,
    0,
    0,
    0,
  );
}

export function getDateRangeFromPreset(
  preset: DatePreset,
  customStart?: Date,
  customEnd?: Date,
  today = new Date(),
): { start?: Date; end?: Date } {
  if (preset === "this_month") {
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0),
      end: new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      ),
    };
  }
  if (preset === "last_month") {
    return {
      start: new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        1,
        0,
        0,
        0,
        0,
      ),
      end: new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999),
    };
  }
  if (preset === "last_3_months" || preset === "last_6_months") {
    return {
      start: monthsBeforeToday(preset === "last_3_months" ? 3 : 6, today),
      end: endOfDay(today),
    };
  }
  if (preset === "this_year") {
    return {
      start: new Date(today.getFullYear(), 0, 1, 0, 0, 0, 0),
      end: new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999),
    };
  }
  if (preset === "last_year") {
    const year = today.getFullYear() - 1;
    return {
      start: new Date(year, 0, 1, 0, 0, 0, 0),
      end: new Date(year, 11, 31, 23, 59, 59, 999),
    };
  }
  if (preset === "custom") {
    if (!customStart || Number.isNaN(customStart.getTime())) return {};
    const endDate =
      customEnd && !Number.isNaN(customEnd.getTime()) ? customEnd : customStart;
    return { start: startOfDay(customStart), end: endOfDay(endDate) };
  }
  return {};
}

function localNoon(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12,
    0,
    0,
    0,
  );
}

function candidateAtNoon(orderDate: string | Date) {
  if (orderDate instanceof Date) {
    return Number.isNaN(orderDate.getTime()) ? undefined : localNoon(orderDate);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(orderDate)) {
    const parsed = parseDateFromInput(orderDate);
    return parsed ? localNoon(parsed) : undefined;
  }
  const parsed = new Date(orderDate);
  return Number.isNaN(parsed.getTime()) ? undefined : localNoon(parsed);
}

export function isDateInRange(
  orderDate: string | Date,
  start?: Date,
  end?: Date,
) {
  if (!start && !end) return true;
  const candidate = candidateAtNoon(orderDate);
  if (!candidate) return false;
  if (start && !Number.isNaN(start.getTime()) && candidate < startOfDay(start)) {
    return false;
  }
  if (end && !Number.isNaN(end.getTime()) && candidate > endOfDay(end)) {
    return false;
  }
  return true;
}

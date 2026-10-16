const MANILA = "Asia/Manila";

export function purchase_order_code(name: string) {
  const words = name.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  const initials = words.map((word) => word[0]).join("");
  if (initials.length >= 3) return initials;
  const extra = words.map((word) => word.slice(1)).join("");
  return (initials + extra + "XXX").slice(0, 3);
}

export function purchase_order_number(companyName: string, createdAt: Date, seq: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(createdAt);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  return `PO-${purchase_order_code(companyName)}-${year}${month}-${String(seq).padStart(7, "0")}`;
}

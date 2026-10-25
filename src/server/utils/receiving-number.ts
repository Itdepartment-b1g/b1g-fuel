const MANILA = "Asia/Manila";

export function company_code(name: string) {
  const letters = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (letters.slice(0, 3) || "xxx").padEnd(3, "x").toUpperCase();
}

export function receiving_number(companyName: string, postedAt: Date, seq: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(postedAt);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  return `RRPO-${company_code(companyName)}-${year}${month}-${String(seq).padStart(7, "0")}`;
}

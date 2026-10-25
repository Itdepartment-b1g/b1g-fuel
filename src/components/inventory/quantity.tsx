export function formatQuantity(value: string) {
  const [integer, decimal] = value.split(".");
  const fraction = decimal?.replace(/0+$/, "");
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction ? `.${fraction}` : "");
}

export function MovementQuantity({ value, unit }: { value: string; unit?: string }) {
  const zero = /^-?0(?:\.0+)?$/.test(value);
  return <span className={`tabular-nums ${zero ? "text-muted-foreground" : value.startsWith("-") ? "text-red-600" : "text-emerald-700"}`}>
    {!zero && !value.startsWith("-") ? "+" : ""}{formatQuantity(value)}{unit ? ` ${unit}` : ""}
  </span>;
}

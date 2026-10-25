function escape_xml(value: string) {
  return value.replace(/[\p{Cc}\p{Cs}]/gu, (character) => ["\n", "\r", "\t"].includes(character) ? character : "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function inventory_spreadsheet(columns: string[], rows: (string | null)[][]) {
  const table = [columns, ...rows].map((row) => `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${escape_xml(cell ?? "Unavailable")}</Data></Cell>`).join("")}</Row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Stock movements"><Table>${table}</Table></Worksheet></Workbook>`;
}

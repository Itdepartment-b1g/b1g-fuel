import type { TableColumn } from "@/components/common/table-view";
import type { SupplierSummary } from "@/types/suppliers";
import { formatDate } from "@/utils/date";

export const SUPPLIER_TABLE_COLUMNS: TableColumn<SupplierSummary>[] = [
  {
    id: "name",
    header: "Supplier",
    sortable: true,
    freezable: true,
    value: (supplier) => supplier.name,
    className: "font-semibold",
  },
  {
    id: "company",
    header: "Company",
    freezable: true,
    cell: (supplier) => supplier.company?.name ?? "All companies",
  },
  {
    id: "contact_person",
    header: "Contact",
    value: (supplier) => supplier.contact_person,
  },
  {
    id: "contact_email",
    header: "Email",
    value: (supplier) => supplier.contact_email,
  },
  {
    id: "contact_phone",
    header: "Phone",
    cell: (supplier) => supplier.contact_phone || "—",
  },
  {
    id: "contact_address",
    header: "Address",
    cell: (supplier) => supplier.contact_address || "—",
  },
  {
    id: "created_by",
    header: "Created by",
    freezable: true,
    cell: (supplier) => supplier.created_by_name || "—",
  },
  {
    id: "created_at",
    header: "Created",
    sortable: true,
    freezable: true,
    cell: (supplier) => (
      <time dateTime={supplier.created_at}>{formatDate(supplier.created_at)}</time>
    ),
  },
];

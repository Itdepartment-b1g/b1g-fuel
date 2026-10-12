"use client";

import { useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import {
  DataTable,
  type DataTableColumn,
  type DataTableAction,
} from "./data-table";

type Item = {
  id: string;
  name: string;
  quantity: number | null;
  created_at: string;
  location: string;
};
const items: Item[] = [
  {
    id: "lpg-1",
    name: "LPG 11kg",
    quantity: 120,
    created_at: "2026-10-12T04:00:00Z",
    location: "Main warehouse",
  },
  {
    id: "lpg-2",
    name: "LPG 2kg",
    quantity: 300,
    created_at: "2026-10-10T04:00:00Z",
    location: "Branch warehouse",
  },
  {
    id: "butane",
    name: "Butane 220g",
    quantity: null,
    created_at: "2026-10-08T04:00:00Z",
    location: "Main warehouse",
  },
];
const baseColumns: DataTableColumn<Item>[] = [
  {
    id: "name",
    header: "Item Name",
    width: 240,
    sortable: true,
    value: (item) => item.name,
  },
  {
    id: "quantity",
    header: "Quantity",
    width: 150,
    sortable: true,
    value: (item) => item.quantity,
  },
  {
    id: "created_at",
    header: "Date Added",
    width: 200,
    sortable: true,
    value: (item) => new Date(item.created_at),
    cell: (item) =>
      new Date(item.created_at).toLocaleDateString("en-PH", {
        timeZone: "Asia/Manila",
      }),
  },
];

/** Five standalone configurations; these examples use local fixtures and never mutate API records. */
export function DataTableExamples() {
  const [notice, setNotice] = useState("");
  const actions: DataTableAction<Item>[] = [
    {
      id: "view",
      label: "View Details",
      icon: <Eye />,
      onSelect: (item) => setNotice(item.name + ": " + item.location),
    },
    {
      id: "edit",
      label: "Edit",
      icon: <Pencil />,
      onSelect: (item) => setNotice("Edit selected for " + item.name),
    },
    {
      id: "delete",
      label: "Delete",
      icon: <Trash2 />,
      destructive: true,
      disabled: (item) => item.quantity !== 0,
      description: "Only empty items can be deleted in this example",
      onSelect: (item) => setNotice("Delete selected for " + item.name),
    },
  ];
  const details = (item: Item) => (
    <div className="grid gap-4 text-sm sm:grid-cols-2">
      <div>
        <h3 className="mb-2 font-semibold text-primary">Item details</h3>
        <p>Item code: {item.id}</p>
        <p>Item name: {item.name}</p>
      </div>
      <div>
        <h3 className="mb-2 font-semibold text-primary">Stock information</h3>
        <p>Quantity: {item.quantity ?? "Not recorded"}</p>
        <p>Location: {item.location}</p>
      </div>
    </div>
  );
  return (
    <div className="space-y-6">
      {notice && (
        <p
          role="status"
          className="rounded-lg bg-blue-50 p-3 text-sm text-primary"
        >
          {notice}
        </p>
      )}
      {(
        [
          "Normal table with sorting",
          "Sorting and accordion",
          "Sorting and row actions",
          "Sorting and frozen columns",
          "All features enabled",
        ] as const
      ).map((title, index) => (
        <section
          key={title}
          className="overflow-hidden rounded-xl border bg-white"
        >
          <h2 className="border-b p-4 font-semibold text-primary">{title}</h2>
          <DataTable
            caption={title}
            data={items}
            rowKey={(item) => item.id}
            columns={baseColumns.map((column) => ({
              ...column,
              freezable: index >= 3,
            }))}
            multipleFrozenColumns={index >= 3}
            initialFrozenColumns={index >= 3 ? ["name"] : []}
            expandedRow={index === 1 || index === 4 ? details : undefined}
            expansionMode={index === 4 ? "multiple" : "single"}
            actions={index === 2 || index === 4 ? actions : undefined}
          />
        </section>
      ))}
    </div>
  );
}

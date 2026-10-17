"use client";

import { useState } from "react";
import { Building2, Eye, Pencil, Trash2 } from "lucide-react";
import { CardActionsMenu } from "@/components/common/card-actions-menu";
import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";
import type { CompanySummary } from "@/types/companies";
import { type CompanyActionProps } from "../table-view/companies-table-view";
import { formatDate } from "@/utils/date";
import { ViewCompanyDialog } from "../dialog/view-company-dialog";

export function CompaniesCards({
  companies,
  onEdit,
  onDelete,
  disabled,
}: CompanyActionProps & { companies: CompanySummary[] }) {
  const access = useRecordAccess();
  const [viewing, setViewing] = useState<CompanySummary | null>(null);
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
      {companies.map((company) => (
        <article key={company.id} className="rounded-xl border p-5">
          <div className="mb-4 flex items-start justify-between gap-2">
            <Building2 className="size-7 text-primary" aria-hidden="true" />
            <CardActionsMenu
              label={`Actions for ${company.name}`}
              items={[
                { id: "view", label: "View", icon: <Eye />, onSelect: () => setViewing(company) },
                {
                  id: "edit",
                  label: "Edit",
                  icon: <Pencil />,
                  disabled: disabled || !canPerform(access, "companies", "edit", company),
                  onSelect: () => onEdit(company),
                },
                {
                  id: "delete",
                  label: "Delete",
                  icon: <Trash2 />,
                  destructive: true,
                  description: company.member_count ? "Companies with members cannot be deleted" : undefined,
                  disabled: disabled || company.member_count > 0 || !canPerform(access, "companies", "delete", company),
                  onSelect: () => onDelete(company),
                },
              ]}
            />
          </div>
          <h2 className="break-words font-semibold">{company.name}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {company.member_count === 0
              ? "No members"
              : `${company.member_count} ${company.member_count === 1 ? "member" : "members"}`}
            {" · "}
            {company.is_warehouse ? "Has warehouse" : "No warehouse"}
          </p>
          {company.is_warehouse && (
            <p className="mt-1 text-sm text-muted-foreground">
              {company.warehouse_name}
              {company.warehouse_address
                ? ` · ${company.warehouse_address}`
                : ""}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Created {formatDate(company.created_at)}
          </p>
        </article>
      ))}
      {viewing && <ViewCompanyDialog company={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

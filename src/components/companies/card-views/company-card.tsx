import { Building2 } from "lucide-react";
import type { CompanySummary } from "@/server/schema/companies_schema";
import {
  CompanyActions,
  CompanyDate,
  type CompanyActionProps,
} from "../table-view/companies-table-view";

export function CompanyCard({
  company,
  onEdit,
  onDelete,
  disabled,
}: CompanyActionProps & { company: CompanySummary }) {
  return (
    <article className="rounded-xl border p-5">
      <Building2 className="mb-4 size-7 text-primary" aria-hidden="true" />
      <h2 className="break-words font-semibold">{company.name}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {company.member_count}{" "}
        {company.member_count === 1 ? "member" : "members"}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Created <CompanyDate value={company.created_at} />
      </p>
      <div className="mt-4 border-t pt-2">
        <CompanyActions
          company={company}
          onEdit={onEdit}
          onDelete={onDelete}
          disabled={disabled}
        />
      </div>
    </article>
  );
}

import { Building2 } from "lucide-react";
import type { CompanySummary } from "@/server/schema/companies_schema";
import {
  CompanyActions,
  CompanyDate,
  type CompanyActionProps,
} from "../table-view/companies-table-view";

export function CompaniesCards({
  companies,
  onEdit,
  onDelete,
  disabled,
}: CompanyActionProps & { companies: CompanySummary[] }) {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
      {companies.map((company) => (
        <article key={company.id} className="rounded-xl border p-5">
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
      ))}
    </div>
  );
}

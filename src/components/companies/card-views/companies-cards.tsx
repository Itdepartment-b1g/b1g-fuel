import type { CompanySummary } from "@/server/schema/companies_schema";
import type { CompanyActionProps } from "../table-view/companies-table-view";
import { CompanyCard } from "./company-card";

export function CompaniesCards({
  companies,
  onEdit,
  onDelete,
  disabled,
}: CompanyActionProps & { companies: CompanySummary[] }) {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
      {companies.map((company) => (
        <CompanyCard
          key={company.id}
          company={company}
          onEdit={onEdit}
          onDelete={onDelete}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

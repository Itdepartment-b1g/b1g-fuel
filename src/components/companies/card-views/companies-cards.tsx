"use client";

import { useState } from "react";
import { Building2, ChevronDown } from "lucide-react";
import { CompanyMembers } from "../company-members";
import type { CompanySummary } from "@/types/companies";
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
      {companies.map((company) => (
        <article key={company.id} className="rounded-xl border p-5">
          <Building2 className="mb-4 size-7 text-primary" aria-hidden="true" />
          <h2 className="break-words font-semibold">{company.name}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {company.member_count}{" "}
            {company.member_count === 1 ? "member" : "members"}
            {" · "}
            {company.location_count ?? 0}{" "}
            {(company.location_count ?? 0) === 1 ? "location" : "locations"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Created <CompanyDate value={company.created_at} />
          </p>
          <button
            type="button"
            className="mt-4 flex w-full items-center justify-between text-sm font-medium"
            aria-expanded={expandedId === company.id}
            aria-controls={`company-members-${company.id}`}
            onClick={() => setExpandedId((current) => current === company.id ? null : company.id)}
          >
            View members
            <ChevronDown className={`size-4 transition-transform ${expandedId === company.id ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          <div id={`company-members-${company.id}`} hidden={expandedId !== company.id} className="mt-3">
            {expandedId === company.id && <CompanyMembers key={company.id} companyId={company.id} />}
          </div>
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

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRecordAccess } from "@/components/providers/access-provider";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/common/pagination";
import { TableView } from "@/components/common/table-view";
import { canPerform } from "@/lib/auth/access-scope";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { listCompanyMembers, selectCompany } from "@/lib/store/companies-slice";
import { formatDateTime } from "@/utils/date";
import { paginationFromApi } from "@/utils/pagination";
import type { CompanyMember } from "@/types/companies";

const PAGE_SIZE = 10;

export function CompanyMembers({ companyId }: { companyId: string }) {
  const access = useRecordAccess();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const allowed = canPerform(access, "users", "view");
  const {
    members,
    membersTotal,
    membersPage,
    membersPageSize,
    membersCompanyId,
    membersStatus,
    membersError,
  } = useAppSelector(selectCompany);
  const [page, setPage] = useState(1);
  const current = membersCompanyId === companyId;
  const loading = !current || membersStatus === "idle" || membersStatus === "loading";
  const error = current && membersStatus === "failed" ? membersError?.message : null;
  const pagination = paginationFromApi({
    page: current ? membersPage : page,
    page_size: current ? membersPageSize : PAGE_SIZE,
    total: current ? membersTotal : 0,
  });

  useEffect(() => {
    if (!allowed) return;
    const request = dispatch(listCompanyMembers({ id: companyId, page, page_size: PAGE_SIZE }));
    return () => request.abort();
  }, [dispatch, companyId, page, allowed]);

  useEffect(() => {
    if (membersError?.status === 401) router.replace("/login");
  }, [membersError, router]);

  if (!allowed) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view members.</p>;
  }

  return (
    <section aria-label="Company members" aria-busy={loading} className="space-y-3">
      <h3 className="text-sm font-semibold">Members</h3>
      {error ? (
        <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
          <span>{error}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void dispatch(listCompanyMembers({ id: companyId, page, page_size: PAGE_SIZE }));
            }}
          >
            Retry
          </Button>
        </div>
      ) : (
        <>
          <TableView<CompanyMember>
            data={current ? members : []}
            rowKey={(member) => member.id}
            caption="Company members and assignment dates"
            loading={loading}
            className="rounded-lg border bg-white"
            emptyTitle="No members"
            emptyDescription="No members available to display."
            columns={[
              {
                id: "name",
                header: "Name",
                className: "font-medium",
                value: (member) => member.name,
              },
              {
                id: "email",
                header: "Email",
                className: "text-muted-foreground",
                value: (member) => member.email ?? "",
                cell: (member) => member.email ?? "No email",
              },
              {
                id: "roles",
                header: "Role",
                className: "text-muted-foreground",
                cell: (member) =>
                  member.roles.map((role) => role.name).join(", ") || "No roles assigned",
              },
              {
                id: "assigned_at",
                header: "Assigned at",
                className: "whitespace-nowrap text-muted-foreground",
                cell: (member) => <time dateTime={member.assigned_at}>{formatDateTime(member.assigned_at)}</time>,
              },
            ]}
          />
          {current && membersTotal > membersPageSize && (
            <Pagination
              metadata={pagination}
              onPrev={() => setPage((value) => value - 1)}
              onNext={() => setPage((value) => value + 1)}
              onPage={setPage}
            />
          )}
        </>
      )}
    </section>
  );
}

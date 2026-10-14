"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRecordAccess } from "@/components/providers/access-provider";
import { Button } from "@/components/ui/button";
import { canPerform } from "@/lib/auth/access-scope";
import type { CompanyMembersPage } from "@/types/companies";

export function CompanyMembers({ companyId }: { companyId: string }) {
  const access = useRecordAccess();
  const router = useRouter();
  const allowed = canPerform(access, "users", "view");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<CompanyMembersPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/companies/members?id=${encodeURIComponent(companyId)}&page=${page}&page_size=10`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (response.status === 401) router.replace("/login");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load members.");
        if (!controller.signal.aborted) setResult(data);
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : "Could not load members.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [companyId, page, revision, allowed, router]);

  if (!allowed) return <p className="text-sm text-muted-foreground">You do not have permission to view members.</p>;
  return (
    <section aria-label="Company members" aria-busy={loading} className="space-y-3">
      <h3 className="text-sm font-semibold">Members</h3>
      {loading ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Loading members…
        </p>
      ) : error ? (
        <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => setRevision((value) => value + 1)}>Retry</Button>
        </div>
      ) : result ? (
        <>
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Company members and assignment dates</caption>
              <thead className="border-b bg-gray-50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Email</th>
                  <th scope="col" className="px-4 py-3">Role</th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3">Assigned at</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {result.members.length ? result.members.map((member) => (
                  <tr key={member.id}>
                    <td className="px-4 py-3 font-medium">{member.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{member.email ?? "No email"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{member.roles.map((role) => role.name).join(", ") || "No roles assigned"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      <time dateTime={member.assigned_at}>
                        {new Date(member.assigned_at).toLocaleString("en-PH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          timeZone: "Asia/Manila",
                        })}
                      </time>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No members available to display.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {result.total > result.page_size && (
            <div className="flex items-center justify-between gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <span className="text-xs text-muted-foreground">Page {page} of {Math.ceil(result.total / result.page_size)}</span>
              <Button size="sm" variant="outline" disabled={page * result.page_size >= result.total} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

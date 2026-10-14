"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRecordAccess } from "@/components/providers/access-provider";
import { Button } from "@/components/ui/button";
import { canPerform } from "@/lib/auth/access-scope";
import type { RoleAssignmentsPage } from "@/server/schema/roles_schema";

export function RoleAssignments({ roleId }: { roleId: string }) {
  const access = useRecordAccess();
  const router = useRouter();
  const allowed = canPerform(access, "users", "view");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<RoleAssignmentsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/roles/assignments?id=${encodeURIComponent(roleId)}&page=${page}&page_size=10`, {
          credentials: "include", signal: controller.signal,
        });
        if (response.status === 401) router.replace("/login");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load assigned users.");
        if (!controller.signal.aborted) setResult(data);
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : "Could not load assigned users.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [roleId, page, revision, allowed, router]);

  if (!allowed) return <p className="text-muted-foreground">You do not have permission to view assigned users.</p>;
  if (loading) return <p role="status" className="text-muted-foreground">Loading assigned users…</p>;
  if (error) return (
    <div role="alert" className="space-y-2 text-destructive">
      <p>{error}</p>
      <Button size="sm" variant="outline" onClick={() => setRevision((value) => value + 1)}>Retry</Button>
    </div>
  );
  if (!result) return null;
  return (
    <div className="space-y-3">
      {result.assignments.length ? (
        <ul className="space-y-2">
          {result.assignments.map((assignment) => (
            <li key={assignment.id}>
              <span className="font-medium">{assignment.name}</span>
              {assignment.company && (
                <span className="text-muted-foreground"> - {assignment.company}</span>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="text-muted-foreground">No assigned users available to display.</p>}
      {result.total > result.page_size && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
          <span className="text-xs text-muted-foreground">Page {page} of {Math.ceil(result.total / result.page_size)}</span>
          <Button size="sm" variant="outline" disabled={page * result.page_size >= result.total} onClick={() => setPage((value) => value + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

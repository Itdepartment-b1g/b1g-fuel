"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loading } from "@/components/common/loading";
import { Pagination } from "@/components/common/pagination";
import {
  useToast,
  toastErrorMessage,
} from "@/components/providers/toast-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  assignHubStaff,
  getHubAssignmentOption,
  listHubAssignment,
  selectHub,
  unassignHub,
} from "@/lib/store/hubs-slice";
import type { HubMember, HubSummary } from "@/types/hubs";
import { paginationFromApi } from "@/utils/pagination";
import { formatDate } from "@/utils/date";

export function AssignHubDialog({
  hub,
  onClose,
  onChanged,
}: {
  hub: HubSummary;
  onClose: () => void;
  onChanged: () => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const toast = useToast();
  const state = useAppSelector(selectHub);
  const [page, setPage] = useState(1);
  const [optionPage, setOptionPage] = useState(1);
  const [selected, setSelected] = useState<HubMember[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const busy = useRef(false);
  const pending = state.mutationStatus === "loading";
  const assignments =
    state.assignmentsLocationId === hub.id &&
    state.assignmentsStatus === "succeeded"
      ? state.assignments
      : null;
  const options =
    state.assignmentOptionsLocationId === hub.id &&
    state.assignmentOptionsStatus === "succeeded"
      ? state.assignmentOptions
      : null;

  useEffect(() => {
    const request = dispatch(
      listHubAssignment({ location_id: hub.id, page, page_size: 10 }),
    );
    request.then((action) => {
      if (listHubAssignment.fulfilled.match(action)) {
        const valid = paginationFromApi(action.payload).page;
        if (valid !== page) setPage(valid);
      }
    });
    return () => request.abort();
  }, [dispatch, hub.id, page, revision]);
  useEffect(() => {
    if (!hub.is_active) return;
    const request = dispatch(
      getHubAssignmentOption({
        location_id: hub.id,
        page: optionPage,
        page_size: 10,
      }),
    );
    request.then((action) => {
      if (getHubAssignmentOption.fulfilled.match(action)) {
        const valid = paginationFromApi(action.payload).page;
        if (valid !== optionPage) setOptionPage(valid);
      }
    });
    return () => request.abort();
  }, [dispatch, hub.id, hub.is_active, optionPage, revision]);
  useEffect(() => {
    if (
      [
        state.assignmentsError,
        state.assignmentOptionsError,
        state.mutationError,
      ].some((error) => error?.status === 401)
    )
      router.replace("/login");
  }, [
    state.assignmentsError,
    state.assignmentOptionsError,
    state.mutationError,
    router,
  ]);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected.length || busy.current || pending) return;
    busy.current = true;
    let assignedIds: string[] = [];
    try {
      const result = await dispatch(
        assignHubStaff({
          location_id: hub.id,
          user_company_ids: selected.map((member) => member.user_company_id),
        }),
      ).unwrap();
      assignedIds = result.assignments.map(
        (assignment) => assignment.user_company_id,
      );
      setOptionPage(1);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "assigned_user_company_ids" in error &&
        Array.isArray(error.assigned_user_company_ids)
      )
        assignedIds = error.assigned_user_company_ids.filter(
          (id): id is string => typeof id === "string",
        );
      toast.error(
        toastErrorMessage(
          error,
          "Could not assign the selected staff. Please retry.",
        ),
      );
    } finally {
      if (assignedIds.length) {
        toast.success(
          `${assignedIds.length} ${assignedIds.length === 1 ? "person was" : "people were"} assigned to ${hub.name}.`,
        );
        setSelected((members) =>
          members.filter(
            (member) => !assignedIds.includes(member.user_company_id),
          ),
        );
        setPage(1);
      }
      onChanged();
      setRevision((value) => value + 1);
      busy.current = false;
    }
  }
  async function remove(membershipId: string, name: string) {
    if (busy.current || pending) return;
    busy.current = true;
    try {
      await dispatch(
        unassignHub({ location_id: hub.id, user_company_id: membershipId }),
      ).unwrap();
      toast.success(`${name} was unassigned from ${hub.name}.`);
      setRemoving(null);
      setSelected([]);
      setRevision((value) => value + 1);
      onChanged();
    } catch (error) {
      toast.error(
        toastErrorMessage(error, "Could not remove this assignment."),
      );
    } finally {
      busy.current = false;
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className={`max-h-[90dvh] overflow-y-auto sm:max-w-2xl ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Assign staff</DialogTitle>
          <DialogDescription>
            {hub.name} · {hub.company.name}. Assign staff or agents from this
            company.
          </DialogDescription>
        </DialogHeader>
        {hub.is_active ? (
          <section className="space-y-3" aria-label="Assign staff or agents">
            {state.assignmentOptionsError ? (
              <div>
                <p role="alert" className="text-sm text-destructive">
                  {state.assignmentOptionsError.message}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => setRevision((value) => value + 1)}
                  disabled={pending}
                >
                  Try again
                </Button>
              </div>
            ) : !options ? (
              <Loading />
            ) : options.members.length ? (
              <div className="space-y-4" aria-busy={pending}>
                <HubStaffChoices
                  members={options.members}
                  selected={selected}
                  disabled={pending}
                  onChange={setSelected}
                />
                {options.total > options.page_size && (
                  <Pagination
                    metadata={paginationFromApi(options)}
                    onPrev={() => setOptionPage(optionPage - 1)}
                    onNext={() => setOptionPage(optionPage + 1)}
                    onPage={setOptionPage}
                    disabled={pending}
                  />
                )}
                <form
                  onSubmit={add}
                  className="flex flex-wrap items-center justify-between gap-3"
                >
                  <p role="status" className="text-sm text-muted-foreground">
                    {selected.length
                      ? `${selected.length} selected`
                      : "Select staff or agents to assign."}
                  </p>
                  <Button type="submit" disabled={pending || !selected.length}>
                    {pending ? (
                      <LoaderCircle
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <UserPlus className="size-4" aria-hidden="true" />
                    )}
                    {pending ? "Assigning..." : "Assign"}
                  </Button>
                </form>
              </div>
            ) : (
              <p role="status" className="text-sm text-muted-foreground">
                All available company members are already assigned.
              </p>
            )}
          </section>
        ) : (
          <p
            role="status"
            className="rounded-lg bg-gray-50 p-4 text-sm text-muted-foreground"
          >
            This hub is inactive. Reactivate it to assign additional staff.
          </p>
        )}
        {state.mutationError && (
          <p role="alert" className="text-sm text-destructive">
            {state.mutationError.message}
          </p>
        )}
        <section
          aria-label="Currently assigned staff"
          className="space-y-3 border-t pt-5"
        >
          <h2 className="text-sm font-semibold">
            Currently assigned{assignments ? ` (${assignments.total})` : ""}
          </h2>
          {state.assignmentsError ? (
            <div>
              <p role="alert" className="text-sm text-destructive">
                {state.assignmentsError.message}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={pending}
                onClick={() => setRevision((value) => value + 1)}
              >
                Try again
              </Button>
            </div>
          ) : !assignments ? (
            <Loading />
          ) : assignments.assignments.length ? (
            <ul className="divide-y rounded-lg border">
              {assignments.assignments.map((assignment) => (
                <li key={assignment.id} className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm">
                        <HubMemberLabel member={assignment} />
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Assigned by{" "}
                        {assignment.assigned_by_name ?? "Unavailable"} ·{" "}
                        {formatDate(assignment.assigned_at)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => setRemoving(assignment.user_company_id)}
                    >
                      Unassign
                    </Button>
                  </div>
                  {removing === assignment.user_company_id && (
                    <div className="flex flex-wrap items-center gap-2 rounded-md bg-gray-50 p-3">
                      <p className="w-full text-sm">
                        Unassign {assignment.user.name} from this hub?
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => setRemoving(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={pending}
                        onClick={() => {
                          void remove(
                            assignment.user_company_id,
                            assignment.user.name,
                          );
                        }}
                      >
                        Confirm unassign
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">
              No staff assigned yet.
            </p>
          )}
          {assignments && assignments.total > assignments.page_size && (
            <Pagination
              metadata={paginationFromApi(assignments)}
              onPrev={() => setPage(page - 1)}
              onNext={() => setPage(page + 1)}
              onPage={setPage}
              disabled={pending}
            />
          )}
        </section>
        <div className="flex justify-end border-t pt-4">
          <Button variant="outline" disabled={pending} onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function HubStaffChoices({
  members,
  selected,
  disabled,
  onChange,
}: {
  members: HubMember[];
  selected: HubMember[];
  disabled: boolean;
  onChange: (members: HubMember[]) => void;
}) {
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="mb-3 text-sm font-semibold">Staff/Agent</legend>
      <div className="flex flex-col gap-2">
        {members.map((member) => {
          const checked = selected.some(
            (item) => item.user_company_id === member.user_company_id,
          );
          return (
            <label
              key={member.user_company_id}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-primary/40 ${checked ? "border-primary bg-primary/5" : "border-border hover:bg-gray-50"} ${disabled ? "cursor-wait opacity-60" : ""}`}
            >
              <input
                type="checkbox"
                name="staff"
                value={member.user_company_id}
                checked={checked}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, member]
                      : selected.filter(
                          (item) =>
                            item.user_company_id !== member.user_company_id,
                        ),
                  )
                }
                className="size-4 shrink-0 accent-primary"
              />
              <span className="min-w-0 break-words">
                <HubMemberLabel member={member} />
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function HubMemberLabel({ member }: { member: HubMember }) {
  return (
    <>
      <span className="font-medium">{member.user.name}</span>
      <span className="ml-1 text-xs font-normal text-muted-foreground">
        ({member.roles.map((role) => role.name).join(", ") || "No role"})
      </span>
      {member.user.email && (
        <span className="break-all text-muted-foreground">
          {" "}
          - {member.user.email}
        </span>
      )}
    </>
  );
}

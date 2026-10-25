"use client";

import type { ReactNode } from "react";
import { ClipboardList } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/common/loading";
import { Timeline, type TimelineEntry } from "./timeline";

export function TimelineDialog({
  title,
  description,
  entries,
  loading = false,
  error,
  onRetry,
  onClose,
  children,
}: {
  title: string;
  description: string;
  entries: readonly TimelineEntry[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <ClipboardList className="size-5" aria-hidden="true" />
            {title}
            {!loading && !error && (
              <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {entries.length} {entries.length === 1 ? "event" : "events"}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {loading ? (
          <Loading />
        ) : error ? (
          <div>
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            {onRetry && (
              <Button variant="outline" className="mt-3" onClick={onRetry}>
                Try again
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {children}
            <Timeline entries={entries} />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

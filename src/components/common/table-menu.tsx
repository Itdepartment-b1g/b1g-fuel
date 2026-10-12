"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type TableMenuItem = {
  id: string; label: string; description?: string; icon?: ReactNode;
  disabled?: boolean; selected?: boolean; destructive?: boolean; separatorBefore?: boolean;
  onSelect: () => void;
};

/** Portal menus remain visible outside horizontally scrolling table containers. */
export function TableMenu({ label, children, items, disabled, className }: {
  label: string; children: ReactNode; items: TableMenuItem[]; disabled?: boolean; className?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const positionMenu = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const height = menu.current?.offsetHeight ?? Math.min(items.length * 64 + 16, 300);
    const desiredTop = rect.bottom + height + 8 <= window.innerHeight ? rect.bottom + 6 : rect.top - height - 6;
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 272)),
      top: Math.max(8, Math.min(desiredTop, window.innerHeight - height - 8)) });
  };
  const close = (restoreFocus = true) => { setOpen(false); if (restoreFocus) trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    };
    // Close on scrolling or resizing so the menu cannot become detached from its trigger.
    const dismiss = (event: Event) => { if (!menu.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", dismiss, true); window.removeEventListener("resize", dismiss);
    };
  }, [open]);
  return <>
    <button ref={trigger} type="button" disabled={disabled} aria-label={label} aria-haspopup="menu"
      aria-expanded={open} aria-controls={open ? id : undefined}
      className={cn("inline-flex min-h-9 items-center gap-2 rounded-md px-2 text-left focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50", open && "bg-primary/10", className)}
      onClick={() => { positionMenu(); setOpen(!open); }}
      onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); positionMenu(); setOpen(true); } }}>
      {children}
    </button>
    {open && createPortal(<div id={id} role="menu" aria-label={label} ref={node => {
      menu.current = node;
      if (node) { node.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus(); }
    }} style={position} className="fixed z-[100] max-h-[calc(100dvh-16px)] w-64 max-w-[calc(100vw-16px)] overflow-y-auto rounded-lg border bg-white p-1.5 text-sm text-primary shadow-lg"
      onBlur={event => { if (event.relatedTarget && event.relatedTarget !== trigger.current && !event.currentTarget.contains(event.relatedTarget)) close(false); }}
      onKeyDown={event => {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
          buttons[next]?.focus();
        } else if (event.key === "Tab") close();
      }}>
      {items.map(item => <div key={item.id}>
        {item.separatorBefore && <div role="separator" className="my-1 border-t" />}
        <button type="button" role={item.selected !== undefined ? "menuitemradio" : "menuitem"}
          aria-checked={item.selected} disabled={item.disabled}
          onClick={() => { close(); item.onSelect(); }}
          className={cn("flex w-full items-start gap-3 rounded-md p-2.5 text-left hover:bg-primary/5 focus:bg-primary/10 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40", item.destructive && "text-destructive")}>
          {item.icon && <span aria-hidden="true" className="mt-0.5 shrink-0 [&_svg]:size-4">{item.icon}</span>}
          <span className="min-w-0 flex-1"><span className="block font-medium">{item.label}</span>{item.description && <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>}</span>
          {item.selected && <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
        </button>
      </div>)}
    </div>, document.body)}
  </>;
}

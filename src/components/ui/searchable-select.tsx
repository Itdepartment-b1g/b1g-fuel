"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, ChevronDown, Search } from "lucide-react";
import { Input } from "./input";
import { searchFilterOptions } from "@/utils/quick-filter";
import type { FilterOption } from "@/types/quick-filter";

export function SearchableSelect({ label, value, options, onChange, anyLabel = "Any" }: {
  label: string; value: string; options: FilterOption[]; onChange: (value: string) => void; anyLabel?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 260, maxHeight: 320 });
  const filtered = searchFilterOptions(options.filter((option) => option.value !== ""), search);
  const choices = [{ value: "", label: anyLabel }, ...filtered];
  const selected = options.find((option) => option.value === value);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const scroll = (event: Event) => { if (event.target instanceof Element && trigger.current && event.target.contains(trigger.current)) close(); };
    // Close on layout changes rather than leaving the dropdown detached from its trigger.
    window.addEventListener("resize", close);
    document.addEventListener("scroll", scroll, true);
    return () => { window.removeEventListener("resize", close); document.removeEventListener("scroll", scroll, true); };
  }, [open]);
  function changeOpen(next: boolean) {
    if (next && trigger.current) {
      const rect = trigger.current.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 260), window.innerWidth - 24);
      const below = window.innerHeight - rect.bottom - 12;
      const maxHeight = Math.min(320, Math.max(below, rect.top - 12));
      setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: below >= 200 ? rect.bottom + 4 : Math.max(12, rect.top - maxHeight - 4), width, maxHeight });
      setSearch(""); setActive(0);
    }
    setOpen(next);
  }
  function select(next: string) { onChange(next); setOpen(false); }
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = (active + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length;
      setActive(next);
      document.getElementById(`${id}-option-${next}`)?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") { event.preventDefault(); select(choices[active]?.value ?? ""); }
  }
  return <Dialog.Root modal={false} open={open} onOpenChange={changeOpen}>
    <Dialog.Trigger asChild><button ref={trigger} type="button" aria-label={label} className="flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-white px-3 text-left text-sm"><span className="truncate">{selected?.label ?? (value || anyLabel)}</span><ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /></button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Content aria-describedby={undefined} className="fixed z-[80] flex flex-col overflow-hidden rounded-lg border bg-white p-2 shadow-xl outline-none" style={position} onEscapeKeyDown={(event) => event.stopPropagation()}>
      <Dialog.Title className="sr-only">{label}</Dialog.Title>
      <div className="relative mb-2"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden="true" /><Input autoFocus role="combobox" aria-label={`Search ${label.toLowerCase()}`} aria-autocomplete="list" aria-expanded="true" aria-controls={`${id}-options`} aria-activedescendant={`${id}-option-${active}`} value={search} onChange={(event) => { setSearch(event.target.value); setActive(0); }} onKeyDown={keyDown} placeholder="Search values…" className="pl-9" /></div>
      <div id={`${id}-options`} role="listbox" aria-label={label} className="min-h-0 overflow-y-auto">{choices.map((option, index) => <button id={`${id}-option-${index}`} key={option.value} role="option" aria-selected={value === option.value} tabIndex={-1} type="button" onMouseEnter={() => setActive(index)} onClick={() => select(option.value)} className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${active === index ? "bg-primary/10" : "hover:bg-slate-50"}`}><Check className={`size-4 shrink-0 text-primary ${value === option.value ? "" : "invisible"}`} aria-hidden="true" /><span className="min-w-0 flex-1 break-words">{option.label}</span>{"count" in option && option.count !== undefined && <span className="text-xs text-muted-foreground">{option.count}</span>}</button>)}</div>
      {!filtered.length && <p role="status" className="px-3 py-4 text-center text-sm text-muted-foreground">No results</p>}
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}

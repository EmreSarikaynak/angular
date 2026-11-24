"use client";
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

/** Açılır/kapanır bölüm kartı: başlığa dokununca içerik yumuşakça açılır (hareket azaltma tercihine saygılı). */
export function Collapsible({
  title,
  icon,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="rounded-2xl border border-border bg-surface">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-4 text-left">
        {icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">{icon}</span>}
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{title}</span>
          {hint && <span className="block truncate text-xs text-muted">{hint}</span>}
        </span>
        <ChevronDown size={18} aria-hidden className={`shrink-0 text-muted transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <div id={id} role="region" className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="space-y-4 px-4 pb-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

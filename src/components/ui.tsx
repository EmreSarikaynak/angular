"use client";
import { Children, cloneElement, isValidElement, useEffect, useId } from "react";
import { X } from "lucide-react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-2xl border border-border bg-surface p-4", className)} {...rest}>
      {children}
    </div>
  );
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
export function Button({
  variant = "primary",
  size = "md",
  className,
  loading,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  const variants: Record<BtnVariant, string> = {
    primary: "bg-primary text-white hover:opacity-90",
    secondary: "bg-surface-2 text-text hover:opacity-80",
    ghost: "text-text hover:bg-surface-2",
    danger: "bg-danger text-white hover:opacity-90",
  };
  const sizes = { sm: "h-9 px-3 text-sm", md: "h-11 px-4 text-sm", lg: "h-12 px-5 text-base" };
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}

/**
 * Etiketli alan. Tek bir form denetimi (Input, Select…) sarıyorsa gerçek <label> ile bağlanır;
 * düğme grubu gibi başka içeriklerde erişilebilir bir "group" olarak işaretlenir
 * (düğmeleri <label> içine koymak, etikete tıklayınca ilk düğmeyi tetikler).
 */
export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string | null; children: React.ReactNode; className?: string }) {
  const id = useId();
  const child = Children.count(children) === 1 && isValidElement<{ id?: string }>(children) ? children : null;
  const isControl = !!child && typeof child.type !== "string" && CONTROLS.has(child.type as unknown as React.ComponentType);
  return (
    <div className={cx("block", className)} role={isControl ? undefined : "group"} aria-labelledby={isControl ? undefined : `${id}-l`}>
      {isControl ? (
        <label htmlFor={child.props.id ?? id} className="mb-1 block text-xs font-medium text-muted">
          {label}
        </label>
      ) : (
        <span id={`${id}-l`} className="mb-1 block text-xs font-medium text-muted">
          {label}
        </span>
      )}
      {isControl ? cloneElement(child, { id: child.props.id ?? id }) : children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </div>
  );
}

const inputCls = "h-11 w-full rounded-xl border border-border bg-surface px-3 text-text placeholder:text-muted/70 focus:border-primary focus:outline-none";

export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(inputCls, className)} {...rest} />;
}

/** Sayı girişi: boş değer null olarak iletilir, virgül ondalık ayırıcı kabul edilir. */
export function NumberInput({
  value,
  onChange,
  className,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      className={cx(inputCls, className)}
      value={value ?? ""}
      onChange={(e) => {
        const raw = e.target.value.replace(",", ".");
        onChange(raw === "" ? null : Number(raw));
      }}
      {...rest}
    />
  );
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputCls, "appearance-none pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputCls, "h-auto min-h-24 py-2.5", className)} {...rest} />;
}

export function Chip({ active, children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted hover:text-text",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <div role="tablist" className={cx("flex rounded-xl bg-surface-2 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx("h-9 flex-1 rounded-lg px-2 text-sm font-medium transition-colors", value === o.value ? "bg-surface text-text shadow-sm" : "text-muted")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Alttan açılan sayfa (mobil) / ortalanmış pencere (masaüstü). */
/** Alttan açılan panel. `footer` verilirse içerik kayarken altta sabit kalır (ör. Kaydet düğmeleri). */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby={id}>
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface shadow-xl sm:max-w-lg sm:rounded-3xl">
        <div className={cx("min-h-0 flex-1 overflow-y-auto p-5", !footer && "pb-safe")}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id={id} className="text-lg font-semibold">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-muted">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
        {footer && <div className="shrink-0 border-t border-border bg-surface px-5 pt-3 pb-[max(0.75rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))]">{footer}</div>}
      </div>
    </div>
  );
}

/** Dairesel ilerleme göstergesi. */
export function Ring({
  value,
  max,
  size = 148,
  stroke = 12,
  color = "var(--primary)",
  overColor = "var(--danger)",
  children,
  label,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  overColor?: string;
  children?: React.ReactNode;
  label: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = max > 0 ? value / max : 0;
  const shown = Math.min(1, Math.max(0, ratio));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ratio > 1 ? overColor : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          style={{ transition: "stroke-dashoffset .4s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function Bar({ value, max, color = "var(--primary)", className }: { value: number; max: number; color?: string; className?: string }) {
  const p = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={cx("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <div className="h-full rounded-full" style={{ width: `${p}%`, background: color, transition: "width .4s ease" }} />
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      {icon && <div className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-muted">{icon}</div>}
      <p className="font-medium">{title}</p>
      {text && <p className="max-w-xs text-sm text-muted">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-xl bg-surface-2", className)} />;
}

export function PageHeader({ title, subtitle, action, back }: { title: string; subtitle?: string; action?: React.ReactNode; back?: React.ReactNode }) {
  return (
    <header className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {back}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}

export function Stat({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted">{label}</p>
      <p className="truncate text-lg font-semibold" style={color ? { color } : undefined}>
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-muted">{unit}</span>}
      </p>
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-surface-2 border border-border")}
    >
      <span className={cx("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

const CONTROLS = new Set<React.ComponentType>([Input, NumberInput, Select, Textarea] as unknown as React.ComponentType[]);

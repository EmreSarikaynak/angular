"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, Sheet, Switch, cx } from "@/components/ui";
import { isHidden, orderItems, sanitizePrefs, type ListPref, type UiPrefs } from "@/lib/layout-prefs";

/**
 * Kullanıcı tercihleri: profildeki `ui_prefs` (cihazlar arası) ve yedek olarak bu cihazın deposu.
 * Sütun henüz yoksa ya da çevrimdışıysa tercih bu cihazda kalır; hata göstermez.
 */
export function useUiPrefs() {
  const { profile, session, saveProfile } = useApp();
  const userId = session?.user.id ?? null;
  const [local, setLocal] = useState<UiPrefs>({});
  useEffect(() => {
    if (!userId) return;
    try {
      setLocal(sanitizePrefs(JSON.parse(localStorage.getItem(`bt:ui:${userId}`) ?? "{}")));
    } catch {
      setLocal({});
    }
  }, [userId]);
  const prefs = useMemo<UiPrefs>(() => ({ ...local, ...sanitizePrefs(profile?.ui_prefs) }), [local, profile?.ui_prefs]);
  const setPrefs = useCallback(
    (patch: UiPrefs) => {
      const next = { ...prefs, ...patch };
      setLocal(next);
      if (userId) localStorage.setItem(`bt:ui:${userId}`, JSON.stringify(next));
      void saveProfile({ ui_prefs: next }).catch(() => {});
    },
    [prefs, userId, saveProfile],
  );
  return { prefs, setPrefs };
}

export interface CustomItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}
export interface CustomGroup {
  key: string;
  title: string;
  items: CustomItem[];
}

function Row({ item, hidden, onToggle, hideLabel }: { item: CustomItem; hidden: boolean; onToggle: () => void; hideLabel: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx("flex items-center gap-3 rounded-xl border border-border bg-surface px-2 py-2", isDragging && "relative z-10 shadow-lg", hidden && "opacity-55")}
    >
      <button type="button" aria-label={item.label} className="grid h-9 w-9 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted active:cursor-grabbing" {...attributes} {...listeners}>
        <GripVertical size={18} />
      </button>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">{item.icon}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
      {hidden ? <EyeOff size={16} className="shrink-0 text-muted" aria-hidden /> : <Eye size={16} className="shrink-0 text-primary" aria-hidden />}
      <Switch checked={!hidden} onChange={onToggle} label={`${item.label} · ${hideLabel}`} />
    </li>
  );
}

/** Sürükle-bırak ile sıralama ve anahtarla pasife alma paneli. Dokunmatik, fare ve klavye ile çalışır. */
export function CustomizeSheet({ open, onClose, title, groups }: { open: boolean; onClose: () => void; title: string; groups: CustomGroup[] }) {
  const { t } = useApp();
  const { prefs, setPrefs } = useUiPrefs();
  const [draft, setDraft] = useState<UiPrefs>({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  // Panel her açıldığında kayıtlı tercihten başla.
  useEffect(() => {
    if (!open) return;
    const next: UiPrefs = {};
    for (const g of groups) {
      const p = prefs[g.key];
      next[g.key] = { order: orderItems(g.items, p).map((i) => i.id), hidden: p?.hidden.filter((id) => g.items.some((i) => i.id === id)) ?? [] };
    }
    setDraft(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const update = (key: string, fn: (p: ListPref) => ListPref) => setDraft((d) => ({ ...d, [key]: fn(d[key] ?? { order: [], hidden: [] }) }));
  const onDragEnd = (key: string) => (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    update(key, (p) => {
      const from = p.order.indexOf(String(e.active.id));
      const to = p.order.indexOf(String(e.over!.id));
      return from < 0 || to < 0 ? p : { ...p, order: arrayMove(p.order, from, to) };
    });
  };
  const toggle = (key: string, id: string) => update(key, (p) => ({ ...p, hidden: isHidden(p, id) ? p.hidden.filter((x) => x !== id) : [...p.hidden, id] }));
  const reset = () => setDraft(Object.fromEntries(groups.map((g) => [g.key, { order: g.items.map((i) => i.id), hidden: [] }])));
  const save = () => {
    setPrefs(draft);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={reset}>
            {t("Varsayılana dön")}
          </Button>
          <Button className="flex-1" onClick={save}>
            {t("Kaydet")}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-muted">{t("Sırayı değiştirmek için tutacağı tutup sürükleyin. Kullanmadığınız seçenekleri anahtarla pasife alın; istediğiniz zaman geri açabilirsiniz.")}</p>
        {groups.map((g) => {
          const p = draft[g.key];
          const order = p?.order ?? g.items.map((i) => i.id);
          const byId = new Map(g.items.map((i) => [i.id, i]));
          return (
            <section key={g.key} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{g.title}</h3>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd(g.key)}>
                <SortableContext items={order} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-2">
                    {order.map((id) => {
                      const item = byId.get(id);
                      return item ? <Row key={id} item={item} hidden={isHidden(p, id)} onToggle={() => toggle(g.key, id)} hideLabel={t("Göster")} /> : null;
                    })}
                  </ul>
                </SortableContext>
              </DndContext>
            </section>
          );
        })}
      </div>
    </Sheet>
  );
}

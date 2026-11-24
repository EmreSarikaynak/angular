"use client";
import { useMemo } from "react";
import { AlertTriangle, Info, Leaf, ShieldAlert } from "lucide-react";
import { useApp } from "./app-provider";
import { Card } from "./ui";
import { notesDisclaimer, productNotes, type NoteLevel, type ProductInput } from "@/lib/bkn/product-notes";

const STYLE: Record<NoteLevel, { icon: typeof Info; cls: string }> = {
  allergy: { icon: ShieldAlert, cls: "border-danger/40 bg-danger/5 text-danger" },
  caution: { icon: AlertTriangle, cls: "border-warn/40 bg-warn/5 text-warn" },
  info: { icon: Info, cls: "border-border bg-surface text-muted" },
  benefit: { icon: Leaf, cls: "border-primary/40 bg-primary-soft text-primary" },
};

/** Ürün etiketine ve besin değerlerine dayanan nesnel notlar; çekince metniyle birlikte gösterilir. */
export function ProductNotes({ input }: { input: Omit<ProductInput, "userAllergies"> }) {
  const { t, lang, profile } = useApp();
  const allergies = profile?.allergies;
  const notes = useMemo(() => productNotes({ ...input, userAllergies: allergies ?? [] }, lang === "en" ? "en" : "tr"), [input, allergies, lang]);
  const hasIngredients = !!input.ingredients_text?.trim();
  if (!notes.length && hasIngredients) return null;
  return (
    <Card className="space-y-2">
      <p className="text-sm font-semibold">{t("Ürün notları")}</p>
      {notes.map((n) => {
        const S = STYLE[n.level];
        return (
          <div key={n.code} className={`flex gap-2 rounded-xl border px-3 py-2 ${S.cls}`}>
            <S.icon size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{n.title}</p>
              <p className="text-xs text-text">{n.text}</p>
            </div>
          </div>
        );
      })}
      {!hasIngredients && (
        <p className="text-xs text-muted">{t("İçindekiler listesi bulunamadı. Daha ayrıntılı notlar için ambalajdaki içindekiler bölümünün fotoğrafını çekin.")}</p>
      )}
      <p className="text-[11px] leading-snug text-muted">{notesDisclaimer(lang === "en" ? "en" : "tr")}</p>
    </Card>
  );
}

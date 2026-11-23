"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Moon } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, Sheet } from "@/components/ui";
import { toDateKey } from "@/lib/dates";
import { activeRamadan, ramadanEnded } from "@/lib/bkn/ramadan-dates";

/**
 * Ramazan ayı geldiğinde (başlamadan 3 gün önce) bir kez "Oruç tutuyor musun?" diye sorar.
 * Evet: Ramazan modu açılır ve kişisel beslenme programı gösterilir. Hayır: mod kapalı kalır.
 * Ramazan bittiğinde, bu soruyla açılan mod kendiliğinden kapanır. Mod varsayılan olarak kapalıdır.
 */
export function RamadanPrompt() {
  const { profile, saveProfile, t, toast } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const today = toDateKey();
  const period = activeRamadan(today);
  const needsAnswer = !!profile?.onboarded_at && !!period && profile.ramadan_answered !== period.start && !dismissed;

  // Ramazan sona erdi: soruyla açılmış mod kapatılır (elle açılan mod, yanıtsız olduğu için etkilenmez).
  useEffect(() => {
    if (profile?.ramadan_mode && profile.ramadan_answered && ramadanEnded(profile.ramadan_answered, today)) {
      void saveProfile({ ramadan_mode: false }).catch(() => {});
    }
  }, [profile?.ramadan_mode, profile?.ramadan_answered, today, saveProfile]);

  async function answer(fasting: boolean) {
    if (!period) return;
    setBusy(true);
    try {
      await saveProfile({ ramadan_mode: fasting, ramadan_answered: period.start });
      setDismissed(true);
      if (fasting) {
        toast(t("Ramazan modu açıldı. Sana özel programı hazırladık."));
        router.push("/plan");
      } else {
        toast(t("Tamam, Ramazan modu kapalı kalacak. İstersen Profil’den açabilirsin."));
      }
    } catch {
      toast(t("Kaydedilemedi."), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={needsAnswer} onClose={() => setDismissed(true)} title={t("Ramazan ayı geldi")}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
            <Moon size={22} />
          </span>
          <div>
            <p className="font-semibold">{t("Bu Ramazan oruç tutuyor musun?")}</p>
            <p className="mt-1 text-sm text-muted">
              {t("Evet dersen öğünler Sahur ve İftar olur; protein ve kalori hedefin iftar, ara öğün ve sahura bölünür, hatırlatmalar yalnızca iftar ile sahur arasında gelir.")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => answer(false)}>
            {t("Hayır")}
          </Button>
          <Button className="flex-1" loading={busy} onClick={() => answer(true)}>
            {t("Evet, tutuyorum")}
          </Button>
        </div>
        <p className="text-xs text-muted">{t("Sağlık durumun oruca uygun değilse (hamilelik, kronik hastalık, ilaç kullanımı) hekimine danış.")}</p>
      </div>
    </Sheet>
  );
}

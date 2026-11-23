"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase/client";
import { clearLocalData, flush, pendingCount, setStoreUser, subscribe } from "@/lib/data/store";
import { api } from "@/lib/api";
import { nativePushDisable } from "@/lib/native-push";
import { translate, type Vars } from "@/lib/i18n";
import type { Lang, Profile, Theme } from "@/lib/types";

export interface RuntimeConfig {
  ai_available: boolean;
  blocked: boolean;
  quota: { limit: number; used: number; remaining: number };
  announcement: string;
  is_admin: boolean;
  push_available: boolean;
  fcm_available: boolean;
}

interface Toast {
  id: number;
  text: string;
  kind: "ok" | "error" | "info";
}

interface AppState {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  profileLoaded: boolean;
  lang: Lang;
  theme: Theme;
  online: boolean;
  pending: number;
  config: RuntimeConfig | null;
  t: (text: string, vars?: Vars) => string;
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
  saveProfile: (patch: Partial<Profile>) => Promise<void>;
  reloadProfile: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  toast: (text: string, kind?: Toast["kind"]) => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("AppProvider missing");
  return v;
}

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0f1513" : "#f6f8f7");
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [lang, setLangState] = useState<Lang>("tr");
  const [theme, setThemeState] = useState<Theme>("system");
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const userId = session?.user.id ?? null;

  const toast = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = ++toastId.current;
    setToasts((ts) => [...ts.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), kind === "error" ? 5000 : 2800);
  }, []);

  // Yerel tercihleri ve oturumu yükle.
  useEffect(() => {
    const storedLang = localStorage.getItem("bt:lang");
    if (storedLang === "en" || storedLang === "tr") setLangState(storedLang);
    else if (!navigator.language.toLowerCase().startsWith("tr")) setLangState("en");
    const storedTheme = localStorage.getItem("bt:theme") as Theme | null;
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") setThemeState(storedTheme);
    setOnline(navigator.onLine);

    if (!supabaseConfigured) {
      setReady(true);
      return;
    }
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => setSession(s));

    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const unsub = subscribe(() => setPending(pendingCount()));
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      unsub();
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = () => applyTheme("system");
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [theme]);

  const reloadProfile = useCallback(async () => {
    if (!userId) return;
    const key = `bt:profile:${userId}`;
    const adopt = (p: Profile) => {
      setProfile(p);
      setLangState(p.language);
      setThemeState(p.theme);
      localStorage.setItem("bt:lang", p.language);
      localStorage.setItem("bt:theme", p.theme);
    };
    try {
      const cached = localStorage.getItem(key);
      if (cached) adopt(JSON.parse(cached) as Profile);
    } catch {
      /* yoksay */
    }
    const { data, error } = await supabase().from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!error && data) {
      adopt(data as Profile);
      localStorage.setItem(key, JSON.stringify(data));
    } else if (!error && !data) {
      // Tetikleyici çalışmadıysa (eski hesap) profil satırını oluştur.
      const { data: created } = await supabase().from("profiles").insert({ id: userId }).select("*").maybeSingle();
      if (created) adopt(created as Profile);
    }
    setProfileLoaded(true);
  }, [userId]);

  const refreshConfig = useCallback(async () => {
    try {
      setConfig(await api<RuntimeConfig>("/api/config"));
    } catch {
      /* çevrimdışı ya da sunucu yapılandırılmamış: YZ özellikleri kapalı görünür */
    }
  }, []);

  useEffect(() => {
    setStoreUser(userId);
    setProfileLoaded(false);
    if (!userId) {
      setProfile(null);
      setConfig(null);
      return;
    }
    setPending(pendingCount());
    void reloadProfile();
    void refreshConfig();
    void flush();
  }, [userId, reloadProfile, refreshConfig]);

  useEffect(() => {
    if (online && userId) void flush();
  }, [online, userId]);

  const saveProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!userId) return;
      const { data, error } = await supabase().from("profiles").update(patch).eq("id", userId).select("*").single();
      if (error) throw new Error(error.message);
      setProfile(data as Profile);
      localStorage.setItem(`bt:profile:${userId}`, JSON.stringify(data));
    },
    [userId],
  );

  const setLang = useCallback(
    (l: Lang) => {
      setLangState(l);
      localStorage.setItem("bt:lang", l);
      if (userId) void saveProfile({ language: l }).catch(() => {});
    },
    [userId, saveProfile],
  );

  const setTheme = useCallback(
    (th: Theme) => {
      setThemeState(th);
      localStorage.setItem("bt:theme", th);
      if (userId) void saveProfile({ theme: th }).catch(() => {});
    },
    [userId, saveProfile],
  );

  const signOut = useCallback(async () => {
    // Mobil uygulamada bu cihazın bildirim belirtecini oturum kapanmadan önce sunucudan sil.
    await nativePushDisable().catch(() => {});
    await supabase().auth.signOut();
    clearLocalData();
  }, []);

  const t = useCallback((text: string, vars?: Vars) => translate(lang, text, vars), [lang]);

  const value = useMemo<AppState>(
    () => ({ ready, session, profile, profileLoaded, lang, theme, online, pending, config, t, setLang, setTheme, saveProfile, reloadProfile, refreshConfig, toast, signOut }),
    [ready, session, profile, profileLoaded, lang, theme, online, pending, config, t, setLang, setTheme, saveProfile, reloadProfile, refreshConfig, toast, signOut],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="bt-toasts pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((x) => (
          <div
            key={x.id}
            role="status"
            className={`pointer-events-auto max-w-md rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ${
              x.kind === "error" ? "bg-danger text-white" : x.kind === "info" ? "bg-surface text-text border border-border" : "bg-primary text-white"
            }`}
          >
            {x.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

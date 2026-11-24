"use client";
import { isNative } from "./native";

/** Premium abonelik: RevenueCat (Google Play Faturalandırma / Apple StoreKit) üzerinden yalnızca yerel uygulamada satılır. */
export const ENTITLEMENT = "premium";

export interface PlanOption {
  id: string;
  kind: "monthly" | "annual" | "other";
  title: string;
  price: string;
  /** Ücretsiz deneme ya da tanıtım fiyatı varsa mağazanın verdiği açıklama. */
  intro: string | null;
}

type Purchases = typeof import("@revenuecat/purchases-capacitor").Purchases;
let sdk: Purchases | null = null;
let configuredFor: string | null = null;

const platform = () => (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.();

function apiKey(): string | undefined {
  return platform() === "ios" ? process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY : process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY;
}

/** Faturalama bağlantısı kurulamazsa süresiz beklemek yerine hangi adımda takıldığını söyleyerek hata verir. */
function withTimeout<T>(p: Promise<T>, ms: number, step: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`timeout:${step}`)), ms);
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

/** Tanı bilgisi: uygulamanın hangi derlemede olduğu ve faturalamanın neden kullanılamadığı. */
export function billingDiagnostics(): string {
  const build = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "?").slice(0, 7);
  return `build ${build} · native ${isNative() ? "evet" : "hayır"} · platform ${typeof window === "undefined" ? "?" : platform() ?? "?"} · anahtar ${apiKey() ? "var" : "yok"}`;
}

export function billingAvailable(): boolean {
  return isNative() && !!apiKey();
}

/** SDK'yı kullanıcı kimliğiyle (Supabase kullanıcı kimliği) başlatır; kimlik webhook'ta aboneliği eşleştirir. */
export async function initBilling(userId: string, onStep?: (s: string) => void): Promise<Purchases | null> {
  if (!billingAvailable()) return null;
  onStep?.("import");
  const { Purchases } = await withTimeout(import("@revenuecat/purchases-capacitor"), 15_000, "import");
  onStep?.("configure");
  if (!sdk) {
    // Yerel başlatma çağrısının yanıtı bazen köprüden dönmez; 5 sn beklenip devam edilir (asıl hata sonraki adımda görünür).
    let rejected: unknown = null;
    await Promise.race([
      Purchases.configure({ apiKey: apiKey()!, appUserID: userId }).catch((e: unknown) => {
        rejected = e;
      }),
      new Promise<void>((r) => setTimeout(r, 5_000)),
    ]);
    if (rejected) throw rejected;
    sdk = Purchases;
    configuredFor = userId;
  } else if (configuredFor !== userId) {
    await withTimeout(Purchases.logIn({ appUserID: userId }), 15_000, "login");
    configuredFor = userId;
  }
  return sdk;
}

export async function loadPlans(userId: string, onStep?: (s: string) => void): Promise<PlanOption[]> {
  const p = await initBilling(userId, onStep);
  if (!p) throw new Error("billing_unavailable");
  onStep?.("offerings");
  const offerings = await withTimeout(p.getOfferings(), 20_000, "offerings");
  if (!offerings.current) throw new Error("no_current_offering");
  const pkgs = offerings.current.availablePackages;
  if (!pkgs.length) throw new Error("no_packages");
  return pkgs.map((k) => {
    const intro = k.product.introPrice;
    return {
      id: k.identifier,
      kind: k.packageType === "MONTHLY" ? "monthly" : k.packageType === "ANNUAL" ? "annual" : "other",
      title: k.product.title.replace(/\s*\(.*\)\s*$/, ""),
      price: k.product.priceString,
      intro: intro ? (intro.price === 0 ? `${intro.periodNumberOfUnits} ${intro.periodUnit}` : intro.priceString) : null,
    };
  });
}

export type PurchaseResult = "ok" | "cancelled" | "failed";

export async function buy(userId: string, planId: string): Promise<PurchaseResult> {
  const p = await initBilling(userId);
  if (!p) return "failed";
  const offerings = await p.getOfferings();
  const pkg = offerings.current?.availablePackages.find((k) => k.identifier === planId);
  if (!pkg) return "failed";
  try {
    const { customerInfo } = await p.purchasePackage({ aPackage: pkg });
    return customerInfo.entitlements.active[ENTITLEMENT] ? "ok" : "failed";
  } catch (e) {
    return (e as { userCancelled?: boolean }).userCancelled ? "cancelled" : "failed";
  }
}

export async function restore(userId: string): Promise<boolean> {
  const p = await initBilling(userId);
  if (!p) return false;
  const { customerInfo } = await p.restorePurchases();
  return !!customerInfo.entitlements.active[ENTITLEMENT];
}

/** Aboneliği yönetme sayfası (mağazanın kendi ekranı). */
export function manageUrl(): string {
  return platform() === "ios" ? "https://apps.apple.com/account/subscriptions" : "https://play.google.com/store/account/subscriptions";
}

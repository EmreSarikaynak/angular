/** BKNY yerel uygulama kabuğunda (Capacitor: iOS/Android) mı çalışıyoruz? */
export function isNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

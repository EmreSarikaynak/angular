"use client";
import { useEffect } from "react";

/**
 * Tanıtım sayfası ("/") çerezi olmayan ama bu tarayıcıda oturumu olan kullanıcıyı (çerez eklenmeden önce
 * giriş yapmış olanlar) uygulamaya geçirir. Döngüyü önlemek için oturum başına bir kez dener.
 */
export function AuthRedirect() {
  useEffect(() => {
    try {
      const hasSession = Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k));
      if (!hasSession || sessionStorage.getItem("bt:landing-redirected")) return;
      sessionStorage.setItem("bt:landing-redirected", "1");
      document.cookie = `bt_auth=1; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      location.replace("/");
    } catch {
      /* depolama kapalıysa tanıtım sayfası görünür kalır */
    }
  }, []);
  return null;
}

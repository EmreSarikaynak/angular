import { NextResponse, type NextRequest } from "next/server";

/**
 * Ana adres ("/") iki yüzlüdür: oturum açmış kullanıcıya uygulama, ziyaretçilere ve arama motoru botlarına
 * herkese açık tanıtım sayfası gösterilir. Oturum tarayıcıda saklandığı için, giriş yapınca `bt_auth` çerezi
 * konur (bkz. app-provider). Mağaza uygulamasının WebView'i ve ana ekrandaki web uygulaması doğrudan uygulamaya gider.
 */
export function proxy(request: NextRequest) {
  const ua = request.headers.get("user-agent") ?? "";
  // Android WebView ("; wv)") ve iOS WKWebView / ana ekran uygulaması ("Safari/" belirteci yok).
  const embedded = /;\s*wv\)/.test(ua) || (/(iPhone|iPad|iPod)/.test(ua) && !/Safari\//.test(ua));
  if (embedded || request.cookies.get("bt_auth")?.value === "1") return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/landing-home";
  return NextResponse.rewrite(url);
}

export const config = { matcher: "/" };

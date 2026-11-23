/** Platform işaretleri (iOS ve Android). Mağaza yayınlanınca resmî mağaza rozetleriyle değiştirilebilir. */
export function AppleIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

export function AndroidIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      {/* Kafa (yarım daire), antenler ve gözler */}
      <path d="M5.2 10.2a6.8 6.8 0 0 1 13.6 0z" />
      <path d="M8.1 3.3 9.4 5.5M15.9 3.3 14.6 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <circle cx="9.3" cy="7.7" r=".9" fill="#fff" />
      <circle cx="14.7" cy="7.7" r=".9" fill="#fff" />
      {/* Gövde, kollar ve bacaklar */}
      <rect x="5.2" y="11" width="13.6" height="7.2" rx="1.1" />
      <rect x="2.2" y="11" width="2.2" height="5.8" rx="1.1" />
      <rect x="19.6" y="11" width="2.2" height="5.8" rx="1.1" />
      <rect x="8.2" y="17.4" width="2.4" height="4.1" rx="1.2" />
      <rect x="13.4" y="17.4" width="2.4" height="4.1" rx="1.2" />
    </svg>
  );
}

/** iOS Paylaş simgesi (kare ve yukarı ok), kurulum adımlarında gösterilir. */
export function ShareIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 15V3.5M8.2 7 12 3.2 15.8 7" />
      <path d="M7.5 10H6.3A1.8 1.8 0 0 0 4.5 11.8v7.4a1.8 1.8 0 0 0 1.8 1.8h11.4a1.8 1.8 0 0 0 1.8-1.8v-7.4a1.8 1.8 0 0 0-1.8-1.8h-1.2" />
    </svg>
  );
}

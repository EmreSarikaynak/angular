/** BKNY — "Bugün Kendin için Ne yaptın?" marka işareti: tamamlanmakta olan bir halka ve BKNY harfleri. */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" className={className} role="img" aria-label="BKNY">
      <rect width="512" height="512" rx="116" fill="#1f9d76" />
      <circle cx="256" cy="256" r="178" fill="none" stroke="#ffffff" strokeOpacity=".28" strokeWidth="30" />
      <path d="M256 78 a178 178 0 1 1 -169.3 123" fill="none" stroke="#ffffff" strokeWidth="30" strokeLinecap="round" />
      <text x="256" y="298" textAnchor="middle" fontFamily="ui-sans-serif, system-ui, 'Segoe UI', Roboto, Arial, sans-serif" fontWeight="800" fontSize="96" letterSpacing="-2" fill="#ffffff">
        BKNY
      </text>
    </svg>
  );
}

export const BRAND = "BKNY";
export const TAGLINE = "Bugün kendin için ne yaptın?";

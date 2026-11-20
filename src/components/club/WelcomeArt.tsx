/** Drawn graphics for the Welcome page. Colors come from the theme, so they work in light and dark mode. */

/** Hero scene: rolling green, a flag, and a tracked ball flight with a couple of launch-monitor readouts. Sits on the accent banner. */
export function HeroArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 220" className={className} role="img" aria-label="Illustration of a golf shot flying toward a flag, with carry and ball-speed readouts">
      <g fill="none" stroke="var(--accent-ink)" strokeLinecap="round" strokeLinejoin="round">
        {/* hills */}
        <path d="M0 190 C60 165 110 170 170 182 S290 200 360 172 L360 220 L0 220 Z" fill="var(--accent-ink)" fillOpacity=".10" stroke="none" />
        <path d="M0 205 C80 188 150 196 230 204 S320 210 360 198 L360 220 L0 220 Z" fill="var(--accent-ink)" fillOpacity=".16" stroke="none" />
        {/* green + flag */}
        <ellipse cx="292" cy="186" rx="44" ry="7" fill="var(--accent-ink)" fillOpacity=".22" stroke="none" />
        <path d="M292 186 V112" strokeWidth="2.4" opacity=".9" />
        <path d="M292 112 L322 122 L292 132 Z" fill="var(--accent-ink)" stroke="none" opacity=".9" />
        {/* ball flight */}
        <path d="M34 196 C90 40 230 26 284 180" strokeWidth="2.2" strokeDasharray="2 7" opacity=".85" />
        <circle cx="34" cy="196" r="5" fill="var(--accent-ink)" stroke="none" />
        <circle cx="270" cy="150" r="4" fill="var(--accent-ink)" stroke="none" opacity=".9" />
        {/* apex marker */}
        <path d="M157 64 V82" strokeWidth="1.4" strokeDasharray="2 3" opacity=".6" />
      </g>
      {/* readouts */}
      <g fontFamily="'Barlow Semi Condensed', Impact, sans-serif" fontWeight="700">
        <rect x="112" y="28" width="92" height="30" rx="7" fill="var(--accent-ink)" fillOpacity=".14" />
        <text x="122" y="40" fontSize="8" letterSpacing="1.2" fill="var(--accent-ink)" opacity=".75">CARRY</text>
        <text x="122" y="53" fontSize="13" fill="var(--accent-ink)">241 yds</text>
        <rect x="30" y="92" width="92" height="30" rx="7" fill="var(--accent-ink)" fillOpacity=".14" />
        <text x="40" y="104" fontSize="8" letterSpacing="1.2" fill="var(--accent-ink)" opacity=".75">BALL SPEED</text>
        <text x="40" y="117" fontSize="13" fill="var(--accent-ink)">148 mph</text>
      </g>
    </svg>
  );
}

const ICON_PROPS = { viewBox: "0 0 48 48", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** Two speech bubbles with a golf ball — the Clubhouse. */
export function ClubhouseIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} className={className} aria-hidden="true">
      <path d="M6 9h24v15H15l-6 5v-5H6z" />
      <path d="M34 18h8v14h-3v5l-6-5H20v-4" />
      <circle cx="18" cy="16.5" r="4" fill="currentColor" fillOpacity=".15" />
      <path d="M16.6 15.3h.01M19.3 15.6h.01M17.8 17.9h.01" strokeWidth="2.6" />
    </svg>
  );
}

/** Question mark on a flag — Ask the Coach. */
export function AskIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} className={className} aria-hidden="true">
      <path d="M12 42V6" />
      <path d="M12 7h24l-5 8 5 8H12" fill="currentColor" fillOpacity=".12" />
      <path d="M20.5 12.5a3.5 3.5 0 1 1 4.8 3.2c-.8.3-1.3 1-1.3 1.8" />
      <path d="M24 20.5h.01" strokeWidth="2.8" />
      <path d="M6 42h14" />
    </svg>
  );
}

/** Rising chart with a ball — progress saved. */
export function ProgressIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} className={className} aria-hidden="true">
      <path d="M6 42h36" />
      <rect x="9" y="30" width="6" height="12" rx="1.5" fill="currentColor" fillOpacity=".12" />
      <rect x="20" y="23" width="6" height="19" rx="1.5" fill="currentColor" fillOpacity=".12" />
      <rect x="31" y="15" width="6" height="27" rx="1.5" fill="currentColor" fillOpacity=".12" />
      <path d="M8 22l11-7 8 4 12-11" />
      <circle cx="39" cy="8" r="3.5" fill="currentColor" fillOpacity=".2" />
    </svg>
  );
}

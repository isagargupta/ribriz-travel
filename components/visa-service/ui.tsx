// Small shared pieces for the visa pages: flags and line icons.

/** Real flag images (emoji flags show as two letters on Windows). */
export function Flag({ code, size = 32 }: { code: string; size?: number }) {
  const c = code.toLowerCase();
  return <img className="vx-flag" src={`https://flagcdn.com/w80/${c}.png`} srcSet={`https://flagcdn.com/w160/${c}.png 2x`} width={size} height={Math.round(size * 0.72)} alt="" loading="lazy" decoding="async" />;
}

const P: Record<string, string> = {
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  clock: "M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
  scan: "M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10",
  user: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
  check: "M20 6 9 17l-5-5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  upload: "M12 16V4M6 10l6-6 6 6M4 20h16",
  camera: "M3 8a2 2 0 0 1 2-2h2l2-3h6l2 3h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  doc: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5",
  track: "M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  rupee: "M6 3h12M6 8h12M6 13l8.5 8M6 13h3a5 5 0 0 0 0-10",
  stay: "M3 21V7l9-4 9 4v14M9 21v-6h6v6",
  passport: "M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM9 18h6",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  sparkle: "M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20",
};

export function Icon({ name, size }: { name: keyof typeof P; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size ?? 20} height={size ?? 20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  );
}

export const fmtDay = (iso: string, long = false) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: long ? "long" : "short", timeZone: "UTC" });

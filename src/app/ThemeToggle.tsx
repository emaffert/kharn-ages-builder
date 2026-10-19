import type { Theme } from "./useTheme";

/** Bascule sombre/clair (segmentée), pilotée par le socle de tokens. */
export function ThemeToggle({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  return (
    <div className="kh-toggle flex overflow-hidden rounded-full text-xs">
      <button
        type="button"
        data-on={theme === "dark"}
        onClick={() => setTheme("dark")}
        className="px-3 py-1"
        aria-pressed={theme === "dark"}
        title="Thème sombre"
      >
        <span className="kh-toggle-ico" aria-hidden="true">☾</span>
        <span className="kh-toggle-txt">Sombre</span>
      </button>
      <button
        type="button"
        data-on={theme === "light"}
        onClick={() => setTheme("light")}
        className="px-3 py-1"
        aria-pressed={theme === "light"}
        title="Thème clair"
      >
        <span className="kh-toggle-ico" aria-hidden="true">☀</span>
        <span className="kh-toggle-txt">Clair</span>
      </button>
    </div>
  );
}

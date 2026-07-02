import { useCallback, useEffect, useState } from "react";

/**
 * Thème visuel (sombre/clair) : applique `data-theme` sur <html>, persiste le choix,
 * et se rabat sur la préférence système au premier lancement.
 */
export type Theme = "dark" | "light";

const KEY = "kharn-theme";

function readInitial(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    /* localStorage indisponible (mode privé) */
  }
  const prefersLight =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: light)").matches;
  return prefersLight ? "light" : "dark";
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(readInitial);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  return [theme, setTheme];
}

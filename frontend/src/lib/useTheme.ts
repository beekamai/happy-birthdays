import { useCallback, useEffect, useState } from "react";

/* Per-visitor theme control. The friend's config carries a default theme; a
   visitor can override it locally and that choice persists in localStorage,
   applied document-wide via `<html data-theme="...">`. The CSS overrides live in
   styles/theme.css. */

export type ThemeName = "light" | "dark" | "halloween" | "newyear";

export const THEMES: ThemeName[] = ["light", "dark", "halloween", "newyear"];

const STORAGE_KEY = "hb-theme";

function isTheme(value: unknown): value is ThemeName {
  return (
    value === "light" ||
    value === "dark" ||
    value === "halloween" ||
    value === "newyear"
  );
}

/* The visitor's saved override, or null when they haven't picked one. */
function readStored(): ThemeName | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isTheme(raw) ? raw : null;
  } catch {
    return null; /* private mode / blocked storage */
  }
}

/* Apply to <html> so the whole document (and any portals) picks up the tokens.
   Always set the attribute explicitly — including "light" — so toggling back is
   deterministic and `color-scheme: light` is restored. */
function apply(theme: ThemeName): void {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
  }
}

interface UseThemeResult {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  themes: ThemeName[];
}

/**
 * Resolve and apply the active theme: a stored per-visitor override wins,
 * otherwise the passed `defaultTheme` (the friend's configured default).
 * Returns the active theme plus a persisting setter and the full theme list.
 */
export function useTheme(defaultTheme: ThemeName): UseThemeResult {
  const [theme, setThemeState] = useState<ThemeName>(
    () => readStored() ?? defaultTheme,
  );

  /* Apply on mount and whenever the resolved theme changes. Re-runs if the
     friend's default changes (e.g. client nav between pages) and no override
     is stored. */
  useEffect(() => {
    const next = readStored() ?? defaultTheme;
    setThemeState(next);
    apply(next);
  }, [defaultTheme]);

  const setTheme = useCallback((t: ThemeName) => {
    setThemeState(t);
    apply(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore — theme still applies for this session */
    }
  }, []);

  return { theme, setTheme, themes: THEMES };
}

import { useCallback, useEffect, useState } from "react";

/* Per-visitor theme control. The friend's config carries a default theme; a
   visitor can override it locally and that choice persists in localStorage,
   applied document-wide via `<html data-theme="...">`. The CSS overrides live in
   styles/theme.css. */

export type ThemeName = "light" | "dark" | "halloween" | "newyear";

export const THEMES: ThemeName[] = ["light", "dark", "halloween", "newyear"];

const STORAGE_KEY = "hb-theme";

/* The editor's live preview must reflect the FORM's theme, not the owner's own
   visitor override (which is shared via same-origin localStorage). Preview mode
   makes the stored override invisible, so `useTheme` resolves to the passed
   default (the form's theme) and never writes/leaks. Enabled only inside the
   preview iframe (see PreviewHost). */
let ignoreStoredOverride = false;
export function setThemePreviewMode(on: boolean): void {
  ignoreStoredOverride = on;
}

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
  if (ignoreStoredOverride) return null;
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

/* Briefly enable a document-wide colour transition so every detail (borders,
   icons, shadows) eases between themes, not just the page background. Only on an
   explicit user switch — never on initial load (that must paint instantly). */
let animTimer: ReturnType<typeof setTimeout> | undefined;
function animateSwap(): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.classList.add("theme-anim");
  if (animTimer) clearTimeout(animTimer);
  animTimer = setTimeout(() => el.classList.remove("theme-anim"), 350);
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
    animateSwap();
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

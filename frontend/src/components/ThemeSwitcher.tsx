import { useEffect, useRef, useState } from "react";

import type { ThemeName } from "../lib/useTheme.ts";
import { useT } from "../lib/i18n.ts";

/* Cozy theme picker; positioned by the parent ControlBar (a flex child, no fixed
   offset of its own). The pill shows the active theme's icon and opens a tiny
   menu to pick another. Style mirrors SoundToggle so the controls read as a set. */

interface ThemeSwitcherProps {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  themes: ThemeName[];
}

const ICON: Record<ThemeName, string> = {
  light: "🌞",
  dark: "🌙",
  halloween: "🎃",
  newyear: "🎄",
};

export function ThemeSwitcher({ theme, setTheme, themes }: ThemeSwitcherProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  /* Close on outside click / Escape while the menu is open. */
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("theme.change")}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("theme.change")}
        className="flex size-11 items-center justify-center rounded-[var(--radius-full)] border-[2px] border-[var(--color-surface)] bg-[var(--color-surface)]/90 text-xl shadow-[var(--shadow-sm)] backdrop-blur-sm transition-transform duration-200 hover:scale-110 active:scale-95"
      >
        <span aria-hidden="true">{ICON[theme]}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-13 right-0 flex flex-col gap-1 rounded-[var(--radius-md)] border-[2px] border-[var(--color-surface)] bg-[var(--color-surface)]/95 p-2 shadow-[var(--shadow-md)] backdrop-blur-sm"
        >
          {themes.map((name) => {
            const active = name === theme;
            return (
              <button
                key={name}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setTheme(name);
                  setOpen(false);
                }}
                className={`flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm font-bold whitespace-nowrap transition-colors ${
                  active
                    ? "bg-[var(--color-primary)]/20 text-[var(--color-text)]"
                    : "text-[var(--color-text-soft)] hover:bg-[var(--color-muted)]/40 hover:text-[var(--color-text)]"
                }`}
              >
                <span aria-hidden="true" className="text-base">
                  {ICON[name]}
                </span>
                {t(`theme.${name}`)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

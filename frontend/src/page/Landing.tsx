import { useEffect } from "react";

import { useTheme } from "../lib/useTheme.ts";
import { useT, initLang } from "../lib/i18n.ts";
import { ControlBar } from "../components/ControlBar.tsx";
import { ThemeSwitcher } from "../components/ThemeSwitcher.tsx";
import { LanguageSwitcher } from "../components/LanguageSwitcher.tsx";
import { AccountButton } from "../components/AccountButton.tsx";
import { ThemeDecor } from "../components/decor/ThemeDecor.tsx";
import { Particles } from "../components/decor/Particles.tsx";
import { Lanterns } from "../components/decor/Lanterns.tsx";
import { Steam } from "../components/decor/Steam.tsx";
import { StickerCard } from "../components/decor/StickerCard.tsx";

/* The site root (no friend slug): a warm holding screen that says what this
   place is. Decor only — every real card lives on a friend's page. */

/** Cozy landing for the site root. */
export function Landing() {
  const { theme, setTheme, themes } = useTheme("light");
  const { t } = useT();

  useEffect(() => {
    initLang("ru");
  }, []);

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 text-center">
      <ControlBar>
        <LanguageSwitcher />
        <ThemeSwitcher theme={theme} setTheme={setTheme} themes={themes} />
        <AccountButton />
      </ControlBar>
      <ThemeDecor theme={theme} />
      <Particles />
      <Lanterns count={5} />

      <div className="relative">
        <Steam count={4} />
        <StickerCard hover={false} className="mt-16">
          <span className="block text-6xl select-none" aria-hidden="true">
            🍜
          </span>
          <h1 className="mt-4 text-4xl">{t("landing.title")}</h1>
          <p className="mt-3 text-[var(--color-text-soft)]">
            {t("landing.subtitle")}
          </p>
        </StickerCard>
      </div>

      {/* Discreet watermark, bottom-right, leading to /about. Low z so it sits
          under the control cluster; only the pill itself is clickable. */}
      <a
        href="/about"
        className="fixed bottom-4 right-4 z-10 inline-flex items-center gap-1.5 rounded-[var(--radius-full)] border-[2px] border-white bg-[var(--color-surface)]/80 px-3 py-1.5 text-sm text-[var(--color-text-soft)] opacity-60 shadow-[var(--shadow-sm)] backdrop-blur-sm transition-opacity duration-200 hover:opacity-100"
      >
        <span aria-hidden="true">🍜</span>
        {t("watermark.about")}
      </a>
    </main>
  );
}

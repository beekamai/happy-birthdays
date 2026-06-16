import { useEffect } from "react";

import { useTheme } from "../lib/useTheme.ts";
import { useT, initLang } from "../lib/i18n.ts";
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
      <ThemeSwitcher theme={theme} setTheme={setTheme} themes={themes} />
      <LanguageSwitcher />
      <AccountButton />
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
    </main>
  );
}

import { useTheme } from "../lib/useTheme.ts";
import { useT } from "../lib/i18n.ts";
import { ControlBar } from "../components/ControlBar.tsx";
import { ThemeSwitcher } from "../components/ThemeSwitcher.tsx";
import { LanguageSwitcher } from "../components/LanguageSwitcher.tsx";
import { AccountButton } from "../components/AccountButton.tsx";
import { ThemeDecor } from "../components/decor/ThemeDecor.tsx";
import { Particles } from "../components/decor/Particles.tsx";
import { StickerCard } from "../components/decor/StickerCard.tsx";

/* Shown when a slug resolves to no friend. Kept cozy, never scary. Honors the
   visitor's chosen theme (localStorage via useTheme); with no choice it falls
   back to light, since a 404 has no friend page to inherit a theme from. */

/** Cozy 404 screen. */
export function NotFound() {
  const { theme, setTheme, themes } = useTheme("light");
  const { t } = useT();
  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 text-center">
      <ControlBar>
        <LanguageSwitcher />
        <ThemeSwitcher theme={theme} setTheme={setTheme} themes={themes} />
        <AccountButton />
      </ControlBar>
      <ThemeDecor theme={theme} />
      <Particles count={8} />

      <StickerCard hover={false}>
        <span className="block text-6xl select-none" aria-hidden="true">
          🥺
        </span>
        <h1 className="mt-4 text-3xl">{t("notFound.title")}</h1>
        <p className="mt-3 text-[var(--color-text-soft)]">{t("notFound.text")}</p>
      </StickerCard>
    </main>
  );
}

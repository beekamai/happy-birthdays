import { useEffect, useState } from "react";

import { useTheme } from "../lib/useTheme.ts";
import { useT, initLang } from "../lib/i18n.ts";
import { fetchStats } from "../lib/api.ts";
import { ControlBar } from "../components/ControlBar.tsx";
import { ThemeSwitcher } from "../components/ThemeSwitcher.tsx";
import { LanguageSwitcher } from "../components/LanguageSwitcher.tsx";
import { AccountButton } from "../components/AccountButton.tsx";
import { ThemeDecor } from "../components/decor/ThemeDecor.tsx";
import { Particles } from "../components/decor/Particles.tsx";
import { StickerCard } from "../components/decor/StickerCard.tsx";

/* The public "about this project" page (/about). Cozy, in the site's voice:
   what this place is, where it's hosted, how many pages live here, and credits.
   Honors the visitor's chosen theme (localStorage via useTheme), falling back to
   light when no page theme is around to inherit. Stats are pulled client-side. */

/** Cozy "about the project" screen. */
export function AboutPage() {
  const { theme, setTheme, themes } = useTheme("light");
  const { t } = useT();
  const [pages, setPages] = useState<number | null>(null);

  useEffect(() => {
    initLang("ru");
  }, []);

  useEffect(() => {
    let alive = true;
    fetchStats().then((stats) => {
      if (alive && stats) setPages(stats.pages);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <ControlBar>
        <LanguageSwitcher />
        <ThemeSwitcher theme={theme} setTheme={setTheme} themes={themes} />
        <AccountButton />
      </ControlBar>
      <ThemeDecor theme={theme} />
      <Particles count={8} />

      <div className="relative flex w-full max-w-lg flex-col items-center gap-5">
        <StickerCard hover={false}>
          <span className="block text-6xl select-none" aria-hidden="true">
            🍜
          </span>
          <h1 className="mt-4 text-4xl">{t("about.title")}</h1>
          <p className="mt-3 leading-relaxed text-[var(--color-text-soft)]">
            {t("about.intro")}
          </p>
        </StickerCard>

        <StickerCard hover={false} className="w-full">
          <h2 className="text-2xl">{t("about.hostingTitle")}</h2>
          <p className="mt-2 leading-relaxed text-[var(--color-text-soft)]">
            {t("about.hosting")}
          </p>
          <a
            href="https://senko.digital"
            target="_blank"
            rel="noopener"
            className="mt-4 inline-flex transition-transform duration-200 hover:scale-105"
          >
            <img
              src="https://senko.digital/images/88x31/hosted_on.png"
              alt="Hosted on senko.digital"
              width={88}
              height={31}
              className="rounded-[var(--radius-sm)] border-[2px] border-white shadow-[var(--shadow-sm)] [image-rendering:pixelated]"
            />
          </a>
        </StickerCard>

        <StickerCard hover={false} className="w-full">
          <h2 className="text-2xl">{t("about.statsTitle")}</h2>
          <p className="mt-2 text-lg text-[var(--color-text)]">
            {t("about.statsPages", { n: pages ?? "…" })}
          </p>
        </StickerCard>

        <StickerCard hover={false} className="w-full">
          <h2 className="text-2xl">{t("about.thanksTitle")}</h2>
          <p className="mt-2 leading-relaxed text-[var(--color-text-soft)]">
            {t("about.thanks")}
          </p>
        </StickerCard>

        <a
          href="/"
          className="mt-1 inline-flex items-center gap-2 rounded-[var(--radius-full)] border-[2px] border-[var(--color-primary-deep)] bg-[var(--color-primary)] px-6 py-3 font-bold text-[var(--color-on-primary)] shadow-[var(--shadow-md)] transition-transform duration-200 ease-[var(--ease-bounce)] hover:scale-[1.03]"
        >
          {t("about.back")}
        </a>
      </div>
    </main>
  );
}

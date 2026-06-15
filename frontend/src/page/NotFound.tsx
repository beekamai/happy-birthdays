import { useT } from "../lib/i18n.ts";
import { Particles } from "../components/decor/Particles.tsx";
import { StickerCard } from "../components/decor/StickerCard.tsx";

/* Shown when a slug resolves to no friend. Kept cozy, never scary. */

/** Cozy 404 screen. */
export function NotFound() {
  const { t } = useT();
  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 text-center">
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

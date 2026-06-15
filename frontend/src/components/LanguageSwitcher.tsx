import { useT } from "../lib/i18n.ts";

/* Small fixed language pill. Sits top-right at right-28 so it lands left of the
   ThemeSwitcher (right-16) and SoundToggle (right-4), and keeps that slot on
   pages without a SoundToggle for a consistent control row. Style mirrors
   SoundToggle so the controls read as a set. Toggles ru ↔ en. */
export function LanguageSwitcher() {
  const { lang, setLang, t } = useT();
  const next = lang === "ru" ? "en" : "ru";

  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      aria-label={t("lang.switch")}
      title={t("lang.switch")}
      className="fixed top-4 right-28 z-50 flex h-11 min-w-11 items-center justify-center rounded-[var(--radius-full)] border-[2px] border-white bg-[var(--color-surface)]/90 px-3 text-sm font-bold text-[var(--color-text)] shadow-[var(--shadow-sm)] backdrop-blur-sm transition-transform duration-200 hover:scale-110 active:scale-95"
    >
      <span aria-hidden="true">{lang === "ru" ? t("lang.ru") : t("lang.en")}</span>
    </button>
  );
}

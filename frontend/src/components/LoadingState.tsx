/* Branded cozy loading screen — shown while the dev fetch resolves. */

export function LoadingState() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-[var(--color-cream)] px-6 text-center">
      <span className="animate-bob text-6xl select-none" aria-hidden="true">
        🍜
      </span>
      <p className="font-[var(--font-display)] text-xl font-bold text-[var(--color-text)]">
        Загружаем праздник…
      </p>
    </div>
  );
}

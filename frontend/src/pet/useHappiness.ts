import { useCallback, useEffect, useState } from "react";

/* localStorage key namespace — one happiness value per friend slug. */
const keyFor = (slug: string) => `pet:${slug}`;
const DEFAULT = 50;

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/* SSR-safe, never-throwing read. Falls back to DEFAULT on any failure. */
function read(slug: string): number {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(keyFor(slug));
    if (raw == null) return DEFAULT;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clamp(parsed) : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

/* SSR-safe, never-throwing write. */
function write(slug: string, value: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(slug), String(value));
  } catch {
    /* storage full or blocked — silently ignore */
  }
}

/**
 * Persistent happiness counter (0..100) for a pet companion, scoped per slug.
 * Returns the current value plus a `bump` to adjust it (positive or negative).
 */
export function useHappiness(slug: string): {
  happiness: number;
  bump: (n?: number) => void;
} {
  const [happiness, setHappiness] = useState(() => read(slug));

  /* Resync when the friend changes — load that slug's stored value. */
  useEffect(() => {
    setHappiness(read(slug));
  }, [slug]);

  const bump = useCallback(
    (n = 5) => {
      setHappiness((prev) => {
        const next = clamp(prev + n);
        write(slug, next);
        return next;
      });
    },
    [slug],
  );

  return { happiness, bump };
}

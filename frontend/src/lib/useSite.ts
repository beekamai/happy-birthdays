import { useEffect, useState } from "react";
import { fetchSite } from "./api.ts";
import type { SiteConfig } from "./types.ts";

/* `Window.__SITE__` is declared in useFriend.ts (global augmentation). */

interface UseSiteResult {
  site: SiteConfig | null;
  loading: boolean;
  error: boolean;
}

function injectedSite(): SiteConfig | null {
  return typeof window !== "undefined" ? window.__SITE__ ?? null : null;
}

/**
 * Dual-path site-config loader. Mirrors useFriend: synchronous from the
 * injected `window.__SITE__` in prod, fetched from the API in dev.
 */
export function useSite(): UseSiteResult {
  const [site, setSite] = useState<SiteConfig | null>(() => injectedSite());
  const [loading, setLoading] = useState<boolean>(() => injectedSite() === null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const injected = injectedSite();
    if (injected) {
      setSite(injected);
      setLoading(false);
      setError(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(false);
    fetchSite()
      .then((data) => {
        if (!alive) return;
        setSite(data);
        setError(false);
      })
      .catch(() => {
        if (!alive) return;
        setSite(null);
        setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return { site, loading, error };
}

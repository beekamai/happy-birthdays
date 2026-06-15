import { useEffect, useState } from "react";
import { fetchFriend } from "./api.ts";
import type { PublicFriend, SiteConfig } from "./types.ts";

declare global {
  interface Window {
    __BIRTHDAY__?: PublicFriend;
    __SITE__?: SiteConfig;
  }
}

interface UseFriendResult {
  friend: PublicFriend | null;
  loading: boolean;
  error: boolean;
}

/* Read an injected friend only when it matches the requested slug. In prod the
   backend injects `window.__BIRTHDAY__` for the current page; if the slug
   differs (stale inject, client nav), we ignore it and fetch fresh. */
function injectedFor(slug: string): PublicFriend | null {
  const injected = typeof window !== "undefined" ? window.__BIRTHDAY__ : undefined;
  return injected && injected.slug === slug ? injected : null;
}

/**
 * Dual-path friend loader. Initializes synchronously from the injected payload
 * (no loading flash in prod), otherwise fetches from the API in dev.
 */
export function useFriend(slug: string): UseFriendResult {
  const [friend, setFriend] = useState<PublicFriend | null>(() =>
    injectedFor(slug),
  );
  const [loading, setLoading] = useState<boolean>(() => injectedFor(slug) === null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const injected = injectedFor(slug);
    if (injected) {
      setFriend(injected);
      setLoading(false);
      setError(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(false);
    fetchFriend(slug)
      .then((data) => {
        if (!alive) return;
        setFriend(data);
        setError(false);
      })
      .catch(() => {
        if (!alive) return;
        setFriend(null);
        setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [slug]);

  return { friend, loading, error };
}

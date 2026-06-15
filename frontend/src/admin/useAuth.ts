import { useCallback, useEffect, useState } from "react";

import {
  fetchAuthConfig,
  fetchMe,
  logout as logoutApi,
  type AuthConfig,
  type AuthUser,
} from "./adminApi.ts";

/* Session hook for the admin app. On mount it fetches `/api/auth/me` (the
   logged-in user, if any) and `/api/auth/config` (the public bot config) in
   parallel. `refresh()` re-checks the session after a login; `logout()` clears
   the cookie and resets `user` to null. */

interface UseAuth {
  user: AuthUser | null;
  config: AuthConfig | null;
  loading: boolean;
  /** Re-fetch the current session (call after a successful Telegram login). */
  refresh: () => Promise<void>;
  /** Clear the session cookie and reset state. */
  logout: () => Promise<void>;
}

export function useAuth(): UseAuth {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const me = await fetchMe();
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    await logoutApi();
    setUser(null);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [me, cfg] = await Promise.all([fetchMe(), fetchAuthConfig()]);
      if (!alive) return;
      setUser(me);
      setConfig(cfg);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { user, config, loading, refresh, logout };
}

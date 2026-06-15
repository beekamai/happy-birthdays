import { useCallback, useEffect, useState } from "react";

import { fetchTotals, type DualTotals } from "./api.ts";

/* Authoritative personal + page-wide score totals, fetched from the server.
   `refresh` re-pulls after a game so the page badges reflect the new bests. */
export function useTotals(
  slug: string,
  visitorId: string,
): {
  totals: DualTotals | null;
  refresh: () => void;
} {
  const [totals, setTotals] = useState<DualTotals | null>(null);

  const refresh = useCallback(() => {
    let alive = true;
    void fetchTotals(slug, visitorId).then((t) => {
      if (alive && t) setTotals(t);
    });
    return () => {
      alive = false;
    };
  }, [slug, visitorId]);

  useEffect(() => refresh(), [refresh]);

  return { totals, refresh };
}

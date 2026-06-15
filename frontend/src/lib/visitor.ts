/* A stable per-device visitor id, kept in localStorage. It identifies the
   player (so they get their OWN running score) without any account — a
   lightweight client-side fingerprint. The server additionally tags rows with
   the request IP for grouping, but scoring keys on this id. */

const KEY = "hb-visitor-id";

let cached: string | null = null;

export function getVisitorId(): string {
  if (cached) return cached;
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(KEY, id);
    }
    cached = id;
    return id;
  } catch {
    /* private mode — ephemeral id for this session */
    cached = cached ?? `v-${Math.random().toString(36).slice(2)}`;
    return cached;
  }
}

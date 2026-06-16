/* Native-fetch helpers for the decoration shop. Public reads (catalog + state)
   hit the unauthenticated GET endpoints; writes (buy/equip) go through the admin
   routes and require the httpOnly session cookie, so they pass
   `credentials: "include"`. Reads return safe fallbacks on error; `buyItem`
   surfaces the HTTP status so the UI can toast 402 (not enough points) / 409
   (already owned) distinctly. */

export type DecorType = "avatarFrame" | "background" | "badge" | "effect";

export interface ShopItem {
  id: string;
  type: DecorType;
  nameRu: string;
  nameEn: string;
  cost: number;
}

export interface ShopState {
  earned: number;
  spent: number;
  balance: number;
  owned: string[];
  equipped: Record<string, string | undefined>;
}

/** A failed purchase carrying the HTTP status so callers can pick a message. */
export interface ShopError {
  error: true;
  status: number;
}

/** Fetch the public catalogue of decorations. Returns `[]` on error. */
export async function fetchCatalog(): Promise<ShopItem[]> {
  try {
    const res = await fetch("/api/shop/catalog");
    if (!res.ok) return [];
    const body = (await res.json()) as { items?: ShopItem[] };
    return body.items ?? [];
  } catch {
    return [];
  }
}

/** Fetch a friend's wallet + ownership + equipped slots. `null` on error. */
export async function fetchShopState(slug: string): Promise<ShopState | null> {
  try {
    const res = await fetch(`/api/shop/${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    return (await res.json()) as ShopState;
  } catch {
    return null;
  }
}

/**
 * Buy a catalogue item (auto-equips on success). Returns the fresh state, or a
 * `ShopError` with the status (402 too poor, 409 owned, 403/401 no rights).
 */
export async function buyItem(
  slug: string,
  itemId: string,
): Promise<ShopState | ShopError> {
  try {
    const res = await fetch(`/api/admin/shop/${encodeURIComponent(slug)}/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ itemId }),
    });
    if (!res.ok) return { error: true, status: res.status };
    return (await res.json()) as ShopState;
  } catch {
    return { error: true, status: 0 };
  }
}

/**
 * Equip an owned item into its slot, or clear the slot when `itemId` is null.
 * Returns the fresh state, or `null` on failure.
 */
export async function equipItem(
  slug: string,
  type: DecorType,
  itemId: string | null,
): Promise<ShopState | null> {
  try {
    const res = await fetch(
      `/api/admin/shop/${encodeURIComponent(slug)}/equip`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, itemId }),
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as ShopState;
  } catch {
    return null;
  }
}

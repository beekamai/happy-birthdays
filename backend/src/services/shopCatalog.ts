/* The shop catalogue: the economic source of truth for decorations a friend can
   buy with the points visitors earn on their birthday page. Costs and item ids
   live here; the frontend holds the matching visual renderers keyed by the same
   ids. Add items by appending — ids are permanent (referenced by purchases). */

export type DecorType = "avatarFrame" | "background" | "badge" | "effect" | "companion";

export const DECOR_SLOTS: DecorType[] = [
    "avatarFrame",
    "background",
    "badge",
    "effect",
    "companion",
];

export interface ShopItem {
    id: string;
    type: DecorType;
    nameRu: string;
    nameEn: string;
    cost: number;
}

/* Prices are tuned to the points a page can earn: a well-played page nets ~4000
   across the five games (best-per-game), so badges are pocket-money, frames /
   backgrounds are a session's worth, and effects / the fox are a save-up goal.
   The whole catalogue (~7k) is affordable only for a popular, much-played page. */
export const SHOP_CATALOG: ShopItem[] = [
    /* Avatar frames — a decorative ring around the avatar. */
    { id: "frame-gold", type: "avatarFrame", nameRu: "Золотая рамка", nameEn: "Gold frame", cost: 500 },
    { id: "frame-neon", type: "avatarFrame", nameRu: "Неоновое сияние", nameEn: "Neon glow", cost: 600 },
    { id: "frame-flower", type: "avatarFrame", nameRu: "Цветочный венок", nameEn: "Flower wreath", cost: 700 },

    /* Backgrounds — an ambient page pattern behind the content. */
    { id: "bg-stars", type: "background", nameRu: "Звёздная пыль", nameEn: "Stardust", cost: 550 },
    { id: "bg-hearts", type: "background", nameRu: "Сердечки", nameEn: "Hearts", cost: 550 },
    { id: "bg-confetti", type: "background", nameRu: "Конфетти", nameEn: "Confetti", cost: 650 },

    /* Badges — a little emblem beside the name. */
    { id: "badge-crown", type: "badge", nameRu: "Корона", nameEn: "Crown", cost: 350 },
    { id: "badge-star", type: "badge", nameRu: "Звезда", nameEn: "Star", cost: 250 },
    { id: "badge-fire", type: "badge", nameRu: "Огонёк", nameEn: "Fire", cost: 300 },

    /* Effects — an ambient animated overlay. */
    { id: "fx-hearts", type: "effect", nameRu: "Падающие сердечки", nameEn: "Falling hearts", cost: 900 },
    { id: "fx-sparkles", type: "effect", nameRu: "Искорки", nameEn: "Sparkles", cost: 850 },

    /* Companions — a draggable mascot that follows the friend onto their profile. */
    { id: "pet-fox", type: "companion", nameRu: "Лисёнок-питомец", nameEn: "Fox companion", cost: 1200 },
];

const BY_ID = new Map(SHOP_CATALOG.map((item) => [item.id, item]));

export function shopItem(id: string): ShopItem | undefined {
    return BY_ID.get(id);
}

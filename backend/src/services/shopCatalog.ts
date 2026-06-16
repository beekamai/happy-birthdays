/* The shop catalogue: the economic source of truth for decorations a friend can
   buy with the points visitors earn on their birthday page. Costs and item ids
   live here; the frontend holds the matching visual renderers keyed by the same
   ids. Add items by appending — ids are permanent (referenced by purchases). */

export type DecorType = "avatarFrame" | "background" | "badge" | "effect";

export const DECOR_SLOTS: DecorType[] = ["avatarFrame", "background", "badge", "effect"];

export interface ShopItem {
    id: string;
    type: DecorType;
    nameRu: string;
    nameEn: string;
    cost: number;
}

export const SHOP_CATALOG: ShopItem[] = [
    /* Avatar frames — a decorative ring around the avatar. */
    { id: "frame-gold", type: "avatarFrame", nameRu: "Золотая рамка", nameEn: "Gold frame", cost: 400 },
    { id: "frame-neon", type: "avatarFrame", nameRu: "Неоновое сияние", nameEn: "Neon glow", cost: 450 },
    { id: "frame-flower", type: "avatarFrame", nameRu: "Цветочный венок", nameEn: "Flower wreath", cost: 550 },

    /* Backgrounds — an ambient page pattern behind the content. */
    { id: "bg-stars", type: "background", nameRu: "Звёздная пыль", nameEn: "Stardust", cost: 500 },
    { id: "bg-hearts", type: "background", nameRu: "Сердечки", nameEn: "Hearts", cost: 500 },
    { id: "bg-confetti", type: "background", nameRu: "Конфетти", nameEn: "Confetti", cost: 600 },

    /* Badges — a little emblem beside the name. */
    { id: "badge-crown", type: "badge", nameRu: "Корона", nameEn: "Crown", cost: 250 },
    { id: "badge-star", type: "badge", nameRu: "Звезда", nameEn: "Star", cost: 200 },
    { id: "badge-fire", type: "badge", nameRu: "Огонёк", nameEn: "Fire", cost: 250 },

    /* Effects — an ambient animated overlay. */
    { id: "fx-hearts", type: "effect", nameRu: "Падающие сердечки", nameEn: "Falling hearts", cost: 800 },
    { id: "fx-sparkles", type: "effect", nameRu: "Искорки", nameEn: "Sparkles", cost: 750 },
];

const BY_ID = new Map(SHOP_CATALOG.map((item) => [item.id, item]));

export function shopItem(id: string): ShopItem | undefined {
    return BY_ID.get(id);
}

import FriendRepository from "../repositories/FriendRepository";
import ScoreRepository from "../repositories/ScoreRepository";
import PurchaseRepository from "../repositories/PurchaseRepository";
import { readUser } from "./authController";
import type { AuthUser } from "../models/Auth";
import type { Decor } from "../models/Friend";
import { SHOP_CATALOG, DECOR_SLOTS, shopItem, type DecorType } from "../services/shopCatalog";
import Logger from "../utils/Logger";

function canEdit(user: AuthUser, cfgUsername?: string): boolean {
    if (user.isOwner) return true;
    if (!cfgUsername) return false;
    return user.username === cfgUsername.replace(/^@/, "").toLowerCase();
}

/* The friend's spendable balance = points visitors earned on their page minus
   everything already spent in the shop. */
function walletOf(slug: string) {
    const earned = ScoreRepository.globalTotals(slug).total;
    const spent = PurchaseRepository.totalSpent(slug);
    return { earned, spent, balance: Math.max(0, earned - spent) };
}

function stateOf(slug: string, decor: Decor | undefined) {
    return {
        ...walletOf(slug),
        owned: PurchaseRepository.ownedIds(slug),
        equipped: decor ?? {},
    };
}

/** GET /api/shop/catalog — the public list of buyable decorations. */
export const getCatalog = async ({ set }: any) => {
    set.status = 200;
    return { items: SHOP_CATALOG };
};

/** GET /api/shop/:slug — wallet, owned items and equipped decor for a friend. */
export const getShopState = async ({ params, set }: any) => {
    const cfg = FriendRepository.getRawConfig(params.slug);
    if (!cfg) { set.status = 404; return { error: "Unknown friend" }; }
    set.status = 200;
    return stateOf(params.slug, cfg.decor);
};

/** POST /api/admin/shop/:slug/buy — spend points to own an item, then equip it. */
export const buyItem = async ({ params, body, jwt, cookie, set }: any) => {
    try {
        const user = await readUser(jwt, cookie);
        if (!user) { set.status = 401; return { error: "Unauthorized" }; }
        const cfg = FriendRepository.getRawConfig(params.slug);
        if (!cfg) { set.status = 404; return { error: "Not found" }; }
        if (!canEdit(user, cfg.username)) { set.status = 403; return { error: "Forbidden" }; }

        const item = shopItem(String(body?.itemId ?? ""));
        if (!item) { set.status = 400; return { error: "Unknown item" }; }
        if (PurchaseRepository.owns(params.slug, item.id)) {
            set.status = 409;
            return { error: "Already owned" };
        }
        if (walletOf(params.slug).balance < item.cost) {
            set.status = 402;
            return { error: "Not enough points" };
        }

        if (!PurchaseRepository.record(params.slug, item.id, item.cost)) {
            set.status = 409;
            return { error: "Already owned" };
        }

        /* Auto-equip the freshly bought item into its slot. */
        const decor: Decor = { ...(cfg.decor ?? {}), [item.type]: item.id };
        FriendRepository.writeConfig(params.slug, { ...cfg, decor });

        set.status = 200;
        return { ok: true, ...stateOf(params.slug, decor) };
    } catch (error) {
        Logger.error("ShopController", `buyItem error: ${error}`, { slug: params?.slug });
        set.status = 500;
        return { error: "Internal server error" };
    }
};

/** POST /api/admin/shop/:slug/equip — equip an owned item, or clear a slot. */
export const equipItem = async ({ params, body, jwt, cookie, set }: any) => {
    try {
        const user = await readUser(jwt, cookie);
        if (!user) { set.status = 401; return { error: "Unauthorized" }; }
        const cfg = FriendRepository.getRawConfig(params.slug);
        if (!cfg) { set.status = 404; return { error: "Not found" }; }
        if (!canEdit(user, cfg.username)) { set.status = 403; return { error: "Forbidden" }; }

        const slot = String(body?.type ?? "") as DecorType;
        if (!DECOR_SLOTS.includes(slot)) { set.status = 400; return { error: "Unknown slot" }; }

        const rawId = body?.itemId;
        const decor: Decor = { ...(cfg.decor ?? {}) };

        if (rawId === null || rawId === undefined || rawId === "") {
            /* Clear the slot. */
            delete decor[slot];
        } else {
            const item = shopItem(String(rawId));
            if (!item || item.type !== slot) { set.status = 400; return { error: "Item does not fit slot" }; }
            if (!PurchaseRepository.owns(params.slug, item.id)) {
                set.status = 403;
                return { error: "Item not owned" };
            }
            decor[slot] = item.id;
        }

        FriendRepository.writeConfig(params.slug, { ...cfg, decor });
        set.status = 200;
        return { ok: true, ...stateOf(params.slug, decor) };
    } catch (error) {
        Logger.error("ShopController", `equipItem error: ${error}`, { slug: params?.slug });
        set.status = 500;
        return { error: "Internal server error" };
    }
};

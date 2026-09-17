import CasinoRepository from "../repositories/CasinoRepository";
import FriendRepository from "../repositories/FriendRepository";
import ScoreRepository from "../repositories/ScoreRepository";
import {
    BONUS_COOLDOWN_MS,
    CASINO_GAMES,
    DAILY_BONUS,
    MAX_BET,
    MIN_BET,
    MIN_DONATION,
    casinoGame,
    normalizeBet,
    spin,
    validPick,
} from "../services/casino";
import { clientIp } from "../utils/clientIp";
import Logger from "../utils/Logger";

/* The casino runs on a visitor's PERSONAL points — the ones they earned playing
   the mini-games on this page — which is a different purse from the friend's
   shop wallet. A player can gamble that purse here and, when they are happy with
   it, donate what is left into the friend's wallet (shopController folds
   CasinoRepository.donatedTo into `earned`).

   Like /api/scores, these routes are anonymous and keyed by the client's
   localStorage `visitorId`: there are no accounts anywhere in this app. A caller
   can therefore only spend points that the visitorId they present has itself
   earned, and the worst a guessed uuid buys is burning a stranger's chips — the
   same trust model the score endpoints already run on. */

/** Balance, limits and lifetime stats for one visitor on one page. */
function walletOf(slug: string, visitorId: string, ip: string) {
    /* Points the visitor earned themselves: their best run per game. This only
       ever grows (a new personal record), so the derived balance can't go
       negative behind an already-settled bet. */
    const earned = Math.max(0, ScoreRepository.personalTotals(slug, visitorId).total);
    const balance = Math.max(0, earned + CasinoRepository.net(slug, visitorId));
    const lastBonus = CasinoRepository.lastBonusAt(visitorId, ip);
    const nextBonusAt = lastBonus ? lastBonus + BONUS_COOLDOWN_MS : 0;

    return {
        earned,
        balance,
        stats: CasinoRepository.stats(slug, visitorId),
        bonus: {
            amount: DAILY_BONUS,
            available: Date.now() >= nextBonusAt,
            nextAt: nextBonusAt,
        },
        limits: { minBet: MIN_BET, maxBet: MAX_BET, minDonation: MIN_DONATION },
    };
}

/* Resolve the page and make sure its economy is live. Returns the error status
   to send, or null when play is allowed. */
function closedReason(slug: string): { status: number; error: string } | null {
    const friend = FriendRepository.findBySlug(slug);
    if (!friend) return { status: 404, error: "Unknown friend" };
    if (friend.access.state === "locked") return { status: 403, error: "Page is locked" };
    if (!friend.gamesEnabled) return { status: 403, error: "Games are not available" };
    return null;
}

/** GET /api/casino/games — the tables and their payout multipliers. */
export const getGames = async ({ set }: any) => {
    set.status = 200;
    return { games: CASINO_GAMES };
};

/** GET /api/casino/:slug?visitorId=… — a visitor's chips, bonus and stats. */
export const getCasinoState = async ({ params, query, headers, set }: any) => {
    try {
        const closed = closedReason(params.slug);
        if (closed) {
            set.status = closed.status;
            return { error: closed.error };
        }
        const visitorId = typeof query?.visitorId === "string" ? query.visitorId : "";
        set.status = 200;
        return walletOf(params.slug, visitorId, clientIp(headers ?? {}));
    } catch (error) {
        Logger.error("CasinoController", `getCasinoState error: ${error}`, {
            slug: params?.slug,
        });
        set.status = 500;
        return { error: "Internal server error" };
    }
};

/**
 * POST /api/casino/:slug/bet — stake points on a table.
 * Body: { visitorId, gameId, bet, pick }. The SERVER rolls the outcome (the
 * client picks a side, never a result), settles it into the ledger, and returns
 * the roll with the fresh wallet.
 */
export const placeBet = async ({ params, body, headers, set }: any) => {
    const slug = params?.slug;
    try {
        const closed = closedReason(slug);
        if (closed) {
            set.status = closed.status;
            return { error: closed.error };
        }

        const visitorId = typeof body?.visitorId === "string" ? body.visitorId : "";
        if (!visitorId) {
            set.status = 400;
            return { error: "visitorId is required" };
        }

        const game = casinoGame(String(body?.gameId ?? ""));
        if (!game) {
            set.status = 400;
            return { error: "Unknown game" };
        }
        const bet = normalizeBet(body?.bet);
        if (bet === null) {
            set.status = 400;
            return { error: "Bet out of range" };
        }
        const pick = typeof body?.pick === "string" ? body.pick : "";
        if (!validPick(game, pick)) {
            set.status = 400;
            return { error: "Invalid pick" };
        }

        const ip = clientIp(headers ?? {});
        const before = walletOf(slug, visitorId, ip);
        if (before.balance < bet) {
            set.status = 402;
            return { error: "Not enough points" };
        }

        const outcome = spin(game, bet, pick);
        if (
            !CasinoRepository.record({
                slug,
                visitorId,
                kind: "bet",
                detail: game.id,
                stake: bet,
                delta: outcome.delta,
                ip,
            })
        ) {
            set.status = 500;
            return { error: "Could not settle the bet" };
        }

        set.status = 200;
        return { ok: true, outcome, ...walletOf(slug, visitorId, ip) };
    } catch (error) {
        Logger.error("CasinoController", `placeBet error: ${error}`, { slug });
        set.status = 500;
        return { error: "Internal server error" };
    }
};

/**
 * POST /api/casino/:slug/bonus — claim the once-a-day free chips.
 * Body: { visitorId }. Gated per visitor AND per ip so a cleared localStorage
 * doesn't mint a second bonus for the day.
 */
export const claimBonus = async ({ params, body, headers, set }: any) => {
    const slug = params?.slug;
    try {
        const closed = closedReason(slug);
        if (closed) {
            set.status = closed.status;
            return { error: closed.error };
        }

        const visitorId = typeof body?.visitorId === "string" ? body.visitorId : "";
        if (!visitorId) {
            set.status = 400;
            return { error: "visitorId is required" };
        }

        const ip = clientIp(headers ?? {});
        const wallet = walletOf(slug, visitorId, ip);
        if (!wallet.bonus.available) {
            set.status = 429;
            return { error: "Bonus already claimed", nextAt: wallet.bonus.nextAt };
        }

        if (
            !CasinoRepository.record({
                slug,
                visitorId,
                kind: "bonus",
                detail: "daily",
                delta: DAILY_BONUS,
                ip,
            })
        ) {
            set.status = 500;
            return { error: "Could not grant the bonus" };
        }

        set.status = 200;
        return { ok: true, amount: DAILY_BONUS, ...walletOf(slug, visitorId, ip) };
    } catch (error) {
        Logger.error("CasinoController", `claimBonus error: ${error}`, { slug });
        set.status = 500;
        return { error: "Internal server error" };
    }
};

/**
 * POST /api/casino/:slug/donate — move personal points into the friend's shop
 * wallet. Body: { visitorId, amount }. One-way and final: the points leave the
 * visitor's purse for good and show up as `donated` in the shop.
 */
export const donatePoints = async ({ params, body, headers, set }: any) => {
    const slug = params?.slug;
    try {
        const closed = closedReason(slug);
        if (closed) {
            set.status = closed.status;
            return { error: closed.error };
        }

        const visitorId = typeof body?.visitorId === "string" ? body.visitorId : "";
        if (!visitorId) {
            set.status = 400;
            return { error: "visitorId is required" };
        }

        const amount = Math.floor(Number(body?.amount));
        if (!Number.isFinite(amount) || amount < MIN_DONATION) {
            set.status = 400;
            return { error: "Amount too small" };
        }

        const ip = clientIp(headers ?? {});
        if (walletOf(slug, visitorId, ip).balance < amount) {
            set.status = 402;
            return { error: "Not enough points" };
        }

        if (
            !CasinoRepository.record({
                slug,
                visitorId,
                kind: "donation",
                detail: slug,
                delta: -amount,
                ip,
            })
        ) {
            set.status = 500;
            return { error: "Could not send the gift" };
        }

        Logger.info("CasinoController", "points donated", { slug, amount });
        set.status = 200;
        return {
            ok: true,
            amount,
            pageDonated: CasinoRepository.donatedTo(slug),
            ...walletOf(slug, visitorId, ip),
        };
    } catch (error) {
        Logger.error("CasinoController", `donatePoints error: ${error}`, { slug });
        set.status = 500;
        return { error: "Internal server error" };
    }
};

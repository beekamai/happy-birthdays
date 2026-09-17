import { randomInt } from "node:crypto";

/* Server-authoritative casino. Mirrors the rule from gameScoring.ts — the client
   never decides an outcome. A bet POST carries only the stake and the player's
   pick; the roll itself is drawn here with `crypto.randomInt` (unbiased, unlike
   `Math.random() * n`), so a tampered client can lie about nothing that matters.

   Every table pays back LESS than it takes on average (see RTP below). That is
   not flavour — it is the economy's safety valve: casino winnings can be donated
   into a friend's shop wallet, so a table with a non-negative edge would let a
   patient player mint the whole 7400-point catalogue out of thin air. The house
   edge keeps the wallet fed by *playing*, with the casino as a risky shortcut. */

export type CasinoGameId = "coin" | "dice" | "slots";

/* Stake bounds. The floor keeps the ledger from filling with 1-point spins; the
   ceiling bounds how fast a lucky streak can inflate a page's shop wallet. */
export const MIN_BET = 10;
export const MAX_BET = 500;

/* Smallest gift that may be sent to the friend's shop wallet. */
export const MIN_DONATION = 10;

/* A free top-up so a cleaned-out player can win their way back ("отыграться")
   without having to beat their own game records first. Once per day, per
   visitor AND per ip (see CasinoRepository.lastBonusAt). */
export const DAILY_BONUS = 100;
export const BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/* Coin faces and slot reel symbols, as stable ids. The UI maps them to emoji +
   localized names; the wire format stays ascii so it survives the JSON round
   trip and can be logged. */
const COIN_FACES = ["fox", "star"] as const;
const SLOT_SYMBOLS = ["ramen", "fox", "star", "cake", "dango", "balloon"] as const;
const DICE_FACES = ["1", "2", "3", "4", "5", "6"] as const;

/* The jackpot symbol — three of these pay the top multiplier. */
const JACKPOT_SYMBOL = "ramen";

/* Payout multipliers, applied to the stake and floored to whole points.
     coin   1/2 × 1.9                                    → RTP 95.0%
     dice   1/6 × 5.7                                    → RTP 95.0%
     slots  1/216 × 40 + 5/216 × 20 + 90/216 × 0.75      → RTP 96.1%
   Keep every table below 1.0 when tuning — see the note at the top. */
const COIN_PAYOUT = 1.9;
const DICE_PAYOUT = 5.7;
const SLOTS_JACKPOT = 40;
const SLOTS_TRIPLE = 20;
const SLOTS_PAIR = 0.75;

/** A table the player can sit at, described for the UI so payouts aren't
    duplicated client-side. */
export interface CasinoGame {
    id: CasinoGameId;
    /** Ids the player may pick, or `[]` when the table takes no pick (slots). */
    picks: readonly string[];
    /** Every symbol the table can roll — lets the UI pre-render the reels. */
    symbols: readonly string[];
    /** Multipliers keyed by outcome, highest first, for the payout table. */
    payouts: { kind: OutcomeKind; multiplier: number }[];
}

/** How a spin ended — also the i18n key suffix the UI shows. */
export type OutcomeKind = "jackpot" | "triple" | "pair" | "win" | "lose";

/** The result of one settled spin. */
export interface SpinOutcome {
    gameId: CasinoGameId;
    /** What the house rolled: one face for coin/dice, three symbols for slots. */
    roll: string[];
    kind: OutcomeKind;
    /** Multiplier applied to the stake (0 when the spin lost). */
    multiplier: number;
    /** Points paid back, `floor(bet × multiplier)`. */
    payout: number;
    /** Signed change to the player's balance, `payout − bet`. */
    delta: number;
}

/** The public table list, in the order the UI shows them. */
export const CASINO_GAMES: CasinoGame[] = [
    {
        id: "coin",
        picks: COIN_FACES,
        symbols: COIN_FACES,
        payouts: [{ kind: "win", multiplier: COIN_PAYOUT }],
    },
    {
        id: "dice",
        picks: DICE_FACES,
        symbols: DICE_FACES,
        payouts: [{ kind: "win", multiplier: DICE_PAYOUT }],
    },
    {
        id: "slots",
        picks: [],
        symbols: SLOT_SYMBOLS,
        payouts: [
            { kind: "jackpot", multiplier: SLOTS_JACKPOT },
            { kind: "triple", multiplier: SLOTS_TRIPLE },
            { kind: "pair", multiplier: SLOTS_PAIR },
        ],
    },
];

const GAMES_BY_ID = new Map<string, CasinoGame>(CASINO_GAMES.map((g) => [g.id, g]));

/** Look up a table by id, or `undefined` for an unknown one. */
export function casinoGame(id: string): CasinoGame | undefined {
    return GAMES_BY_ID.get(id);
}

/** Uniformly draw one element. Uses crypto randomness, never Math.random. */
function draw<T>(items: readonly T[]): T {
    return items[randomInt(items.length)]!;
}

/**
 * Coerce a stake to a whole number of points inside the table limits.
 * @returns the clamped stake, or `null` when the input isn't a usable number.
 */
export function normalizeBet(raw: unknown): number | null {
    const bet = Math.floor(Number(raw));
    if (!Number.isFinite(bet) || bet < MIN_BET || bet > MAX_BET) return null;
    return bet;
}

/**
 * Whether `pick` is a legal choice at this table. Tables that take no pick
 * (slots) accept anything, including nothing at all.
 */
export function validPick(game: CasinoGame, pick: unknown): boolean {
    if (game.picks.length === 0) return true;
    return typeof pick === "string" && game.picks.includes(pick);
}

/**
 * Roll a spin and settle it. The caller has already checked the stake, the pick
 * and the player's balance; this only draws the outcome and prices it.
 */
export function spin(game: CasinoGame, bet: number, pick: string): SpinOutcome {
    const { roll, kind, multiplier } =
        game.id === "slots" ? rollSlots() : rollPick(game, pick);

    const payout = Math.floor(bet * multiplier);
    return { gameId: game.id, roll, kind, multiplier, payout, delta: payout - bet };
}

/* Coin and dice share a shape: one draw, pays when it matches the pick. */
function rollPick(
    game: CasinoGame,
    pick: string,
): { roll: string[]; kind: OutcomeKind; multiplier: number } {
    const face = draw(game.picks);
    const won = face === pick;
    const multiplier = game.id === "dice" ? DICE_PAYOUT : COIN_PAYOUT;
    return { roll: [face], kind: won ? "win" : "lose", multiplier: won ? multiplier : 0 };
}

/* Three independent reels; three of a kind pays (double for the jackpot symbol),
   any two of a kind refunds most of the stake. */
function rollSlots(): { roll: string[]; kind: OutcomeKind; multiplier: number } {
    const roll = [draw(SLOT_SYMBOLS), draw(SLOT_SYMBOLS), draw(SLOT_SYMBOLS)];
    const [a, b, c] = roll as [string, string, string];

    if (a === b && b === c) {
        return a === JACKPOT_SYMBOL
            ? { roll, kind: "jackpot", multiplier: SLOTS_JACKPOT }
            : { roll, kind: "triple", multiplier: SLOTS_TRIPLE };
    }
    if (a === b || b === c || a === c) {
        return { roll, kind: "pair", multiplier: SLOTS_PAIR };
    }
    return { roll, kind: "lose", multiplier: 0 };
}

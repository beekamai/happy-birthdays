import { Database } from "bun:sqlite";

import { CASINO_DB_PATH } from "../config/constants";
import Logger from "../utils/Logger";

/* Ledger of everything that moves a VISITOR's personal points on a page. The
   balance itself is never stored — it is derived, the same way the shop derives
   the friend's wallet:

     personal balance = sum of that visitor's best score per game   (ScoreRepository)
                      + SUM(delta) of their rows here              (this ledger)

   so the two economies stay separate and auditable: games mint points, the
   casino moves them around, and a donation burns them here to top up the
   friend's shop wallet (see CasinoRepository.donatedTo, read by shopController).

   Static methods only; prepared statements; try-catch → 0/false on failure. */

/** What a ledger row represents. */
export type LedgerKind = "bet" | "bonus" | "donation";

interface LedgerInput {
    slug: string;
    visitorId: string;
    kind: LedgerKind;
    /** Casino table id for a bet, the outcome for a bonus/donation — free text. */
    detail?: string;
    /** Points risked (bets only); kept so the stats strip can show turnover. */
    stake?: number;
    /** Signed change to the visitor's balance: +bonus, payout−bet, −donation. */
    delta: number;
    ip?: string;
}

/** Lifetime casino numbers for one visitor on one page. */
export interface CasinoStats {
    /** Settled spins. */
    plays: number;
    /** Points staked across those spins. */
    wagered: number;
    /** Points paid back across those spins. */
    won: number;
    /** Points sent to the friend's shop wallet. */
    donated: number;
    /** Points claimed from the daily bonus. */
    bonused: number;
}

/* Sane bounds so a bug upstream can't write an absurd row. */
const DELTA_MIN = -1_000_000;
const DELTA_MAX = 1_000_000;

export default class CasinoRepository {
    private static db: Database | null = null;

    /** Open the DB (WAL) and ensure the schema + indexes. Idempotent. */
    static init(): void {
        try {
            if (this.db) return;
            const db = new Database(CASINO_DB_PATH, { create: true });
            db.exec("PRAGMA journal_mode = WAL;");
            db.exec(`
                CREATE TABLE IF NOT EXISTS ledger (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    slug TEXT NOT NULL,
                    visitorId TEXT NOT NULL DEFAULT '',
                    kind TEXT NOT NULL,
                    detail TEXT NOT NULL DEFAULT '',
                    stake INTEGER NOT NULL DEFAULT 0,
                    delta INTEGER NOT NULL,
                    ip TEXT NOT NULL DEFAULT '',
                    createdAt INTEGER NOT NULL
                );
            `);
            db.exec(
                "CREATE INDEX IF NOT EXISTS idx_ledger_visitor ON ledger (slug, visitorId, kind);",
            );
            db.exec("CREATE INDEX IF NOT EXISTS idx_ledger_page ON ledger (slug, kind);");
            /* The daily bonus is looked up by visitorId OR ip, newest first. */
            db.exec(
                "CREATE INDEX IF NOT EXISTS idx_ledger_bonus ON ledger (kind, ip, createdAt DESC);",
            );
            this.db = db;
            Logger.info("CasinoRepository", "casino DB ready");
        } catch (error) {
            Logger.error("CasinoRepository", `init failed: ${error}`);
        }
    }

    private static getDb(): Database | null {
        if (!this.db) this.init();
        return this.db;
    }

    /** Append a ledger row (delta clamped). Returns false on failure. */
    static record(input: LedgerInput): boolean {
        try {
            const db = this.getDb();
            if (!db) return false;
            const delta = Math.max(DELTA_MIN, Math.min(DELTA_MAX, Math.trunc(input.delta)));
            db.query(
                `INSERT INTO ledger (slug, visitorId, kind, detail, stake, delta, ip, createdAt)
                 VALUES ($slug, $visitorId, $kind, $detail, $stake, $delta, $ip, $createdAt)`,
            ).run({
                $slug: input.slug,
                $visitorId: input.visitorId || "",
                $kind: input.kind,
                $detail: input.detail ?? "",
                $stake: Math.max(0, Math.trunc(input.stake ?? 0)),
                $delta: delta,
                $ip: input.ip || "",
                $createdAt: Date.now(),
            });
            return true;
        } catch (error) {
            Logger.error("CasinoRepository", `record failed: ${error}`, {
                slug: input.slug,
                kind: input.kind,
            });
            return false;
        }
    }

    /** Net points this visitor's ledger adds to (or takes from) their balance. */
    static net(slug: string, visitorId: string): number {
        try {
            const db = this.getDb();
            if (!db) return 0;
            const row = db
                .query<{ net: number }, { $slug: string; $visitorId: string }>(
                    `SELECT COALESCE(SUM(delta), 0) AS net FROM ledger
                     WHERE slug = $slug AND visitorId = $visitorId`,
                )
                .get({ $slug: slug, $visitorId: visitorId });
            return row?.net ?? 0;
        } catch (error) {
            Logger.error("CasinoRepository", `net failed: ${error}`, { slug });
            return 0;
        }
    }

    /** Lifetime turnover for one visitor on one page (all zeroes on failure). */
    static stats(slug: string, visitorId: string): CasinoStats {
        const empty: CasinoStats = { plays: 0, wagered: 0, won: 0, donated: 0, bonused: 0 };
        try {
            const db = this.getDb();
            if (!db) return empty;
            const row = db
                .query<
                    {
                        plays: number;
                        wagered: number;
                        won: number;
                        donated: number;
                        bonused: number;
                    },
                    { $slug: string; $visitorId: string }
                >(
                    `SELECT
                        COALESCE(SUM(kind = 'bet'), 0) AS plays,
                        COALESCE(SUM(CASE WHEN kind = 'bet' THEN stake END), 0) AS wagered,
                        COALESCE(SUM(CASE WHEN kind = 'bet' THEN stake + delta END), 0) AS won,
                        COALESCE(-SUM(CASE WHEN kind = 'donation' THEN delta END), 0) AS donated,
                        COALESCE(SUM(CASE WHEN kind = 'bonus' THEN delta END), 0) AS bonused
                     FROM ledger WHERE slug = $slug AND visitorId = $visitorId`,
                )
                .get({ $slug: slug, $visitorId: visitorId });
            return row ?? empty;
        } catch (error) {
            Logger.error("CasinoRepository", `stats failed: ${error}`, { slug });
            return empty;
        }
    }

    /**
     * When this player last claimed the daily bonus, as an epoch ms (0 = never).
     * Matched on visitorId OR ip across every page, so wiping localStorage — or
     * hopping between friends' pages — doesn't mint a second bonus for the day.
     */
    static lastBonusAt(visitorId: string, ip: string): number {
        try {
            const db = this.getDb();
            if (!db) return 0;
            const row = db
                .query<{ last: number | null }, { $visitorId: string; $ip: string }>(
                    `SELECT MAX(createdAt) AS last FROM ledger
                     WHERE kind = 'bonus'
                       AND ((visitorId <> '' AND visitorId = $visitorId)
                            OR (ip <> '' AND ip = $ip))`,
                )
                .get({ $visitorId: visitorId, $ip: ip });
            return row?.last ?? 0;
        } catch (error) {
            Logger.error("CasinoRepository", `lastBonusAt failed: ${error}`);
            return 0;
        }
    }

    /** Points visitors have gifted into this page's shop wallet. */
    static donatedTo(slug: string): number {
        try {
            const db = this.getDb();
            if (!db) return 0;
            const row = db
                .query<{ total: number }, { $slug: string }>(
                    `SELECT COALESCE(-SUM(delta), 0) AS total FROM ledger
                     WHERE slug = $slug AND kind = 'donation'`,
                )
                .get({ $slug: slug });
            return Math.max(0, row?.total ?? 0);
        } catch (error) {
            Logger.error("CasinoRepository", `donatedTo failed: ${error}`, { slug });
            return 0;
        }
    }

    /** Delete every ledger row for a slug (page deletion). Returns rows removed. */
    static deleteSlug(slug: string): number {
        try {
            const db = this.getDb();
            if (!db) return 0;
            return db.query("DELETE FROM ledger WHERE slug = $slug;").run({ $slug: slug })
                .changes;
        } catch (error) {
            Logger.error("CasinoRepository", `deleteSlug failed: ${error}`, { slug });
            return 0;
        }
    }
}

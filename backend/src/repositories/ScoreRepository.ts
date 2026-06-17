import { Database } from "bun:sqlite";

import { SCORES_DB_PATH } from "../config/constants";
import Logger from "../utils/Logger";

/* Persisted score row. */
export interface ScoreRow {
    id: number;
    slug: string;
    visitorId: string;
    gameId: string;
    score: number;
    durationMs: number;
    ip: string;
    createdAt: number;
}

interface InsertScoreInput {
    slug: string;
    visitorId: string;
    gameId: string;
    score: number;
    durationMs: number;
    ip?: string;
}

export interface Totals {
    total: number;
    games: { gameId: string; best: number }[];
}

/* Sane bounds to reject absurd / malicious score payloads. */
const SCORE_MIN = -10_000;
const SCORE_MAX = 1_000_000;

/**
 * Game-score Data Access Layer backed by a native bun:sqlite database.
 * Scores are attributed to a visitor (localStorage uuid) so each player gets
 * their own running total, alongside a page-wide total across all visitors.
 * Static methods only; prepared statements; try-catch → null/[] on failure.
 */
export default class ScoreRepository {
    private static db: Database | null = null;

    /** Open the DB (WAL), ensure schema + migrate older tables. Idempotent. */
    static init(): void {
        try {
            if (this.db) return;
            const db = new Database(SCORES_DB_PATH, { create: true });
            db.exec("PRAGMA journal_mode = WAL;");
            db.exec(`
                CREATE TABLE IF NOT EXISTS scores (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    slug TEXT NOT NULL,
                    visitorId TEXT NOT NULL DEFAULT '',
                    gameId TEXT NOT NULL,
                    score INTEGER NOT NULL,
                    durationMs INTEGER NOT NULL,
                    ip TEXT NOT NULL DEFAULT '',
                    createdAt INTEGER NOT NULL
                );
            `);

            /* Migrate tables created before visitorId/ip existed. */
            const cols = (db.query("PRAGMA table_info(scores);").all() as { name: string }[]).map(
                (c) => c.name,
            );
            if (!cols.includes("visitorId")) {
                db.exec("ALTER TABLE scores ADD COLUMN visitorId TEXT NOT NULL DEFAULT '';");
            }
            if (!cols.includes("ip")) {
                db.exec("ALTER TABLE scores ADD COLUMN ip TEXT NOT NULL DEFAULT '';");
            }

            db.exec(
                "CREATE INDEX IF NOT EXISTS idx_scores_page ON scores (slug, gameId, score DESC);",
            );
            db.exec(
                "CREATE INDEX IF NOT EXISTS idx_scores_visitor ON scores (slug, visitorId, gameId, score DESC);",
            );
            db.exec(
                "CREATE INDEX IF NOT EXISTS idx_scores_earn ON scores (slug, gameId, createdAt);",
            );
            this.db = db;
        } catch (error) {
            Logger.error("ScoreRepository", `init failed: ${error}`);
        }
    }

    private static getDb(): Database | null {
        if (!this.db) this.init();
        return this.db;
    }

    /** Insert a score row (score clamped). Returns the row or null. */
    static insertScore(input: InsertScoreInput): ScoreRow | null {
        try {
            const db = this.getDb();
            if (!db) return null;

            const score = Math.max(SCORE_MIN, Math.min(SCORE_MAX, Math.trunc(input.score)));
            const durationMs = Math.max(0, Math.trunc(input.durationMs));
            const createdAt = Date.now();

            const stmt = db.query(
                `INSERT INTO scores (slug, visitorId, gameId, score, durationMs, ip, createdAt)
                 VALUES ($slug, $visitorId, $gameId, $score, $durationMs, $ip, $createdAt)
                 RETURNING id, slug, visitorId, gameId, score, durationMs, ip, createdAt;`,
            );
            return stmt.get({
                $slug: input.slug,
                $visitorId: input.visitorId || "",
                $gameId: input.gameId,
                $score: score,
                $durationMs: durationMs,
                $ip: input.ip || "",
                $createdAt: createdAt,
            }) as ScoreRow | null;
        } catch (error) {
            Logger.error("ScoreRepository", `insertScore failed: ${error}`, {
                slug: input.slug,
                gameId: input.gameId,
            });
            return null;
        }
    }

    /** Best (max) score for a game by a specific visitor (0 if none). */
    static bestScore(slug: string, gameId: string, visitorId: string): number {
        try {
            const db = this.getDb();
            if (!db) return 0;
            const row = db
                .query(
                    `SELECT MAX(score) AS best FROM scores
                     WHERE slug = $slug AND gameId = $gameId AND visitorId = $visitorId;`,
                )
                .get({ $slug: slug, $gameId: gameId, $visitorId: visitorId }) as
                | { best: number | null }
                | null;
            return row?.best ?? 0;
        } catch (error) {
            Logger.error("ScoreRepository", `bestScore failed: ${error}`, { slug, gameId });
            return 0;
        }
    }

    /** Per-visitor totals: sum of that visitor's best per game on this page. */
    static personalTotals(slug: string, visitorId: string): Totals {
        return this.aggregate(
            `SELECT gameId, MAX(score) AS best FROM scores
             WHERE slug = $slug AND visitorId = $visitorId GROUP BY gameId;`,
            { $slug: slug, $visitorId: visitorId },
            { slug, visitorId },
        );
    }

    /** Page-wide totals: sum of the best per game across ALL visitors. */
    static globalTotals(slug: string): Totals {
        return this.aggregate(
            `SELECT gameId, MAX(score) AS best FROM scores WHERE slug = $slug GROUP BY gameId;`,
            { $slug: slug },
            { slug },
        );
    }

    /**
     * Replay-aware spendable pool for a page (the shop wallet's "earned"). Unlike
     * globalTotals (best-only), this credits the whole play history with
     * diminishing returns, per game:
     *  - the best debut (first play of a visitor) anchors at 100% — so the five
     *    games cap the skill pool at ~5000;
     *  - every other distinct visitor's debut credits NEW_BASE × NEW_DECAY^j;
     *  - every replay by a known visitor credits SAME_BASE × SAME_DECAY^(r-1).
     * Visitors are coalesced by visitorId OR ip, so clearing localStorage yields
     * the lower replay rate rather than a fresh full-rate debut. Returns the
     * rounded pool total, 0 on failure.
     */
    static earnedTotals(slug: string): number {
        try {
            const db = this.getDb();
            if (!db) return 0;

            const rows = db
                .query(
                    `SELECT gameId, visitorId, ip, score, createdAt FROM scores
                     WHERE slug = $slug ORDER BY gameId, createdAt ASC;`,
                )
                .all({ $slug: slug }) as {
                gameId: string;
                visitorId: string;
                ip: string;
                score: number;
                createdAt: number;
            }[];

            const SAME_BASE = 0.15;
            const SAME_DECAY = 0.8;
            const NEW_BASE = 0.4;
            const NEW_DECAY = 0.92;
            /* How many distinct visitor ids per ip may earn the full new-visitor
               rate before extras coalesce to the replay rate. Generous enough that
               a household / small group behind one NAT or CGNAT address all count
               as new, while still bounding localStorage-wipe farming from one ip. */
            const MAX_NEW_PER_IP = 8;

            /* Bucket rows per game, preserving the createdAt ASC order. */
            const byGame = new Map<string, typeof rows>();
            for (const r of rows) {
                const list = byGame.get(r.gameId);
                if (list) list.push(r);
                else byGame.set(r.gameId, [r]);
            }

            let total = 0;
            for (const grows of byGame.values()) {
                /* A player is identified by their visitorId, with their ip as a
                   secondary key so wiping localStorage doesn't mint a fresh debut.
                   To avoid punishing real distinct guests behind one shared/CGNAT
                   ip, the first MAX_NEW_PER_IP ids on an ip still count as debuts;
                   only beyond that do same-ip ids coalesce to the replay rate. */
                const byVid = new Map<string, { replays: number }>();
                const byIp = new Map<string, { replays: number }>();
                const ipNew = new Map<string, number>();
                const firstPlays: number[] = [];
                let replayCredit = 0;

                for (const r of grows) {
                    const s = Math.max(0, Math.min(1000, r.score));
                    const ip = r.ip || "";

                    /* A known id is always a replay; an unseen id on a known ip is
                       a replay only once that ip has spent its new-visitor budget. */
                    let player = byVid.get(r.visitorId);
                    if (!player && ip) {
                        const primary = byIp.get(ip);
                        if (primary && (ipNew.get(ip) ?? 0) >= MAX_NEW_PER_IP) player = primary;
                    }

                    if (!player) {
                        /* A debut → feeds the page's new-visitor stream. */
                        player = { replays: 0 };
                        byVid.set(r.visitorId, player);
                        if (ip) {
                            if (!byIp.has(ip)) byIp.set(ip, player);
                            ipNew.set(ip, (ipNew.get(ip) ?? 0) + 1);
                        }
                        firstPlays.push(s);
                    } else {
                        /* A return play by a known visitor → decaying replay. */
                        player.replays += 1;
                        replayCredit += s * SAME_BASE * SAME_DECAY ** (player.replays - 1);
                        if (!byVid.has(r.visitorId)) byVid.set(r.visitorId, player);
                    }
                }

                /* Best debut anchors at 100%; the remaining debuts are decaying
                   new-visitor credits in chronological order. */
                let anchor = 0;
                let anchorIdx = -1;
                for (let i = 0; i < firstPlays.length; i++) {
                    if (firstPlays[i]! > anchor) {
                        anchor = firstPlays[i]!;
                        anchorIdx = i;
                    }
                }
                let newCredit = 0;
                let j = 0;
                for (let i = 0; i < firstPlays.length; i++) {
                    if (i === anchorIdx) continue;
                    newCredit += firstPlays[i]! * NEW_BASE * NEW_DECAY ** j;
                    j += 1;
                }
                total += anchor + newCredit + replayCredit;
            }

            return Math.round(total);
        } catch (error) {
            Logger.error("ScoreRepository", `earnedTotals failed: ${error}`, { slug });
            return 0;
        }
    }

    /* Shared aggregation: best-per-game rows → { total, games }. */
    private static aggregate(
        sql: string,
        params: Record<string, string>,
        logCtx: Record<string, unknown>,
    ): Totals {
        try {
            const db = this.getDb();
            if (!db) return { total: 0, games: [] };
            const rows = db.query(sql).all(params) as { gameId: string; best: number }[];
            const games = rows.map((r) => ({ gameId: r.gameId, best: r.best ?? 0 }));
            const total = games.reduce((sum, g) => sum + Math.max(0, g.best), 0);
            return { total, games };
        } catch (error) {
            Logger.error("ScoreRepository", `aggregate failed: ${error}`, logCtx);
            return { total: 0, games: [] };
        }
    }

    /** Delete every score row for a slug (page deletion). Returns rows removed. */
    static deleteSlug(slug: string): number {
        try {
            const db = this.getDb();
            if (!db) return 0;
            return db.query("DELETE FROM scores WHERE slug = $slug;").run({ $slug: slug }).changes;
        } catch (error) {
            Logger.error("ScoreRepository", `deleteSlug failed: ${error}`, { slug });
            return 0;
        }
    }

    /** Top N scores for a (slug, gameId), highest first. */
    static topScores(slug: string, gameId: string, limit = 10): ScoreRow[] {
        try {
            const db = this.getDb();
            if (!db) return [];
            const take = Math.max(1, Math.min(100, Math.trunc(limit)));
            return db
                .query(
                    `SELECT id, slug, visitorId, gameId, score, durationMs, ip, createdAt
                     FROM scores WHERE slug = $slug AND gameId = $gameId
                     ORDER BY score DESC, createdAt ASC LIMIT $limit;`,
                )
                .all({ $slug: slug, $gameId: gameId, $limit: take }) as ScoreRow[];
        } catch (error) {
            Logger.error("ScoreRepository", `topScores failed: ${error}`, { slug, gameId });
            return [];
        }
    }
}

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

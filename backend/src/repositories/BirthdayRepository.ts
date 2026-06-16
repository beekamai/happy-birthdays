import { Database } from "bun:sqlite";

import { BIRTHDAYS_DB_PATH } from "../config/constants";
import type { PublicFriend } from "../models/Friend";
import Logger from "../utils/Logger";

/* A persisted birthday row — the queryable index of "who's birthday is when".
   The friend configs (data/friends/<slug>/config.json) remain the source of
   truth for page content; this table is rebuilt from them on every boot, so it
   can never drift, and lets us answer "whose birthday is coming up" with SQL. */
export interface BirthdayRow {
    slug: string;
    displayName: string;
    username: string;
    month: number;
    day: number;
    year: number | null;
    updatedAt: number;
}

/** Days from today (local) until the next occurrence of month/day. 0 = today. */
function daysUntil(month: number, day: number): number {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (now.getMonth() + 1 === month && now.getDate() === day) return 0;
    let target = new Date(today.getFullYear(), month - 1, day);
    if (target.getTime() < today.getTime()) {
        target = new Date(today.getFullYear() + 1, month - 1, day);
    }
    return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Birthdays Data Access Layer (bun:sqlite). Static methods; upsert keyed by
 * slug. Rebuilt from friend configs on boot via syncFromFriends().
 */
export default class BirthdayRepository {
    private static db: Database | null = null;

    static init(): void {
        try {
            if (this.db) return;
            const db = new Database(BIRTHDAYS_DB_PATH, { create: true });
            db.exec("PRAGMA journal_mode = WAL;");
            db.exec(`
                CREATE TABLE IF NOT EXISTS birthdays (
                    slug TEXT PRIMARY KEY,
                    displayName TEXT NOT NULL,
                    username TEXT NOT NULL,
                    month INTEGER NOT NULL,
                    day INTEGER NOT NULL,
                    year INTEGER,
                    updatedAt INTEGER NOT NULL
                );
            `);
            this.db = db;
        } catch (error) {
            Logger.error("BirthdayRepository", `init failed: ${error}`);
        }
    }

    private static getDb(): Database | null {
        if (!this.db) this.init();
        return this.db;
    }

    /** Insert or update one birthday by slug. */
    static upsert(input: {
        slug: string;
        displayName: string;
        username: string;
        month: number;
        day: number;
        year?: number | null;
    }): void {
        try {
            const db = this.getDb();
            if (!db) return;
            db.query(
                `INSERT INTO birthdays (slug, displayName, username, month, day, year, updatedAt)
                 VALUES ($slug, $displayName, $username, $month, $day, $year, $updatedAt)
                 ON CONFLICT(slug) DO UPDATE SET
                   displayName = excluded.displayName,
                   username = excluded.username,
                   month = excluded.month,
                   day = excluded.day,
                   year = excluded.year,
                   updatedAt = excluded.updatedAt;`,
            ).run({
                $slug: input.slug,
                $displayName: input.displayName,
                $username: input.username,
                $month: input.month,
                $day: input.day,
                $year: input.year ?? null,
                $updatedAt: Date.now(),
            });
        } catch (error) {
            Logger.error("BirthdayRepository", `upsert failed: ${error}`, { slug: input.slug });
        }
    }

    /** Rebuild the table from the current friend configs (called on boot). */
    static syncFromFriends(friends: PublicFriend[]): void {
        for (const f of friends) {
            this.upsert({
                slug: f.slug,
                displayName: f.displayName,
                username: f.username,
                month: f.birthday.month,
                day: f.birthday.day,
                year: f.birthday.year ?? null,
            });
        }
    }

    /** Remove a birthday by slug (page deletion). */
    static deleteSlug(slug: string): void {
        try {
            const db = this.getDb();
            if (!db) return;
            db.query("DELETE FROM birthdays WHERE slug = $slug;").run({ $slug: slug });
        } catch (error) {
            Logger.error("BirthdayRepository", `deleteSlug failed: ${error}`, { slug });
        }
    }

    /** All birthdays, each annotated with daysUntil, sorted soonest-first. */
    static list(): (BirthdayRow & { daysUntil: number })[] {
        try {
            const db = this.getDb();
            if (!db) return [];
            const rows = db.query("SELECT * FROM birthdays;").all() as BirthdayRow[];
            return rows
                .map((r) => ({ ...r, daysUntil: daysUntil(r.month, r.day) }))
                .sort((a, b) => a.daysUntil - b.daysUntil);
        } catch (error) {
            Logger.error("BirthdayRepository", `list failed: ${error}`);
            return [];
        }
    }
}

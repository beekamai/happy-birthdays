import { Database } from "bun:sqlite";

import { HISTORY_DB_PATH } from "../config/constants";
import Logger from "../utils/Logger";

/* History DAL: gifts given to a friend, and profile changes (name / handle /
   avatar). Both are rebuilt/extended from friend configs on boot:
     - gifts are upserted by (slug, name) so re-syncing is idempotent.
     - profile changes are detected by diffing the config against a per-slug
       snapshot, appending a change row whenever a field differs. */

export interface GiftRow {
    id: number;
    slug: string;
    name: string;
    emoji: string;
    lottie: string;
    link: string;
    imagePath: string;
    createdAt: number;
}

export interface ChangeRow {
    id: number;
    slug: string;
    field: string;
    oldValue: string;
    newValue: string;
    createdAt: number;
}

export interface GiftInput {
    name: string;
    emoji?: string;
    lottie?: string;
    link?: string;
    imagePath?: string;
}

export default class HistoryRepository {
    private static db: Database | null = null;

    static init(): void {
        try {
            if (this.db) return;
            const db = new Database(HISTORY_DB_PATH, { create: true });
            db.exec("PRAGMA journal_mode = WAL;");
            db.exec(`
                CREATE TABLE IF NOT EXISTS gifts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    slug TEXT NOT NULL,
                    name TEXT NOT NULL,
                    emoji TEXT NOT NULL DEFAULT '',
                    lottie TEXT NOT NULL DEFAULT '',
                    link TEXT NOT NULL DEFAULT '',
                    imagePath TEXT NOT NULL DEFAULT '',
                    createdAt INTEGER NOT NULL,
                    UNIQUE(slug, name)
                );
            `);
            db.exec(`
                CREATE TABLE IF NOT EXISTS profile_changes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    slug TEXT NOT NULL,
                    field TEXT NOT NULL,
                    oldValue TEXT NOT NULL,
                    newValue TEXT NOT NULL,
                    createdAt INTEGER NOT NULL
                );
            `);
            db.exec(`
                CREATE TABLE IF NOT EXISTS profile_snapshot (
                    slug TEXT NOT NULL,
                    field TEXT NOT NULL,
                    value TEXT NOT NULL,
                    PRIMARY KEY (slug, field)
                );
            `);
            this.db = db;
        } catch (error) {
            Logger.error("HistoryRepository", `init failed: ${error}`);
        }
    }

    private static getDb(): Database | null {
        if (!this.db) this.init();
        return this.db;
    }

    /** Insert a gift into history (idempotent by slug+name). */
    static addGift(slug: string, gift: GiftInput): void {
        try {
            const db = this.getDb();
            if (!db || !gift?.name) return;
            db.query(
                `INSERT INTO gifts (slug, name, emoji, lottie, link, imagePath, createdAt)
                 VALUES ($slug, $name, $emoji, $lottie, $link, $imagePath, $createdAt)
                 ON CONFLICT(slug, name) DO UPDATE SET
                   emoji = excluded.emoji, lottie = excluded.lottie,
                   link = excluded.link, imagePath = excluded.imagePath;`,
            ).run({
                $slug: slug,
                $name: gift.name,
                $emoji: gift.emoji ?? "",
                $lottie: gift.lottie ?? "",
                $link: gift.link ?? "",
                $imagePath: gift.imagePath ?? "",
                $createdAt: Date.now(),
            });
        } catch (error) {
            Logger.error("HistoryRepository", `addGift failed: ${error}`, { slug });
        }
    }

    static listGifts(slug: string): GiftRow[] {
        try {
            const db = this.getDb();
            if (!db) return [];
            return db
                .query("SELECT * FROM gifts WHERE slug = $slug ORDER BY createdAt ASC, id ASC;")
                .all({ $slug: slug }) as GiftRow[];
        } catch (error) {
            Logger.error("HistoryRepository", `listGifts failed: ${error}`, { slug });
            return [];
        }
    }

    static listChanges(slug: string): ChangeRow[] {
        try {
            const db = this.getDb();
            if (!db) return [];
            return db
                .query("SELECT * FROM profile_changes WHERE slug = $slug ORDER BY createdAt ASC, id ASC;")
                .all({ $slug: slug }) as ChangeRow[];
        } catch (error) {
            Logger.error("HistoryRepository", `listChanges failed: ${error}`, { slug });
            return [];
        }
    }

    /* Diff one field against the snapshot; record a change + update snapshot. */
    private static diffField(slug: string, field: string, value: string): void {
        const db = this.getDb();
        if (!db) return;
        const prev = db
            .query("SELECT value FROM profile_snapshot WHERE slug = $slug AND field = $field;")
            .get({ $slug: slug, $field: field }) as { value: string } | null;

        if (prev === null) {
            /* First time we see this field — seed the snapshot, no change row. */
            db.query(
                "INSERT INTO profile_snapshot (slug, field, value) VALUES ($slug, $field, $value);",
            ).run({ $slug: slug, $field: field, $value: value });
            return;
        }
        if (prev.value === value) return;

        db.query(
            `INSERT INTO profile_changes (slug, field, oldValue, newValue, createdAt)
             VALUES ($slug, $field, $old, $new, $createdAt);`,
        ).run({
            $slug: slug,
            $field: field,
            $old: prev.value,
            $new: value,
            $createdAt: Date.now(),
        });
        db.query(
            "UPDATE profile_snapshot SET value = $value WHERE slug = $slug AND field = $field;",
        ).run({ $slug: slug, $field: field, $value: value });
    }

    /** Detect & record name / handle / avatar changes for a friend. */
    static syncProfile(
        slug: string,
        profile: { displayName: string; username: string; avatar: string },
    ): void {
        try {
            this.diffField(slug, "displayName", profile.displayName);
            this.diffField(slug, "username", profile.username);
            this.diffField(slug, "avatar", profile.avatar);
        } catch (error) {
            Logger.error("HistoryRepository", `syncProfile failed: ${error}`, { slug });
        }
    }

    /** Fold the current gift + giftHistory into the gifts table. */
    static syncGifts(slug: string, gifts: GiftInput[]): void {
        for (const g of gifts) {
            if (g?.name) this.addGift(slug, g);
        }
    }
}

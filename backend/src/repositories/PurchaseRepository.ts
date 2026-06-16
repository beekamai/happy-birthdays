import { Database } from "bun:sqlite";

import { SHOP_DB_PATH } from "../config/constants";
import Logger from "../utils/Logger";

/* Ledger of shop purchases — the record of which decorations a friend OWNS.
   Ownership is permanent (one row per slug+item, enforced by a unique index);
   equipping an owned item is a separate concern stored in the friend config.
   A friend's spendable balance = page-wide score total − SUM(cost) here. */
export default class PurchaseRepository {
    private static db: Database | null = null;

    /** Open the DB (WAL) and ensure the schema. Idempotent. */
    static init(): void {
        try {
            if (this.db) return;
            const db = new Database(SHOP_DB_PATH, { create: true });
            db.exec("PRAGMA journal_mode = WAL;");
            db.exec(`
                CREATE TABLE IF NOT EXISTS purchases (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    slug TEXT NOT NULL,
                    itemId TEXT NOT NULL,
                    cost INTEGER NOT NULL,
                    createdAt INTEGER NOT NULL,
                    UNIQUE(slug, itemId)
                );
            `);
            this.db = db;
            Logger.info("PurchaseRepository", "shop DB ready");
        } catch (error) {
            Logger.error("PurchaseRepository", `init failed: ${error}`);
        }
    }

    /** Record a purchase. Returns false if the item is already owned / on error. */
    static record(slug: string, itemId: string, cost: number): boolean {
        try {
            if (!this.db) return false;
            const res = this.db
                .query(
                    `INSERT OR IGNORE INTO purchases (slug, itemId, cost, createdAt)
                     VALUES ($slug, $itemId, $cost, $ts)`,
                )
                .run({ $slug: slug, $itemId: itemId, $cost: cost, $ts: Date.now() });
            return res.changes > 0;
        } catch (error) {
            Logger.error("PurchaseRepository", `record failed: ${error}`, { slug, itemId });
            return false;
        }
    }

    /** Remove a purchase (refund). Returns true if a row was deleted. */
    static remove(slug: string, itemId: string): boolean {
        try {
            if (!this.db) return false;
            const res = this.db
                .query(`DELETE FROM purchases WHERE slug = $slug AND itemId = $itemId`)
                .run({ $slug: slug, $itemId: itemId });
            return res.changes > 0;
        } catch (error) {
            Logger.error("PurchaseRepository", `remove failed: ${error}`, { slug, itemId });
            return false;
        }
    }

    /** All item ids the friend owns. */
    static ownedIds(slug: string): string[] {
        try {
            if (!this.db) return [];
            const rows = this.db
                .query<{ itemId: string }, { $slug: string }>(
                    `SELECT itemId FROM purchases WHERE slug = $slug`,
                )
                .all({ $slug: slug });
            return rows.map((r) => r.itemId);
        } catch (error) {
            Logger.error("PurchaseRepository", `ownedIds failed: ${error}`, { slug });
            return [];
        }
    }

    /** Whether the friend already owns a given item. */
    static owns(slug: string, itemId: string): boolean {
        try {
            if (!this.db) return false;
            const row = this.db
                .query<{ n: number }, { $slug: string; $itemId: string }>(
                    `SELECT COUNT(*) AS n FROM purchases WHERE slug = $slug AND itemId = $itemId`,
                )
                .get({ $slug: slug, $itemId: itemId });
            return (row?.n ?? 0) > 0;
        } catch (error) {
            Logger.error("PurchaseRepository", `owns failed: ${error}`, { slug, itemId });
            return false;
        }
    }

    /** Total points spent by the friend across all purchases. */
    static totalSpent(slug: string): number {
        try {
            if (!this.db) return 0;
            const row = this.db
                .query<{ spent: number }, { $slug: string }>(
                    `SELECT COALESCE(SUM(cost), 0) AS spent FROM purchases WHERE slug = $slug`,
                )
                .get({ $slug: slug });
            return row?.spent ?? 0;
        } catch (error) {
            Logger.error("PurchaseRepository", `totalSpent failed: ${error}`, { slug });
            return 0;
        }
    }
}

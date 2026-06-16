import fs from "node:fs";

import { DATA_DIR } from "../config/constants";
import { assertInside } from "../utils/paths";
import Logger from "../utils/Logger";

/*
 * The owner's preferred dashboard ordering, persisted as a flat list of slugs in
 * data/page-order.json. It's a display hint only — slugs missing from the list
 * (newly created pages) simply fall to the end, and deleted slugs are pruned.
 * Every method degrades to a safe default and never throws to callers.
 */
export default class PageOrderRepository {
    /** The on-disk order file, guarded inside DATA_DIR. */
    private static file(): string {
        return assertInside(DATA_DIR, "page-order.json");
    }

    /** Read the saved order, or [] when absent / unreadable / malformed. */
    static getOrder(): string[] {
        try {
            const file = this.file();
            if (!fs.existsSync(file)) return [];
            const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
            if (!Array.isArray(raw)) return [];
            return raw.filter((s): s is string => typeof s === "string");
        } catch (error) {
            Logger.error("PageOrderRepository", `getOrder failed: ${error}`);
            return [];
        }
    }

    /** Persist a new order (string slugs only). Best-effort. */
    static setOrder(order: string[]): void {
        try {
            const clean = Array.isArray(order)
                ? order.filter((s): s is string => typeof s === "string")
                : [];
            fs.writeFileSync(this.file(), JSON.stringify(clean, null, 2) + "\n", "utf-8");
        } catch (error) {
            Logger.error("PageOrderRepository", `setOrder failed: ${error}`);
        }
    }

    /** Drop a slug from the saved order (called when a page is deleted). */
    static removeSlug(slug: string): void {
        const order = this.getOrder();
        if (!order.includes(slug)) return;
        this.setOrder(order.filter((s) => s !== slug));
    }
}

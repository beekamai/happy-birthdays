import fs from "node:fs";
import path from "node:path";

import { TWEMOJI_DIR } from "../config/constants";

/* Variation selector codepoint that Twemoji filenames usually drop. */
const VARIATION_SELECTOR_16 = 0xfe0f;

/* Resolved data-URI cache, keyed by the source emoji string. null = misses. */
const cache = new Map<string, string | null>();

/* Codepoints of an emoji string as lowercase hex, no separators stripped. */
function codePoints(emoji: string): number[] {
    const points: number[] = [];
    for (const ch of emoji) {
        const cp = ch.codePointAt(0);
        if (cp !== undefined) points.push(cp);
    }
    return points;
}

function hexJoin(points: number[]): string {
    return points.map((p) => p.toString(16)).join("-");
}

/* Read a twemoji svg by filename stem; return a base64 data-URI or null. */
function readSvgDataUri(stem: string): string | null {
    try {
        const file = path.join(TWEMOJI_DIR, `${stem}.svg`);
        if (!fs.existsSync(file)) return null;
        const buf = fs.readFileSync(file);
        return `data:image/svg+xml;base64,${buf.toString("base64")}`;
    } catch {
        return null;
    }
}

/**
 * Map an emoji character to a base64-encoded SVG data-URI from the bundled
 * Twemoji set. Tries the full codepoint sequence, then the sequence with the
 * FE0F variation selector stripped, then the first codepoint alone. Returns
 * null when no matching asset exists. Results (including misses) are cached.
 */
export function emojiToDataUri(emoji: string): string | null {
    if (cache.has(emoji)) return cache.get(emoji)!;

    const points = codePoints(emoji);
    let result: string | null = null;

    if (points.length > 0) {
        const candidates: string[] = [];

        /* Full sequence as-is. */
        candidates.push(hexJoin(points));

        /* Sequence without the FE0F variation selector. */
        const stripped = points.filter((p) => p !== VARIATION_SELECTOR_16);
        if (stripped.length !== points.length && stripped.length > 0) {
            candidates.push(hexJoin(stripped));
        }

        /* First codepoint only. */
        candidates.push(points[0]!.toString(16));

        for (const stem of candidates) {
            result = readSvgDataUri(stem);
            if (result) break;
        }
    }

    cache.set(emoji, result);
    return result;
}

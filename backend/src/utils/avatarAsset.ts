import fs from "node:fs";
import path from "node:path";

/* Image extension -> MIME type for inlining avatars into satori nodes. */
const MIME_BY_EXT: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
};

/**
 * Read an image file and encode it as a base64 data-URI suitable for satori's
 * `<img src>`. Returns null on any failure or unknown extension.
 */
export function readAvatarDataUri(absPath: string): string | null {
    try {
        const ext = path.extname(absPath).toLowerCase();
        const mime = MIME_BY_EXT[ext];
        if (!mime) return null;
        if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) return null;

        const buf = fs.readFileSync(absPath);
        return `data:${mime};base64,${buf.toString("base64")}`;
    } catch {
        return null;
    }
}

/** Modification time in epoch ms, or 0 when the file cannot be stat-ed. */
export function fileMtimeMs(absPath: string): number {
    try {
        return fs.statSync(absPath).mtimeMs;
    } catch {
        return 0;
    }
}

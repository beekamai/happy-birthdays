import path from "node:path";

/**
 * Resolve `target` (absolute or relative to `baseDir`) and assert it stays
 * inside `baseDir`. Throws on any path-traversal escape. Returns the resolved
 * absolute path on success.
 */
export function assertInside(baseDir: string, target: string): string {
    const base = path.resolve(baseDir);
    const resolved = path.resolve(base, target);

    const rel = path.relative(base, resolved);
    /* Escapes when rel starts with ".." or is an absolute path on another root. */
    if (rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel)) {
        throw new Error(`Path escapes base directory: ${target}`);
    }
    return resolved;
}

/**
 * Join one or more user-supplied segments onto `base` and assert the result
 * stays inside `base`. Each segment must be a plain name — segments containing
 * path separators or ".." are rejected outright before resolution.
 */
export function safeJoin(base: string, ...segments: string[]): string {
    for (const seg of segments) {
        if (
            seg.includes("..") ||
            seg.includes("/") ||
            seg.includes("\\") ||
            path.isAbsolute(seg)
        ) {
            throw new Error(`Unsafe path segment: ${seg}`);
        }
    }
    return assertInside(base, path.join(...segments));
}

/**
 * SHA-256 of `input`, hex-encoded and truncated to 12 chars.
 * Used for short cache keys (e.g. OG image filenames). Not for security.
 */
export function shortHash(input: string): string {
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(input);
    return hasher.digest("hex").slice(0, 12);
}

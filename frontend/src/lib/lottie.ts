/* Shared Lottie helpers. */

/**
 * A parsed Lottie document has a `layers` array. Anything else (e.g. a 404 JSON
 * error body) is rejected so it never reaches the animator.
 */
export function isLottie(json: unknown): boolean {
  return (
    typeof json === "object" &&
    json !== null &&
    Array.isArray((json as { layers?: unknown }).layers)
  );
}

import { gunzipSync } from "node:zlib";

/* A Telegram .tgs sticker is just gzip-compressed Lottie JSON, so decoding it
   needs no rendering engine — gunzip when the gzip magic bytes are present,
   otherwise treat the upload as raw Lottie/JSON. The result is validated as a
   Lottie document (an object carrying a `layers` array, mirroring the frontend's
   isLottie check in GiftCard.tsx) and re-serialised to canonical JSON so what we
   store is always a plain .json the page can fetch directly. */

const MAX_DECOMPRESSED = 4 * 1024 * 1024; /* 4 MB ceiling on the decoded JSON */

/**
 * Decode a .tgs/.json/.lottie upload into canonical Lottie JSON.
 * @returns the canonical JSON bytes (to store) plus the parsed object (to preview).
 * @throws if the input is not gzip/JSON, is oversized, or is not a Lottie doc.
 */
export function decodeGiftAnimation(input: Uint8Array): {
    data: Buffer;
    animation: object;
} {
    const buf = Buffer.from(input);
    /* gzip magic 0x1f 0x8b → a .tgs; otherwise assume a raw Lottie .json.
       maxOutputLength caps decompression so a gzip bomb can't blow up memory
       before the size check below. */
    const json =
        buf[0] === 0x1f && buf[1] === 0x8b
            ? gunzipSync(buf, { maxOutputLength: MAX_DECOMPRESSED })
            : buf;
    if (json.byteLength > MAX_DECOMPRESSED) throw new Error("Animation too large");

    const obj = JSON.parse(json.toString("utf8"));
    if (
        typeof obj !== "object" ||
        obj === null ||
        !Array.isArray((obj as { layers?: unknown }).layers)
    ) {
        throw new Error("Not a Lottie animation");
    }

    return { data: Buffer.from(JSON.stringify(obj)), animation: obj as object };
}

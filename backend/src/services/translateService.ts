import { GEMINI_API_KEY, GEMINI_MODEL } from "../config/constants";
import Logger from "../utils/Logger";

/* Auto-translation of user-authored friend content (display name, greeting,
   gift name) between Russian and English via the Gemini API. Designed to fail
   soft: any error — missing key, network, bad JSON — resolves to null so callers
   simply keep the existing translations rather than blocking a save. */

export type Lang = "ru" | "en";

const LANG_NAME: Record<Lang, string> = { ru: "Russian", en: "English" };

export interface TranslatableContent {
    displayName?: string;
    message?: string;
    giftName?: string;
}

/**
 * Translate the provided non-empty fields from `from` to `to` using Gemini.
 * Returns an object holding only the fields that were translated, or null on
 * any failure / when no API key is configured. Temperature 0 + an explicit
 * field-by-field prompt keep it from hallucinating unrelated content.
 */
export async function translateContent(
    fields: TranslatableContent,
    from: Lang,
    to: Lang,
): Promise<TranslatableContent | null> {
    if (!GEMINI_API_KEY || from === to) return null;

    const entries = (
        Object.entries(fields) as [keyof TranslatableContent, string | undefined][]
    ).filter(([, v]) => typeof v === "string" && v.trim().length > 0);
    if (entries.length === 0) return null;

    const lines = entries.map(([k, v]) => `${k}: ${v}`).join("\n");
    const properties: Record<string, { type: "string" }> = {};
    for (const [k] of entries) properties[k] = { type: "string" };

    const reqBody = {
        system_instruction: {
            parts: [
                {
                    text:
                        "You translate content for a cozy birthday-greeting website. " +
                        `Translate ONLY the text the user provides, field by field, from ${LANG_NAME[from]} to ${LANG_NAME[to]}. ` +
                        "Never invent, add, or replace content with anything of your own. " +
                        "Preserve emoji, warmth and tone. Transliterate personal/display names naturally. " +
                        "Output strictly a JSON object with the same keys, values translated.",
                },
            ],
        },
        contents: [
            {
                role: "user",
                parts: [
                    {
                        text: `Translate the VALUES of these fields from ${LANG_NAME[from]} to ${LANG_NAME[to]}:\n\n${lines}`,
                    },
                ],
            },
        ],
        generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: {
                type: "object",
                properties,
                required: Object.keys(properties),
            },
        },
    };

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reqBody),
            signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) {
            Logger.warn("Translate", `Gemini responded ${res.status}`);
            return null;
        }

        const data = (await res.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text !== "string") return null;

        const parsed = JSON.parse(text) as Record<string, unknown>;
        if (typeof parsed !== "object" || parsed === null) return null;

        const out: TranslatableContent = {};
        for (const [k] of entries) {
            if (typeof parsed[k] === "string") out[k] = parsed[k] as string;
        }
        return Object.keys(out).length > 0 ? out : null;
    } catch (error) {
        Logger.warn("Translate", `translateContent failed: ${error}`);
        return null;
    }
}

import Logger from "../utils/Logger";

/**
 * Centralized Elysia onError handler. Maps framework error codes to HTTP
 * statuses and always returns a JSON `{ error: string }` body. Page-level 404
 * HTML is handled elsewhere — this is the API/JSON path only.
 */
export function ErrorHandler({ code, error, set, ...ctx }: any) {
    if (code === "VALIDATION") {
        set.status = 422;
        /* Surface the first field-level reason (which input + why) instead of a
           generic message. Elysia's ValidationError carries `.all` (per-field
           issues with a clean `summary`) and `.type` (body|query|params). Fall
           back defensively so the handler itself never throws. */
        const first = Array.isArray(error?.all)
            ? error.all.find((e: any) => e?.summary || e?.message)
            : undefined;
        const where = typeof error?.type === "string" ? error.type : undefined;
        const raw =
            first?.summary ||
            first?.message ||
            (typeof error?.message === "string" ? error.message.split("\n")[0] : "");
        const detail = (raw || "Validation error").slice(0, 200);
        return { error: where ? `${where}: ${detail}` : detail };
    }

    if (code === "PARSE") {
        set.status = 400;
        return { error: "JSON parsing error" };
    }

    if (code === "NOT_FOUND") {
        set.status = 404;
        return { error: error?.message || "Not found" };
    }

    const message = error instanceof Error ? error.message : String(error);
    Logger.error("ErrorHandler", `Unhandled: ${message}`, {
        url: ctx?.request ? `[${ctx.request.method}] ${ctx.request.url}` : undefined,
    });
    set.status = 500;
    return { error: "Internal server error" };
}

import Logger from "../utils/Logger";

/**
 * Centralized Elysia onError handler. Maps framework error codes to HTTP
 * statuses and always returns a JSON `{ error: string }` body. Page-level 404
 * HTML is handled elsewhere — this is the API/JSON path only.
 */
export function ErrorHandler({ code, error, set, ...ctx }: any) {
    if (code === "VALIDATION") {
        set.status = 422;
        return { error: "Validation error" };
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

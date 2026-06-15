type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

/* ANSI colours per level for readable terminal output. */
const COLORS: Record<LogLevel, string> = {
    INFO: "\x1b[36m",
    WARN: "\x1b[33m",
    ERROR: "\x1b[31m",
    DEBUG: "\x1b[90m",
};
const RESET = "\x1b[0m";

function emit(
    level: LogLevel,
    tag: string,
    message: string,
    data?: Record<string, unknown>,
): void {
    const ts = new Date().toISOString();
    const color = COLORS[level];
    const head = `${color}[${ts}] [${level}] [${tag}]${RESET} ${message}`;

    if (level === "ERROR") {
        if (data) console.error(head, data);
        else console.error(head);
        return;
    }
    if (level === "WARN") {
        if (data) console.warn(head, data);
        else console.warn(head);
        return;
    }
    if (data) console.log(head, data);
    else console.log(head);
}

/**
 * Structured, timestamped logger. Category (tag) is the class or module name.
 * Usage: Logger.error("FriendRepository", "read failed", { slug }).
 */
const Logger = {
    info: (tag: string, message: string, data?: Record<string, unknown>): void =>
        emit("INFO", tag, message, data),
    warn: (tag: string, message: string, data?: Record<string, unknown>): void =>
        emit("WARN", tag, message, data),
    error: (tag: string, message: string, data?: Record<string, unknown>): void =>
        emit("ERROR", tag, message, data),
    debug: (tag: string, message: string, data?: Record<string, unknown>): void =>
        emit("DEBUG", tag, message, data),
};

export default Logger;

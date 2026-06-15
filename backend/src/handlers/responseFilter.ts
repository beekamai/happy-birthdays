/*
 * Light response filtering keyed off the 200 response schema. Strips any
 * top-level fields that the schema does not declare, preventing accidental
 * data leaks. Dependency-free: reads `.properties` straight off the TypeBox
 * Object schema. Non-object 200 schemas (or missing schema) pass through
 * untouched.
 */

interface SchemaWithResponse {
    response?: Record<string | number, any>;
    afterHandle?: ((ctx: any) => any)[];
    [key: string]: any;
}

/* Pull declared top-level field names from a TypeBox Object schema. */
function schemaKeys(schema: any): string[] | null {
    if (schema && typeof schema === "object" && schema.properties) {
        return Object.keys(schema.properties);
    }
    return null;
}

/* Keep only `keys` from a plain object. Arrays / primitives pass through. */
function pick(value: any, keys: string[]): any {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return value;
    }
    const out: Record<string, unknown> = {};
    for (const key of keys) {
        if (key in value) out[key] = value[key];
    }
    return out;
}

/**
 * Wrap an Elysia route schema so the response is filtered to the fields the
 * 200 schema declares. Forwards the full response map to Elysia for Swagger.
 */
export function withResponseFilter<T extends SchemaWithResponse>(schema: T): any {
    const { response, ...rest } = schema;
    const originalAfterHandle = schema.afterHandle ?? [];
    const keys = response ? schemaKeys((response as any)[200]) : null;

    const filter = (ctx: any) => {
        if (!keys) return ctx.response;
        /* Only filter successful (2xx) responses; errors keep their { error } shape. */
        const status = ctx.set?.status;
        if (typeof status === "number" && status >= 300) return ctx.response;
        return pick(ctx.response, keys);
    };

    return {
        ...rest,
        response,
        afterHandle: [...originalAfterHandle, filter],
    };
}

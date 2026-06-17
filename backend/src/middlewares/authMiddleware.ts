import { readUser } from "../controllers/authController";

/* Auth lifecycle for protected route groups. `authDerive` runs per request and
   puts the resolved session user (or null) into context; the guards short-circuit
   before the handler, so the 401/403 gate is declared in the route file rather
   than re-implemented in every controller. Each protected route file calls
   `.derive(authDerive)` on its OWN instance before `.guard(...)` — keeping the
   derive in the same instance as the guard sidesteps Elysia's cross-plugin scope
   encapsulation (an app-level derive may not reach a `.use()`-mounted child).
   Per-resource checks (a friend editing their OWN page) stay in the controller
   via canEdit — they depend on the target config, not just the session. */

/** Resolve the session user into context. Never throws — yields { user } | { user: null }. */
export const authDerive = async ({ jwt, cookie }: any) => {
    return { user: await readUser(jwt, cookie) };
};

/** Require a logged-in session; 401 otherwise. Stack FIRST in beforeHandle. */
export const authMiddleware = ({ user, set }: any) => {
    if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
    }
};

/** Require the page owner; 403 otherwise. Stack AFTER authMiddleware. */
export const ownerMiddleware = ({ user, set }: any) => {
    if (!user?.isOwner) {
        set.status = 403;
        return { error: "Owner only" };
    }
};

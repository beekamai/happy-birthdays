/* Authenticated user derived from the session JWT (set after Telegram login). */
export interface AuthUser {
    tgId: string;
    username: string; /* Telegram @username, lowercased, no leading @ */
    firstName?: string;
    photoUrl?: string;
    /* True when the username matches OWNER_TG_USERNAME — can manage all pages. */
    isOwner: boolean;
}

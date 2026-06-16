/* Typed fetch wrappers for the admin + auth API. Everything is same-origin, so
   the browser sends the httpOnly session cookie automatically — we never set
   `mode: "cors"` (that would strip the cookie). Reads return `null` on
   404/403/network error; writes throw an `ApiError` carrying the status + a
   friendly message so callers can surface a toast. */

/* ---- Types (mirror the backend payloads) --------------------------------- */

export interface AuthUser {
  tgId: number;
  username?: string;
  firstName?: string;
  photoUrl?: string;
  isOwner: boolean;
}

export interface AuthConfig {
  botUsername: string;
  enabled: boolean;
}

/** Telegram Login Widget user object, posted verbatim to the backend. */
export interface TelegramAuthData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/** Summary row in the owner's page list. */
export interface AdminFriendSummary {
  slug: string;
  displayName: string;
  username: string;
  birthday: { month: number; day: number; year?: number };
  state: "open" | "closing" | "locked";
  avatarUrl: string;
}

/** A single gift entry (current gift or a history item). */
export interface GiftConfig {
  name: string;
  emoji?: string;
  lottie?: string;
  link?: string;
  imagePath?: string;
  date?: string;
}

/** The on-disk friend config shape — the full editable contract. */
export interface FriendConfig {
  username: string;
  displayName: string;
  birthday: string; /* "MM-DD" | "YYYY-MM-DD" */
  message: string;
  accent?: string;
  gift?: GiftConfig;
  giftHistory?: GiftConfig[];
  games: { gameId: string }[];
  avatar: string;
  puzzleAvatar?: string;
  gamesEnabled?: boolean;
  giftDisplay?: "current" | "all";
  giftLayout?: "list" | "blocks";
  lang?: "ru" | "en";
  theme?: "light" | "dark" | "halloween" | "newyear";
  bio?: string;
  socials?: { platform: string; url: string }[];
  translations?: Partial<
    Record<"ru" | "en", { displayName?: string; message?: string; giftName?: string; bio?: string }>
  >;
}

/** Subset a non-owner friend may PUT for their own page. */
export interface FriendLimitedUpdate {
  displayName?: string;
  birthday?: string;
  accent?: string;
  gamesEnabled?: boolean;
  giftDisplay?: "current" | "all";
  giftLayout?: "list" | "blocks";
  lang?: "ru" | "en";
  theme?: "light" | "dark" | "halloween" | "newyear";
  bio?: string;
  socials?: { platform: string; url: string }[];
  translations?: Partial<
    Record<"ru" | "en", { displayName?: string; message?: string; giftName?: string; bio?: string }>
  >;
}

export interface AvatarUploadResult {
  ok: boolean;
  filename: string;
  url: string;
}

/* ---- Slug helper --------------------------------------------------------- */

/** Derive a URL slug from a username: strip @, lowercase, keep [a-z0-9-]. The
    backend uses the same rule, so probing by derived slug matches the page. */
export function deriveSlug(username: string): string {
  return username
    .trim()
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

/* ---- Error helper -------------------------------------------------------- */

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Pull a human message out of an error JSON body, falling back to status. */
async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    return body.error ?? body.message ?? `Ошибка ${res.status}`;
  } catch {
    return `Ошибка ${res.status}`;
  }
}

/* ---- Auth ---------------------------------------------------------------- */

/** Public auth config (bot username + whether login is enabled). */
export async function fetchAuthConfig(): Promise<AuthConfig | null> {
  try {
    const res = await fetch("/api/auth/config");
    if (!res.ok) return null;
    return (await res.json()) as AuthConfig;
  } catch {
    return null;
  }
}

/** The current session user, or `null` if not logged in / on error. */
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return null;
    const body = (await res.json()) as { user: AuthUser | null };
    return body.user ?? null;
  } catch {
    return null;
  }
}

/**
 * Exchange a Telegram widget user object for a session cookie.
 * @throws {ApiError} on a non-2xx response.
 */
export async function loginWithTelegram(
  data: TelegramAuthData,
): Promise<AuthUser> {
  const res = await fetch("/api/auth/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new ApiError(res.status, await readError(res));
  const body = (await res.json()) as { ok: boolean; user: AuthUser };
  return body.user;
}

/** Clear the session cookie. Best-effort; never throws. */
export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    /* ignore — the UI refreshes regardless */
  }
}

/* ---- Admin: friends ------------------------------------------------------ */

/** All friend pages (owner only). Returns `[]` on 403/error. */
export async function fetchAdminFriends(): Promise<AdminFriendSummary[]> {
  try {
    const res = await fetch("/api/admin/friends");
    if (!res.ok) return [];
    const body = (await res.json()) as { friends: AdminFriendSummary[] };
    return body.friends ?? [];
  } catch {
    return [];
  }
}

/** A page the current user may edit (their own, matched by handle). */
export interface MyPage {
  slug: string;
  displayName: string;
  username: string;
  avatarUrl: string;
}

/** Pages the logged-in user may edit (matched by handle, not slug). `[]` on error. */
export async function fetchMyPages(): Promise<MyPage[]> {
  try {
    const res = await fetch("/api/admin/mine");
    if (!res.ok) return [];
    const body = (await res.json()) as { pages: MyPage[] };
    return body.pages ?? [];
  } catch {
    return [];
  }
}

export interface AdminFriendDetail {
  slug: string;
  config: FriendConfig;
  isOwner: boolean;
}

/**
 * Fetch one friend's editable config. Returns `null` on 403/404/error so the
 * caller can distinguish "no editable page" from a thrown failure.
 */
export async function fetchAdminFriend(
  slug: string,
): Promise<AdminFriendDetail | null> {
  try {
    const res = await fetch(`/api/admin/friend/${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    return (await res.json()) as AdminFriendDetail;
  } catch {
    return null;
  }
}

export interface SaveFriendResult {
  ok: boolean;
  slug?: string;
  friend?: AdminFriendSummary;
}

/**
 * Save an existing friend. Owners send the full config, friends a subset.
 * @throws {ApiError} on failure.
 */
export async function updateFriend(
  slug: string,
  body: FriendConfig | FriendLimitedUpdate,
): Promise<SaveFriendResult> {
  const res = await fetch(`/api/admin/friend/${encodeURIComponent(slug)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, await readError(res));
  return (await res.json()) as SaveFriendResult;
}

/**
 * Create a new friend page (owner only). Optional `slug` overrides the one
 * derived from `username`.
 * @throws {ApiError} on failure.
 */
export async function createFriend(
  config: FriendConfig,
  slug?: string,
): Promise<SaveFriendResult> {
  const res = await fetch("/api/admin/friends", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(slug ? { ...config, slug } : config),
  });
  if (!res.ok) throw new ApiError(res.status, await readError(res));
  return (await res.json()) as SaveFriendResult;
}

/**
 * Upload an avatar image for a friend page.
 * @param which "main" for the page avatar, "puzzle" for the puzzle variant.
 * @throws {ApiError} on failure.
 */
export async function uploadAvatar(
  slug: string,
  file: File,
  which: "main" | "puzzle",
): Promise<AvatarUploadResult> {
  const form = new FormData();
  form.append("avatar", file);
  form.append("which", which);
  const res = await fetch(
    `/api/admin/friend/${encodeURIComponent(slug)}/avatar`,
    { method: "POST", body: form },
  );
  if (!res.ok) throw new ApiError(res.status, await readError(res));
  return (await res.json()) as AvatarUploadResult;
}

/* ---- Admin: translation -------------------------------------------------- */

export interface TranslateFieldsPayload {
  from: "ru" | "en";
  to: "ru" | "en";
  displayName?: string;
  message?: string;
  giftName?: string;
  bio?: string;
}

export interface TranslatedFields {
  displayName?: string;
  message?: string;
  giftName?: string;
  bio?: string;
}

/**
 * Translate live form values via Gemini on the backend. Only the passed
 * non-empty fields come back translated. Returns `null` on a non-2xx response
 * (e.g. 502 when the provider is unavailable) so callers can surface a toast.
 */
export async function translateFields(
  payload: TranslateFieldsPayload,
): Promise<TranslatedFields | null> {
  try {
    const res = await fetch("/api/admin/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { ok: boolean; translations?: TranslatedFields };
    return body.translations ?? null;
  } catch {
    return null;
  }
}

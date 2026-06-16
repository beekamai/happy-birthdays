import type { Lang } from "./i18n.ts";
import type { FriendTranslations, PublicFriend } from "./types.ts";

/* Resolve a friend's user-authored content (name, greeting, gift name) for the
   visitor's active language. The authored fields live in `friend.lang`; the
   other language comes from `friend.translations`. A missing or blank variant
   falls back to the authored value, so content is never empty. */

function pick(
  friend: PublicFriend,
  lang: Lang,
  field: keyof FriendTranslations,
  authored: string,
): string {
  if (lang === friend.lang) return authored;
  const variant = friend.translations?.[lang]?.[field];
  return variant && variant.trim() ? variant : authored;
}

export function friendDisplayName(friend: PublicFriend, lang: Lang): string {
  return pick(friend, lang, "displayName", friend.displayName);
}

export function friendMessage(friend: PublicFriend, lang: Lang): string {
  return pick(friend, lang, "message", friend.message);
}

export function friendGiftName(friend: PublicFriend, lang: Lang): string {
  return pick(friend, lang, "giftName", friend.gift?.name ?? "");
}

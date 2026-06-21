import { useEffect, useMemo, useState } from "react";

import type { PublicFriend, SiteConfig } from "../lib/types.ts";
import { useT, initLang, setLangPreviewMode } from "../lib/i18n.ts";
import { setThemePreviewMode } from "../lib/useTheme.ts";
import { StickerCard } from "../components/decor/StickerCard.tsx";
import { FriendPage } from "../page/FriendPage.tsx";
import { LockedPage } from "../page/LockedPage.tsx";
import { ProfilePage } from "../page/ProfilePage.tsx";
import { lockedAccess, openAccess } from "./configToPublicFriend.ts";

/* Enable preview mode once, synchronously, the first time the host renders —
   before the previewed page's hooks run — so the page's useTheme/initLang ignore
   the owner's stored theme/lang override and resolve to the form values. Guarded
   at module scope so it never fires on a normal (non-preview) page load. */
let previewModeEnabled = false;

/* Renders inside the editor's preview <iframe> (App.tsx routes here when
   window.name === "hb-preview"). The parent posts the live form state as a
   { friend, site, view } message; the editor's view toggle picks WHICH page to
   show, and this host rebuilds the access window to match — so the owner can
   preview every state from one unsaved form. Theme/lang come from the
   form: preview mode (setThemePreviewMode/setLangPreviewMode) makes the page's
   useTheme/initLang ignore the owner's stored override WITHOUT writing it, so
   nothing leaks back into the editor chrome. */

type PreviewView = "open" | "locked" | "profile";

interface PreviewMessage {
  type: "hb-preview";
  friend: PublicFriend;
  site: SiteConfig | null;
  /* Which page to preview — driven by the editor's view toggle. */
  view: PreviewView;
}

function isPreviewMessage(data: unknown): data is PreviewMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === "hb-preview"
  );
}

export function PreviewHost() {
  if (!previewModeEnabled) {
    setThemePreviewMode(true);
    setLangPreviewMode(true);
    previewModeEnabled = true;
  }
  const { t } = useT();
  const [friend, setFriend] = useState<PublicFriend | null>(null);
  const [site, setSite] = useState<SiteConfig | null>(null);
  const [view, setView] = useState<PreviewView>("open");

  /* Receive the live form state from the editor (same-origin only). On the first
     message we also tell the parent we're ready, so it can (re)post after the
     iframe finished loading and avoid a dropped initial message. */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!isPreviewMessage(event.data)) return;
      setFriend(event.data.friend);
      setSite(event.data.site);
      if (event.data.view) setView(event.data.view);
    };
    window.addEventListener("message", onMessage);
    /* Announce readiness so a late-mounting host still gets the current data. */
    window.parent?.postMessage({ type: "hb-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  /* Apply the form's language to this frame's i18n singleton (preview mode keeps
     it from persisting). The previewed pages also call initLang, but doing it
     here keeps the waiting card in the form's language too. */
  useEffect(() => {
    if (friend) initLang(friend.lang);
  }, [friend?.lang]);

  /* Apply the form's theme to this iframe's document so the waiting card is
     themed even before a page mounts; the previewed page's useTheme then keeps
     it in sync (preview mode → no stored override, no write). */
  useEffect(() => {
    if (friend) document.documentElement.dataset.theme = friend.theme;
  }, [friend?.theme]);

  /* Inside the preview, internal links (the avatar → /u/:slug, the footer → /)
     would navigate THIS iframe — which, being window.name="hb-preview", just
     reloads the host and snaps back once the editor re-feeds it. Intercept those
     clicks: keep the preview put, and mirror an avatar/profile click by asking
     the editor to switch to the profile view. External (_blank) links are left
     alone so they still open in a new tab. */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as
        | HTMLAnchorElement
        | null;
      if (!a || a.target === "_blank") return;
      const href = a.getAttribute("href") ?? "";
      if (/^https?:\/\//.test(href) && !href.startsWith(window.location.origin)) return;
      e.preventDefault();
      if (/^\/u\//.test(href)) {
        window.parent?.postMessage(
          { type: "hb-preview-view", view: "profile" },
          window.location.origin,
        );
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  /* Rebuild the friend with the access window the chosen view implies, so
     switching view recomputes open / locked locally. Birthday lives in the
     friend payload, so this is a pure local recompute. */
  const shaped = useMemo<PublicFriend | null>(() => {
    if (!friend) return null;
    if (view === "locked") {
      const access = lockedAccess(birthdayString(friend.birthday));
      return { ...friend, message: "", access };
    }
    const access = openAccess(birthdayString(friend.birthday));
    return { ...friend, access };
  }, [friend, view]);

  if (!shaped) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--color-cream)] px-6">
        <StickerCard hover={false} className="max-w-xs text-center">
          <span className="block text-4xl select-none" aria-hidden="true">
            ✨
          </span>
          <p className="mt-3 text-sm text-[var(--color-text-soft)]">
            {t("editor.preview.waiting")}
          </p>
        </StickerCard>
      </div>
    );
  }
  if (view === "locked") return <LockedPage friend={shaped} />;
  if (view === "profile") return <ProfilePage friend={shaped} />;
  return <FriendPage friend={shaped} site={site} />;
}

/* Re-derive an "MM-DD" string from the parsed birthday so the access helpers can
   compute the countdown — they take the raw config form, and the preview only
   carries the parsed shape across postMessage. */
function birthdayString(b: PublicFriend["birthday"]): string {
  const mm = String(b.month).padStart(2, "0");
  const dd = String(b.day).padStart(2, "0");
  return b.year ? `${b.year}-${mm}-${dd}` : `${mm}-${dd}`;
}

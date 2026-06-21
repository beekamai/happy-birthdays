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
   { friend, site } message; this host decides WHICH page to show via a small
   open/locked/profile toggle and rebuilds the access window to match — so the
   owner can preview every state from one unsaved form. Theme/lang come from the
   form: preview mode (setThemePreviewMode/setLangPreviewMode) makes the page's
   useTheme/initLang ignore the owner's stored override WITHOUT writing it, so
   nothing leaks back into the editor chrome. */

type PreviewView = "open" | "locked" | "profile";

interface PreviewMessage {
  type: "hb-preview";
  friend: PublicFriend;
  site: SiteConfig | null;
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
    };
    window.addEventListener("message", onMessage);
    /* Announce readiness so a late-mounting host still gets the current data. */
    window.parent?.postMessage({ type: "hb-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  /* Apply the form's language to this frame's i18n singleton (preview mode keeps
     it from persisting). The previewed pages also call initLang, but doing it
     here keeps the toggle bar and waiting card in the form's language too. */
  useEffect(() => {
    if (friend) initLang(friend.lang);
  }, [friend?.lang]);

  /* Apply the form's theme to this iframe's document so the host chrome (toggle
     bar, waiting card) is themed even before a page mounts; the previewed page's
     useTheme then keeps it in sync (preview mode → no stored override, no write). */
  useEffect(() => {
    if (friend) document.documentElement.dataset.theme = friend.theme;
  }, [friend?.theme]);

  /* Rebuild the friend with the access window the chosen view implies, so the
     toggle switches between open / locked without a new message. Birthday lives
     in the friend payload, so this is a pure local recompute. */
  const shaped = useMemo<PublicFriend | null>(() => {
    if (!friend) return null;
    if (view === "locked") {
      const access = lockedAccess(birthdayString(friend.birthday));
      return { ...friend, message: "", access };
    }
    const access = openAccess(birthdayString(friend.birthday));
    return { ...friend, access };
  }, [friend, view]);

  return (
    <div className="min-h-[100dvh] bg-[var(--color-cream)]">
      <PreviewToggle view={view} onChange={setView} t={t} />
      {!shaped ? (
        <div className="flex min-h-[60vh] items-center justify-center px-6">
          <StickerCard hover={false} className="max-w-xs text-center">
            <span className="block text-4xl select-none" aria-hidden="true">
              ✨
            </span>
            <p className="mt-3 text-sm text-[var(--color-text-soft)]">
              {t("editor.preview.waiting")}
            </p>
          </StickerCard>
        </div>
      ) : view === "locked" ? (
        <LockedPage friend={shaped} />
      ) : view === "profile" ? (
        <ProfilePage friend={shaped} />
      ) : (
        <FriendPage friend={shaped} site={site} />
      )}
    </div>
  );
}

/* Re-derive an "MM-DD" string from the parsed birthday so the access helpers can
   compute the countdown — they take the raw config form, and the preview only
   carries the parsed shape across postMessage. */
function birthdayString(b: PublicFriend["birthday"]): string {
  const mm = String(b.month).padStart(2, "0");
  const dd = String(b.day).padStart(2, "0");
  return b.year ? `${b.year}-${mm}-${dd}` : `${mm}-${dd}`;
}

/* Compact segmented control pinned above the previewed page so the owner can
   flip which state to inspect. Sits in a sticky bar; the page scrolls beneath. */
function PreviewToggle({
  view,
  onChange,
  t,
}: {
  view: PreviewView;
  onChange: (v: PreviewView) => void;
  t: (key: string) => string;
}) {
  const options: { id: PreviewView; label: string }[] = [
    { id: "open", label: t("editor.preview.view.open") },
    { id: "locked", label: t("editor.preview.view.locked") },
    { id: "profile", label: t("editor.preview.view.profile") },
  ];
  return (
    <div className="sticky top-0 z-50 flex justify-center gap-1.5 border-b-[2px] border-[var(--color-muted)] bg-[var(--color-surface)]/95 px-3 py-2 backdrop-blur">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          aria-pressed={view === opt.id}
          className="rounded-[var(--radius-full)] border-[2px] px-3 py-1.5 text-xs font-bold transition-colors"
          style={{
            borderColor: view === opt.id ? "var(--color-accent)" : "var(--color-muted)",
            backgroundColor:
              view === opt.id
                ? "color-mix(in srgb, var(--color-accent) 16%, transparent)"
                : "transparent",
            color: "var(--color-text)",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

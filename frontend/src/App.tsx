import { lazy, Suspense } from "react";

import { useFriend } from "./lib/useFriend.ts";
import { useSite } from "./lib/useSite.ts";

import { LoadingState } from "./components/LoadingState.tsx";
import { FriendPage } from "./page/FriendPage.tsx";
import { LockedPage } from "./page/LockedPage.tsx";
import { ProfilePage } from "./page/ProfilePage.tsx";
import { Landing } from "./page/Landing.tsx";
import { NotFound } from "./page/NotFound.tsx";

/* The admin bundle is code-split: the public birthday pages never download it. */
const AdminApp = lazy(() => import("./admin/AdminApp.tsx"));

/* Read the route slug from the path: "/alumi" -> "alumi", "/" -> "". No router;
   the backend serves the same SPA shell on every path. */
function readSlug(): string {
  return window.location.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
}

export function App() {
  const slug = readSlug();
  const pathname = window.location.pathname;

  /* The personal cabinet SPA — /account (and the legacy /admin alias). Branch on
     the path before any friend lookup so it renders regardless of slugs. */
  if (slug === "account" || slug === "admin" || pathname.startsWith("/account") || pathname.startsWith("/admin")) {
    return (
      <Suspense fallback={<LoadingState />}>
        <AdminApp />
      </Suspense>
    );
  }

  /* /u/<slug> is the personal profile, independent of the birthday window. */
  if (slug === "u") {
    const profileSlug = pathname.replace(/^\/+/, "").split("/")[1] ?? "";
    if (profileSlug) return <ProfileRoute slug={profileSlug} />;
  }

  if (!slug) return <Landing />;
  return <FriendRoute slug={slug} />;
}

/* ---- Profile route ----------------------------------------------------------
   Resolves the friend, then renders the always-available profile page. */
function ProfileRoute({ slug }: { slug: string }) {
  const { friend, loading } = useFriend(slug);

  if (loading) return <LoadingState />;
  if (!friend) return <NotFound />;
  return <ProfilePage friend={friend} />;
}

/* ---- Friend route -----------------------------------------------------------
   Resolves the friend, then dispatches to loading / not-found / page. */
function FriendRoute({ slug }: { slug: string }) {
  const { friend, loading } = useFriend(slug);
  const { site } = useSite();

  if (loading) return <LoadingState />;
  if (!friend) return <NotFound />;
  /* Outside the birthday window the page is locked to identity + countdown. */
  if (friend.access.state === "locked") return <LockedPage friend={friend} />;
  return <FriendPage friend={friend} site={site} />;
}

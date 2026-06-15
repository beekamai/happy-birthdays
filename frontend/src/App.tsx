import { useFriend } from "./lib/useFriend.ts";
import { useSite } from "./lib/useSite.ts";

import { LoadingState } from "./components/LoadingState.tsx";
import { FriendPage } from "./page/FriendPage.tsx";
import { LockedPage } from "./page/LockedPage.tsx";
import { Landing } from "./page/Landing.tsx";
import { NotFound } from "./page/NotFound.tsx";

/* Read the route slug from the path: "/alumi" -> "alumi", "/" -> "". No router;
   the backend serves the same SPA shell on every path. */
function readSlug(): string {
  return window.location.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
}

export function App() {
  const slug = readSlug();

  if (!slug) return <Landing />;
  return <FriendRoute slug={slug} />;
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

import type { ReactNode } from "react";

/* The single fixed control cluster, top-right on every page. Children render as
   a flex row with a shared gap, so adding/removing a control (e.g. SoundToggle,
   only on the birthday page) never needs a hardcoded `right-N`. The account
   anchor is always the right-most (corner) item for a consistent identity spot. */
export function ControlBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      {children}
    </div>
  );
}

import { useState } from "react";

import { toggleMute, isMuted } from "../lib/sound.ts";
import { useT } from "../lib/i18n.ts";

/* Small fixed mute toggle. Cozy pill in the top-right corner. */
export function SoundToggle() {
  const { t } = useT();
  const [muted, setMuted] = useState(isMuted());
  const label = muted ? t("sound.on") : t("sound.off");

  return (
    <button
      type="button"
      onClick={() => setMuted(toggleMute())}
      aria-label={label}
      title={label}
      className="fixed top-4 right-4 z-50 flex size-11 items-center justify-center rounded-[var(--radius-full)] border-[2px] border-white bg-[var(--color-surface)]/90 text-xl shadow-[var(--shadow-sm)] backdrop-blur-sm transition-transform duration-200 hover:scale-110 active:scale-95"
    >
      <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
    </button>
  );
}

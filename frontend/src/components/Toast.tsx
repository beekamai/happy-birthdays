import { useCallback, useEffect, useRef, useState } from "react";

/* The shared floating confirmation pill used by the shop and the casino: a
   sticker-style toast pinned to the bottom of the viewport, above any open modal
   (z-[60]) and click-through. `useToast()` owns the message + its auto-dismiss
   timer so callers only say what happened. */

export interface ToastState {
  message: string;
  kind: "success" | "error";
}

/* How long a toast stays up before it fades out on its own. */
const TOAST_MS = 3000;

/** Toast state plus a `showToast(message, kind)` that replaces any live one. */
export function useToast(): {
  toast: ToastState | null;
  showToast: (message: string, kind: ToastState["kind"]) => void;
} {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, kind: ToastState["kind"]) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setToast({ message, kind });
    timerRef.current = window.setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return { toast, showToast };
}

/** Renders the current toast, or nothing when there isn't one. */
export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;

  const success = toast.kind === "success";
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      <div
        className="rounded-[var(--radius-full)] border-[2px] px-6 py-3 font-bold shadow-[var(--shadow-lg)]"
        style={{
          borderColor: success ? "var(--color-success)" : "var(--color-lantern)",
          backgroundColor: success
            ? "color-mix(in srgb, var(--color-nest-green) 25%, var(--color-surface))"
            : "color-mix(in srgb, var(--color-lantern-glow) 30%, var(--color-surface))",
          color: "var(--color-text)",
        }}
      >
        {success ? "✅ " : "⚠️ "}
        {toast.message}
      </div>
    </div>
  );
}

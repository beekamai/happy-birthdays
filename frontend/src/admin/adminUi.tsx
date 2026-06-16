import { useCallback, useState } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

import { useT } from "../lib/i18n.ts";

/* Small cozy form primitives shared across the admin screens. Kept in one place
   so the editor + dashboard don't each re-spell the same Tailwind. All match the
   "Cozy Ramen" tokens: warm surfaces, plump radii, soft shadows, accent focus
   rings. */

/* ---- Spinner ------------------------------------------------------------- */

/** Branded bobbing-bowl loader. */
export function Spinner({ label }: { label?: string }) {
  const { t } = useT();
  const text = label ?? t("loading.default");
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
      <span className="animate-bob text-5xl select-none" aria-hidden="true">
        🍜
      </span>
      <p className="font-[var(--font-display)] font-bold text-[var(--color-text)]">
        {text}
      </p>
    </div>
  );
}

/* ---- Field wrapper ------------------------------------------------------- */

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

/** A labelled form row with optional helper text below the control. */
export function Field({ label, hint, children, className = "" }: FieldProps) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-sm font-bold text-[var(--color-text)]">{label}</span>
      {children}
      {hint && (
        <span className="text-xs text-[var(--color-text-soft)]">{hint}</span>
      )}
    </label>
  );
}

/* ---- Input / Textarea ---------------------------------------------------- */

const controlClasses =
  "rounded-[var(--radius-md)] border-[2px] border-[var(--color-muted)] bg-[var(--color-surface)] px-4 py-2.5 text-[var(--color-text)] outline-none transition-shadow placeholder:text-[var(--color-text-soft)]/60 focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_35%,transparent)] disabled:cursor-not-allowed disabled:opacity-60";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`${controlClasses} ${className}`} {...rest} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      className={`${controlClasses} min-h-[110px] resize-y leading-relaxed ${className}`}
      {...rest}
    />
  );
}

/* ---- Toggle -------------------------------------------------------------- */

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}

/** A pill switch styled with the accent colour when on. */
export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-[var(--radius-full)] border-[2px] transition-colors"
        style={{
          backgroundColor: checked
            ? "var(--color-accent)"
            : "var(--color-muted)",
          borderColor: checked ? "var(--color-accent)" : "var(--color-muted)",
        }}
      >
        <span
          className="inline-block size-5 rounded-full bg-white shadow-[var(--shadow-sm)] transition-transform"
          style={{ transform: checked ? "translateX(20px)" : "translateX(2px)" }}
        />
      </span>
      <span className="text-sm font-bold text-[var(--color-text)]">{label}</span>
    </button>
  );
}

/* ---- Buttons ------------------------------------------------------------- */

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "ghost";
}

/** A plump pill button. `primary` is filled with the brand orange. */
export function PillButton({
  children,
  variant = "primary",
  className = "",
  ...rest
}: PillButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-full)] px-6 py-3 font-bold transition-transform duration-200 ease-[var(--ease-bounce)] hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100";
  const variants =
    variant === "primary"
      ? "border-[2px] border-[var(--color-primary-deep)] bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-[var(--shadow-md)]"
      : "border-[2px] border-[var(--color-muted)] bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-sm)]";
  return (
    <button className={`${base} ${variants} ${className}`} {...rest}>
      {children}
    </button>
  );
}

/* ---- Toast --------------------------------------------------------------- */

export interface ToastState {
  message: string;
  kind: "success" | "error";
}

/** Tiny toast hook: `show(message, kind)` then render `<Toast toast={...} />`. */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const show = useCallback((message: string, kind: ToastState["kind"]) => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  return { toast, show };
}

/** Fixed cozy toast rendered bottom-center. */
export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  const ok = toast.kind === "success";
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div
        className="rounded-[var(--radius-full)] border-[2px] px-6 py-3 font-bold shadow-[var(--shadow-lg)]"
        style={{
          borderColor: ok ? "var(--color-success)" : "var(--color-lantern)",
          backgroundColor: ok
            ? "color-mix(in srgb, var(--color-nest-green) 25%, var(--color-surface))"
            : "color-mix(in srgb, var(--color-lantern-glow) 30%, var(--color-surface))",
          color: "var(--color-text)",
        }}
      >
        {ok ? "✅ " : "⚠️ "}
        {toast.message}
      </div>
    </div>
  );
}

/* ---- State badge --------------------------------------------------------- */

/** Coloured pill describing a friend page's access state. */
export function StateBadge({ state }: { state: string }) {
  const { t } = useT();
  const colors: Record<string, string> = {
    open: "var(--color-success)",
    closing: "var(--color-ramen-gold)",
    locked: "var(--color-text-soft)",
  };
  const known = state in colors;
  const m = {
    label: known ? t(`state.${state}`) : state,
    color: colors[state] ?? "var(--color-text-soft)",
  };
  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-full)] border-[2px] px-3 py-1 text-xs font-bold"
      style={{
        borderColor: m.color,
        color: "var(--color-text)",
        backgroundColor: `color-mix(in srgb, ${m.color} 16%, transparent)`,
      }}
    >
      {m.label}
    </span>
  );
}

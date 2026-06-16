import { useT } from "../lib/i18n.ts";

/* A cozy in-app confirmation modal — replaces the browser's window.confirm with
   the Cozy Ramen sticker look. Reusable for any destructive/important action.
   Renders above other modals (z-[60]); closing happens via cancel or overlay. */

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "danger" | "primary";
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Cozy confirm modal with a danger (default) or primary confirm button. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirmVariant = "danger",
  disabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useT();
  if (!open) return null;

  const confirmClass =
    confirmVariant === "danger"
      ? "border-[2px] border-[var(--color-lantern)] bg-[var(--color-surface)] text-[var(--color-lantern)]"
      : "border-[2px] border-[var(--color-primary-deep)] bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-[var(--shadow-sm)]";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label={cancelLabel ?? t("dialog.cancel")}
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-[var(--color-cream)]/70 backdrop-blur-[2px]"
      />

      <div className="relative z-10 w-full max-w-sm rounded-[var(--radius-lg)] border-[3px] border-white bg-[var(--color-surface)] p-6 text-[var(--color-text)] shadow-[var(--shadow-lg)]">
        <h2 className="mb-2 text-lg font-bold">{title}</h2>
        <p className="mb-6 text-sm leading-relaxed text-[var(--color-text-soft)]">{message}</p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="order-2 rounded-[var(--radius-full)] border-[2px] border-[var(--color-muted)] bg-[var(--color-surface)] px-5 py-2.5 font-bold text-[var(--color-text)] transition-transform duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 sm:order-1"
          >
            {cancelLabel ?? t("dialog.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={disabled}
            className={`order-1 rounded-[var(--radius-full)] px-5 py-2.5 font-bold transition-transform duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 sm:order-2 ${confirmClass}`}
          >
            {confirmLabel ?? t("dialog.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

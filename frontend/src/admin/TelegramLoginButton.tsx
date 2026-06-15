import { useEffect, useRef, useState } from "react";

import {
  loginWithTelegram,
  type AuthConfig,
  type TelegramAuthData,
} from "./adminApi.ts";
import { useT } from "../lib/i18n.ts";

/* Telegram Login Widget wrapper.

   The official widget is an injected <script> that renders an iframe button and,
   on success, calls a GLOBAL callback named by `data-onauth="<fn>(user)"`. We
   register that callback on `window` under a unique name, have it POST the user
   object to our backend, then notify the parent via `onLogin()`. Both the script
   tag and the global are cleaned up on unmount so re-mounts don't leak.

   When the bot token isn't configured yet (`config.enabled === false`) there is
   nothing to log into, so we render a cozy notice instead of the widget. */

interface TelegramLoginButtonProps {
  config: AuthConfig;
  /** Called after a successful session exchange so the parent can refresh. */
  onLogin: () => void;
}

/* A monotonically increasing id keeps each mount's global callback unique. */
let callbackSeq = 0;

export function TelegramLoginButton({
  config,
  onLogin,
}: TelegramLoginButtonProps) {
  const { t } = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!config.enabled || !config.botUsername) return;
    const container = containerRef.current;
    if (!container) return;

    const callbackName = `__tgAdminAuth_${++callbackSeq}`;
    const win = window as unknown as Record<string, unknown>;

    win[callbackName] = (user: TelegramAuthData) => {
      setBusy(true);
      setError(null);
      loginWithTelegram(user)
        .then(() => onLogin())
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : t("tg.loginFailed"));
        })
        .finally(() => setBusy(false));
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", config.botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-userpic", "true");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", `${callbackName}(user)`);
    container.appendChild(script);

    return () => {
      delete win[callbackName];
      container.innerHTML = "";
    };
  }, [config.enabled, config.botUsername, onLogin]);

  if (!config.enabled) {
    return (
      <div className="rounded-[var(--radius-md)] border-[2px] border-dashed border-[var(--color-muted)] bg-[var(--color-cream)] px-5 py-4 text-center text-sm text-[var(--color-text-soft)]">
        <span className="mb-1 block text-2xl select-none" aria-hidden="true">
          🔧
        </span>
        {t("tg.notConfigured")}{" "}
        <code className="rounded bg-[var(--color-muted)]/50 px-1 font-mono text-[var(--color-text)]">
          TG_BOT_TOKEN
        </code>{" "}
        {t("tg.notConfiguredEnv")}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={containerRef} className="min-h-[48px]" />
      {busy && (
        <p className="text-sm text-[var(--color-text-soft)]">{t("tg.signingIn")}</p>
      )}
      {error && (
        <p className="text-sm font-bold text-[var(--color-lantern)]">{error}</p>
      )}
    </div>
  );
}

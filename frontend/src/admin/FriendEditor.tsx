import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, ReactNode } from "react";

import { StickerCard } from "../components/decor/StickerCard.tsx";
import {
  ApiError,
  createFriend,
  deriveSlug,
  fetchAdminFriend,
  updateFriend,
  uploadAvatar,
  type FriendConfig,
  type FriendLimitedUpdate,
} from "./adminApi.ts";
import {
  Field,
  Input,
  PillButton,
  Spinner,
  Textarea,
  Toast,
  Toggle,
  useToast,
} from "./adminUi.tsx";

/* The core editor. Three shapes from one component:
   - create  : owner builds a brand-new page (full form, slug derived/overridable)
   - edit     : owner edits an existing page (full form)
   - limited  : a friend edits their own page (displayName, accent, avatar,
                gamesEnabled, giftDisplay, giftLayout only)

   A live <iframe> preview of the SAVED page sits beside the form on desktop and
   below it on mobile; it reloads (via a bumped key) after each successful save. */

const GAME_IDS = [
  "feed-fox",
  "catch-stars",
  "slide-puzzle",
  "memory",
  "maze",
] as const;

const GAME_LABELS: Record<string, string> = {
  "feed-fox": "🦊 Накорми лису",
  "catch-stars": "⭐ Лови звёзды",
  "slide-puzzle": "🧩 Пятнашки",
  memory: "🃏 Память",
  maze: "🌀 Лабиринт",
};

interface FriendEditorProps {
  slug?: string;
  create?: boolean;
  limited?: boolean;
  /** Back to the dashboard (owner only — friends have no list to go back to). */
  onBack?: () => void;
}

/** A blank config used to seed the create form. */
function emptyConfig(): FriendConfig {
  return {
    username: "",
    displayName: "",
    birthday: "",
    message: "",
    accent: "#7ec2e8",
    games: [],
    avatar: "",
    gamesEnabled: true,
    giftDisplay: "current",
    giftLayout: "list",
  };
}

export function FriendEditor({
  slug: slugProp,
  create = false,
  limited = false,
  onBack,
}: FriendEditorProps) {
  const [config, setConfig] = useState<FriendConfig | null>(
    create ? emptyConfig() : null,
  );
  /* Owner flag from the detail payload; create mode is always owner. */
  const [isOwner, setIsOwner] = useState(create);
  const [loading, setLoading] = useState(!create);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  /* The slug we currently edit/preview. In create it's empty until first save. */
  const [slug, setSlug] = useState(slugProp ?? "");
  /* User-typed slug override in create mode (empty = derive from username). */
  const [slugOverride, setSlugOverride] = useState("");
  /* Flips true after a successful create so further saves go to PUT, not a
     second POST (avoids a double-create on a second click). */
  const [editMode, setEditMode] = useState(false);
  /* Bumping this reloads the preview iframe. */
  const [previewKey, setPreviewKey] = useState(0);
  /* Pending avatar files (create mode defers upload until the slug exists). */
  const pendingMain = useRef<File | null>(null);
  const pendingPuzzle = useRef<File | null>(null);
  /* Local object-URL previews for not-yet-uploaded avatars. Mirrored into refs
     so the unmount cleanup can revoke whatever's live without re-running on
     every change (which would revoke a still-visible blob). */
  const [mainPreview, setMainPreviewState] = useState<string | null>(null);
  const [puzzlePreview, setPuzzlePreviewState] = useState<string | null>(null);
  const mainPreviewRef = useRef<string | null>(null);
  const puzzlePreviewRef = useRef<string | null>(null);

  /* Set a slot's preview URL, revoking only that slot's previous blob. Passing
     null clears the slot (used after a successful upload so the tile falls back
     to the real server URL). */
  const setPreview = (which: "main" | "puzzle", url: string | null) => {
    const ref = which === "main" ? mainPreviewRef : puzzlePreviewRef;
    if (ref.current && ref.current !== url) URL.revokeObjectURL(ref.current);
    ref.current = url;
    (which === "main" ? setMainPreviewState : setPuzzlePreviewState)(url);
  };

  const { toast, show } = useToast();

  /* In create mode we start as POST; after the first successful save we behave
     like edit. `create && !editMode` is the only true "creating" state. */
  const creating = create && !editMode;
  /* Whether the form is the limited friend subset. Owners always get full. */
  const isLimited = limited && !isOwner;

  /* ---- Load existing config (edit / limited) --------------------------- */
  useEffect(() => {
    if (create) return;
    const target = slugProp;
    if (!target) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetchAdminFriend(target).then((detail) => {
      if (!alive) return;
      if (!detail) {
        setNotFound(true);
      } else {
        setConfig(detail.config);
        setIsOwner(detail.isOwner);
        setSlug(detail.slug);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [create, slugProp]);

  /* Revoke any live object URLs once, on unmount. Reads from refs so this effect
     never re-runs (and never revokes a blob that's still on screen). */
  useEffect(() => {
    return () => {
      if (mainPreviewRef.current) URL.revokeObjectURL(mainPreviewRef.current);
      if (puzzlePreviewRef.current) URL.revokeObjectURL(puzzlePreviewRef.current);
    };
  }, []);

  /* The derived slug shown live under the username in create mode. */
  const derivedSlug = useMemo(
    () => slugOverride.trim() || deriveSlug(config?.username ?? ""),
    [slugOverride, config?.username],
  );

  if (loading) return <Spinner label="Открываем страничку…" />;

  if (notFound || !config) {
    return (
      <div className="mx-auto max-w-md py-10">
        <StickerCard hover={false}>
          <span className="block text-5xl select-none" aria-hidden="true">
            🥺
          </span>
          <h2 className="mt-3 text-2xl">Странички нет</h2>
          <p className="mt-2 text-[var(--color-text-soft)]">
            Не нашли такую — может, ссылка устарела.
          </p>
          {onBack && (
            <PillButton variant="ghost" className="mt-5" onClick={onBack}>
              ← Назад
            </PillButton>
          )}
        </StickerCard>
      </div>
    );
  }

  /* ---- Field setters --------------------------------------------------- */
  const set = <K extends keyof FriendConfig>(key: K, value: FriendConfig[K]) =>
    setConfig((c) => (c ? { ...c, [key]: value } : c));

  const setGift = (patch: Partial<NonNullable<FriendConfig["gift"]>>) =>
    setConfig((c) =>
      c
        ? { ...c, gift: { name: "", ...c.gift, ...patch } }
        : c,
    );

  const toggleGame = (gameId: string) =>
    setConfig((c) => {
      if (!c) return c;
      const has = c.games.some((g) => g.gameId === gameId);
      return {
        ...c,
        games: has
          ? c.games.filter((g) => g.gameId !== gameId)
          : [...c.games, { gameId }],
      };
    });

  /* ---- Avatar handling ------------------------------------------------- */
  const onPickAvatar =
    (which: "main" | "puzzle") => async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ""; /* allow re-picking the same file */
      if (!file) return;

      /* Instant local preview (revokes this slot's previous blob, if any). */
      setPreview(which, URL.createObjectURL(file));

      /* No slug yet (create, pre-save): defer the upload. */
      if (!slug) {
        if (which === "main") pendingMain.current = file;
        else pendingPuzzle.current = file;
        show("Аватар загрузится после создания странички", "success");
        return;
      }

      try {
        const res = await uploadAvatar(slug, file, which);
        set(which === "main" ? "avatar" : "puzzleAvatar", res.filename);
        /* Drop the local blob so the tile shows the real (saved) image. */
        setPreview(which, null);
        show("Аватар загружен 🖼️", "success");
      } catch (err) {
        show(
          err instanceof ApiError ? err.message : "Не вышло загрузить аватар",
          "error",
        );
      }
    };

  /* ---- Save ------------------------------------------------------------- */
  const onSave = async () => {
    setSaving(true);
    try {
      if (creating) {
        const targetSlug = derivedSlug;
        const res = await createFriend(config, slugOverride.trim() || undefined);
        const newSlug = res.slug ?? targetSlug;

        /* Flush any avatars picked before the page existed, then drop the local
           blobs so the tiles show the real saved images. */
        const mainFile = pendingMain.current;
        const puzzleFile = pendingPuzzle.current;
        if (mainFile) {
          const up = await uploadAvatar(newSlug, mainFile, "main");
          set("avatar", up.filename);
          pendingMain.current = null;
          setPreview("main", null);
        }
        if (puzzleFile) {
          const up = await uploadAvatar(newSlug, puzzleFile, "puzzle");
          set("puzzleAvatar", up.filename);
          pendingPuzzle.current = null;
          setPreview("puzzle", null);
        }

        setSlug(newSlug);
        setEditMode(true); /* further saves now PUT, not POST */
        setPreviewKey((k) => k + 1);
        show("Страничка создана 🎉", "success");
      } else if (isLimited) {
        const subset: FriendLimitedUpdate = {
          displayName: config.displayName,
          accent: config.accent,
          gamesEnabled: config.gamesEnabled,
          giftDisplay: config.giftDisplay,
          giftLayout: config.giftLayout,
        };
        await updateFriend(slug, subset);
        setPreviewKey((k) => k + 1);
        show("Сохранили 💛", "success");
      } else {
        await updateFriend(slug, config);
        setPreviewKey((k) => k + 1);
        show("Сохранили 💛", "success");
      }
    } catch (err) {
      show(
        err instanceof ApiError ? err.message : "Не удалось сохранить",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  /* We can preview as soon as a slug exists (set on load, or after create). */
  const previewSlug = slug;
  const showFull = !isLimited;

  /* ---- Avatar tile (shared by main + puzzle) --------------------------- */
  const avatarTile = (
    label: string,
    src: string | null,
    onPick: (e: ChangeEvent<HTMLInputElement>) => void,
  ) => (
    <Field label={label}>
      <div className="flex items-center gap-4">
        <div
          className="size-20 shrink-0 overflow-hidden rounded-full border-[3px] border-white bg-[var(--color-cream)] shadow-[var(--shadow-sm)]"
          style={{ outline: "3px solid var(--color-accent)", outlineOffset: "2px" }}
        >
          {src ? (
            <img src={src} alt={label} className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-2xl select-none">
              🖼️
            </span>
          )}
        </div>
        <label className="cursor-pointer">
          <span className="inline-flex items-center gap-2 rounded-[var(--radius-full)] border-[2px] border-[var(--color-muted)] bg-[var(--color-surface)] px-4 py-2 text-sm font-bold text-[var(--color-text)] shadow-[var(--shadow-sm)] transition-transform hover:scale-[1.03]">
            📷 Выбрать
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPick}
          />
        </label>
      </div>
    </Field>
  );

  /* Apply the chosen accent to the form so controls tint live as you edit. */
  const accentStyle = { "--color-accent": config.accent } as CSSProperties;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6" style={accentStyle}>
      <Toast toast={toast} />

      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl">
            {creating
              ? "Новая страничка"
              : isLimited
                ? "Моя страничка"
                : config.displayName || slug}
          </h1>
          {slug && (
            <p className="text-sm text-[var(--color-text-soft)]">
              happy-birthdays /{slug}
            </p>
          )}
        </div>
        {onBack && (
          <PillButton variant="ghost" onClick={onBack}>
            ← К списку
          </PillButton>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* ---- Form column ------------------------------------------------ */}
        <div className="flex flex-col gap-6">
          <StickerCard hover={false}>
            <h2 className="mb-4 text-xl">👤 Основное</h2>
            <div className="flex flex-col gap-4">
              <Field label="Имя">
                <Input
                  value={config.displayName}
                  onChange={(e) => set("displayName", e.target.value)}
                  placeholder="Алуми"
                />
              </Field>

              {showFull && (
                <>
                  <Field
                    label="Telegram username"
                    hint="С @ или без — например @alumi"
                  >
                    <Input
                      value={config.username}
                      onChange={(e) => set("username", e.target.value)}
                      placeholder="@alumi"
                    />
                  </Field>

                  {creating && (
                    <Field
                      label="Слаг (адрес странички)"
                      hint={
                        derivedSlug
                          ? `Будет: /${derivedSlug}`
                          : "Заполни username — слаг подставится сам"
                      }
                    >
                      <Input
                        value={slugOverride}
                        onChange={(e) => setSlugOverride(e.target.value)}
                        placeholder={deriveSlug(config.username) || "alumi"}
                      />
                    </Field>
                  )}

                  <Field
                    label="Дата рождения"
                    hint="ММ-ДД (07-21) или с годом ГГГГ-ММ-ДД (2001-07-21)"
                  >
                    <Input
                      value={config.birthday}
                      onChange={(e) => set("birthday", e.target.value)}
                      placeholder="07-21"
                    />
                  </Field>

                  <Field label="Поздравление">
                    <Textarea
                      value={config.message}
                      onChange={(e) => set("message", e.target.value)}
                      placeholder="Тёплые слова имениннику…"
                    />
                  </Field>
                </>
              )}

              <Field label="Цвет-акцент" hint="Подкрашивает кнопки и рамки">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.accent ?? "#7ec2e8"}
                    onChange={(e) => set("accent", e.target.value)}
                    className="size-11 cursor-pointer rounded-[var(--radius-md)] border-[2px] border-[var(--color-muted)] bg-transparent p-1"
                  />
                  <Input
                    value={config.accent ?? ""}
                    onChange={(e) => set("accent", e.target.value)}
                    placeholder="#7ec2e8"
                    className="max-w-[140px]"
                  />
                </div>
              </Field>
            </div>
          </StickerCard>

          <StickerCard hover={false}>
            <h2 className="mb-4 text-xl">🖼️ Аватары</h2>
            <div className="flex flex-col gap-4">
              {avatarTile(
                "Главный аватар",
                mainPreview ?? (config.avatar ? `/friends/${slug}/${config.avatar}` : null),
                onPickAvatar("main"),
              )}
              {showFull &&
                avatarTile(
                  "Аватар для пазла (необязательно)",
                  puzzlePreview ??
                    (config.puzzleAvatar
                      ? `/friends/${slug}/${config.puzzleAvatar}`
                      : null),
                  onPickAvatar("puzzle"),
                )}
            </div>
          </StickerCard>

          {showFull && (
            <StickerCard hover={false}>
              <h2 className="mb-4 text-xl">🎁 Подарок</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Название">
                  <Input
                    value={config.gift?.name ?? ""}
                    onChange={(e) => setGift({ name: e.target.value })}
                    placeholder="Подарочный NFT"
                  />
                </Field>
                <Field label="Эмодзи">
                  <Input
                    value={config.gift?.emoji ?? ""}
                    onChange={(e) => setGift({ emoji: e.target.value })}
                    placeholder="🎁"
                  />
                </Field>
                <Field label="Lottie (необязательно)">
                  <Input
                    value={config.gift?.lottie ?? ""}
                    onChange={(e) => setGift({ lottie: e.target.value })}
                    placeholder="имя_анимации.json"
                  />
                </Field>
                <Field label="Ссылка (необязательно)">
                  <Input
                    value={config.gift?.link ?? ""}
                    onChange={(e) => setGift({ link: e.target.value })}
                    placeholder="https://t.me/nft/…"
                  />
                </Field>
              </div>
            </StickerCard>
          )}

          {showFull && (
            <StickerCard hover={false}>
              <h2 className="mb-4 text-xl">🎮 Игры</h2>
              <div className="flex flex-col gap-2">
                {GAME_IDS.map((id) => {
                  const checked = config.games.some((g) => g.gameId === id);
                  return (
                    <label
                      key={id}
                      className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border-[2px] px-4 py-2.5 transition-colors"
                      style={{
                        borderColor: checked
                          ? "var(--color-accent)"
                          : "var(--color-muted)",
                        backgroundColor: checked
                          ? "color-mix(in srgb, var(--color-accent) 12%, transparent)"
                          : "transparent",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleGame(id)}
                        className="size-5 accent-[var(--color-accent)]"
                      />
                      <span className="font-bold text-[var(--color-text)]">
                        {GAME_LABELS[id]}
                      </span>
                    </label>
                  );
                })}
              </div>
            </StickerCard>
          )}

          <StickerCard hover={false}>
            <h2 className="mb-4 text-xl">⚙️ Настройки</h2>
            <div className="flex flex-col gap-5">
              <Toggle
                checked={config.gamesEnabled ?? true}
                onChange={(v) => set("gamesEnabled", v)}
                label="Игры включены"
              />

              <Field label="Показ подарков">
                <div className="flex gap-2">
                  {(["current", "all"] as const).map((opt) => (
                    <SegBtn
                      key={opt}
                      active={(config.giftDisplay ?? "current") === opt}
                      onClick={() => set("giftDisplay", opt)}
                    >
                      {opt === "current" ? "Только текущий" : "Вся история"}
                    </SegBtn>
                  ))}
                </div>
              </Field>

              <Field label="Раскладка подарков">
                <div className="flex gap-2">
                  {(["list", "blocks"] as const).map((opt) => (
                    <SegBtn
                      key={opt}
                      active={(config.giftLayout ?? "list") === opt}
                      onClick={() => set("giftLayout", opt)}
                    >
                      {opt === "list" ? "Список" : "Блоки"}
                    </SegBtn>
                  ))}
                </div>
              </Field>
            </div>
          </StickerCard>

          <div className="flex justify-end">
            <PillButton onClick={onSave} disabled={saving}>
              {saving ? "Сохраняем…" : creating ? "🎉 Создать" : "💾 Сохранить"}
            </PillButton>
          </div>
        </div>

        {/* ---- Preview column -------------------------------------------- */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <StickerCard hover={false} className="p-3">
            <p className="mb-2 px-1 text-sm font-bold text-[var(--color-text-soft)]">
              👀 Превью (сохранённое состояние)
            </p>
            {previewSlug ? (
              <iframe
                key={previewKey}
                src={`/${previewSlug}`}
                title="Превью странички"
                className="h-[360px] w-full rounded-[var(--radius-md)] border-[2px] border-[var(--color-muted)] bg-[var(--color-cream)] lg:h-[560px]"
              />
            ) : (
              <div className="flex h-[360px] flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border-[2px] border-dashed border-[var(--color-muted)] bg-[var(--color-cream)] text-center text-[var(--color-text-soft)] lg:h-[560px]">
                <span className="text-4xl select-none" aria-hidden="true">
                  ✨
                </span>
                <p className="px-6 text-sm">
                  Создай страничку — и тут появится живое превью.
                </p>
              </div>
            )}
          </StickerCard>
        </div>
      </div>
    </div>
  );
}

/* A small segmented-control button (active = accent fill). */
function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-[var(--radius-full)] border-[2px] px-4 py-2 text-sm font-bold transition-colors"
      style={{
        borderColor: active ? "var(--color-accent)" : "var(--color-muted)",
        backgroundColor: active
          ? "color-mix(in srgb, var(--color-accent) 16%, transparent)"
          : "transparent",
        color: "var(--color-text)",
      }}
    >
      {children}
    </button>
  );
}

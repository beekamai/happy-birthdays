import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, ReactNode } from "react";

import { StickerCard } from "../components/decor/StickerCard.tsx";
import { useT } from "../lib/i18n.ts";
import {
  ApiError,
  createFriend,
  deriveSlug,
  fetchAdminFriend,
  translateFields,
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
   - limited  : a friend edits their own page (displayName, birthday, accent,
                avatar, bio, socials, gamesEnabled, giftDisplay, giftLayout,
                lang, theme, translations — not username/slug/message/gift)

   A live <iframe> preview of the SAVED page sits beside the form on desktop and
   below it on mobile; it reloads (via a bumped key) after each successful save. */

const GAME_IDS = [
  "feed-fox",
  "catch-stars",
  "slide-puzzle",
  "memory",
  "maze",
] as const;

/* Known social platforms offered in the repeater. Unknown keys fall back to a
   generic "link" badge on the backend; we only expose the curated set here. */
const SOCIAL_PLATFORMS = [
  "telegram",
  "discord",
  "x",
  "instagram",
  "youtube",
  "twitch",
  "github",
  "vk",
  "tiktok",
  "steam",
  "website",
] as const;

function uploadFilename(file: File, which: "main" | "puzzle"): string {
  const ext = file.type === "image/png" ? "png" : "jpg";
  return `${which}-${Math.max(1, file.size)}.${ext}`;
}

function cleanOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/* Drop social rows with an empty URL and trim the rest; undefined when none
   survive, so the field is omitted from the saved config. */
function cleanSocials(
  socials: { platform: string; url: string }[] | undefined,
): { platform: string; url: string }[] | undefined {
  const kept = (socials ?? [])
    .map((s) => ({ platform: s.platform, url: s.url.trim() }))
    .filter((s) => s.url);
  return kept.length ? kept : undefined;
}

function normalizeConfigForSave(
  config: FriendConfig,
  defaultGiftName: string,
): FriendConfig {
  const gift = config.gift;
  const next: FriendConfig = {
    ...config,
    username: config.username.trim(),
    displayName: config.displayName.trim(),
    birthday: config.birthday.trim(),
    message: config.message.trim(),
    avatar: config.avatar.trim(),
    puzzleAvatar: cleanOptional(config.puzzleAvatar),
    bio: cleanOptional(config.bio),
    socials: cleanSocials(config.socials),
  };

  if (gift) {
    const name = cleanOptional(gift.name);
    const emoji = cleanOptional(gift.emoji);
    const lottie = cleanOptional(gift.lottie);
    const link = cleanOptional(gift.link);
    const imagePath = cleanOptional(gift.imagePath);

    if (name || emoji || lottie || link || imagePath) {
      next.gift = {
        name: name ?? defaultGiftName,
        emoji: emoji ?? "🎁",
        ...(lottie ? { lottie } : {}),
        ...(link ? { link } : {}),
        ...(imagePath ? { imagePath } : {}),
      };
    } else {
      delete next.gift;
    }
  }

  return next;
}

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
    lang: "ru",
    theme: "light",
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
  const { t } = useT();

  /* Translation panel state for the target (non-page) language. Seeded from the
     loaded config's translations; mutated by manual edits + the auto button. */
  const [tName, setTName] = useState("");
  const [tMessage, setTMessage] = useState("");
  const [tGiftName, setTGiftName] = useState("");
  const [tBio, setTBio] = useState("");
  const [translating, setTranslating] = useState(false);

  /* In create mode we start as POST; after the first successful save we behave
     like edit. `create && !editMode` is the only true "creating" state. */
  const creating = create && !editMode;
  /* Whether the form is the limited friend subset. Owners always get full. */
  const isLimited = limited && !isOwner;
  const showFull = !isLimited;

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
        /* Seed the translation panel from the stored other-language values. */
        const target = (detail.config.lang ?? "ru") === "ru" ? "en" : "ru";
        const tr = detail.config.translations?.[target];
        setTName(tr?.displayName ?? "");
        setTMessage(tr?.message ?? "");
        setTGiftName(tr?.giftName ?? "");
        setTBio(tr?.bio ?? "");
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
    () =>
      slugOverride.trim()
        ? deriveSlug(slugOverride)
        : deriveSlug(config?.username ?? ""),
    [slugOverride, config?.username],
  );

  if (loading) return <Spinner label={t("editor.loading")} />;

  if (notFound || !config) {
    return (
      <div className="mx-auto max-w-md py-10">
        <StickerCard hover={false}>
          <span className="block text-5xl select-none" aria-hidden="true">
            🥺
          </span>
          <h2 className="mt-3 text-2xl">{t("editor.notFound.title")}</h2>
          <p className="mt-2 text-[var(--color-text-soft)]">
            {t("editor.notFound.text")}
          </p>
          {onBack && (
            <PillButton variant="ghost" className="mt-5" onClick={onBack}>
              {t("editor.back")}
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

  /* ---- Socials repeater ------------------------------------------------ */
  const addSocial = () =>
    setConfig((c) =>
      c
        ? { ...c, socials: [...(c.socials ?? []), { platform: "telegram", url: "" }] }
        : c,
    );

  const setSocial = (
    index: number,
    patch: Partial<{ platform: string; url: string }>,
  ) =>
    setConfig((c) =>
      c
        ? {
            ...c,
            socials: (c.socials ?? []).map((s, i) =>
              i === index ? { ...s, ...patch } : s,
            ),
          }
        : c,
    );

  const removeSocial = (index: number) =>
    setConfig((c) =>
      c ? { ...c, socials: (c.socials ?? []).filter((_, i) => i !== index) } : c,
    );

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
        show(t("editor.toast.avatarDeferred"), "success");
        return;
      }

      try {
        const res = await uploadAvatar(slug, file, which);
        set(which === "main" ? "avatar" : "puzzleAvatar", res.filename);
        /* Drop the local blob so the tile shows the real (saved) image. */
        setPreview(which, null);
        show(t("editor.toast.avatarUploaded"), "success");
      } catch (err) {
        show(
          err instanceof ApiError ? err.message : t("editor.toast.avatarFailed"),
          "error",
        );
      }
    };

  /* The page language is the author language; the panel edits the other one. */
  const pageLang: "ru" | "en" = config?.lang ?? "ru";
  const targetLang: "ru" | "en" = pageLang === "ru" ? "en" : "ru";

  /* Merge the panel values into config.translations[targetLang], keeping the
     other language and dropping empty fields (the backend re-fills those). */
  const withTranslations = (base: FriendConfig): FriendConfig => {
    const entry: {
      displayName?: string;
      message?: string;
      giftName?: string;
      bio?: string;
    } = {};
    if (tName.trim()) entry.displayName = tName.trim();
    if (showFull && tMessage.trim()) entry.message = tMessage.trim();
    if (showFull && base.gift?.name?.trim() && tGiftName.trim())
      entry.giftName = tGiftName.trim();
    if (base.bio?.trim() && tBio.trim()) entry.bio = tBio.trim();
    return {
      ...base,
      translations: { ...base.translations, [targetLang]: entry },
    };
  };

  /* Run the live-value translation into the panel (overwrites panel fields). */
  const onTranslate = async () => {
    setTranslating(true);
    try {
      const result = await translateFields({
        from: pageLang,
        to: targetLang,
        displayName: config?.displayName?.trim() || undefined,
        message: showFull ? config?.message?.trim() || undefined : undefined,
        giftName: showFull ? config?.gift?.name?.trim() || undefined : undefined,
        bio: config?.bio?.trim() || undefined,
      });
      if (!result) {
        show(t("editor.toast.translateFailed"), "error");
        return;
      }
      if (result.displayName !== undefined) setTName(result.displayName);
      if (result.message !== undefined) setTMessage(result.message);
      if (result.giftName !== undefined) setTGiftName(result.giftName);
      if (result.bio !== undefined) setTBio(result.bio);
      show(t("editor.toast.translated"), "success");
    } catch {
      show(t("editor.toast.translateFailed"), "error");
    } finally {
      setTranslating(false);
    }
  };

  /* ---- Save ------------------------------------------------------------- */
  const onSave = async () => {
    setSaving(true);
    try {
      if (creating) {
        const mainFile = pendingMain.current;
        const puzzleFile = pendingPuzzle.current;
        const createConfig = normalizeConfigForSave(
          withTranslations(config),
          t("editor.giftName.default"),
        );

        if (!createConfig.avatar && mainFile) {
          createConfig.avatar = uploadFilename(mainFile, "main");
        }
        if (!createConfig.puzzleAvatar && puzzleFile) {
          createConfig.puzzleAvatar = uploadFilename(puzzleFile, "puzzle");
        }
        if (!createConfig.avatar) {
          show(t("editor.toast.avatarNeeded"), "error");
          return;
        }

        const targetSlug = derivedSlug;
        const res = await createFriend(
          createConfig,
          slugOverride.trim() ? targetSlug : undefined,
        );
        const newSlug = res.slug ?? targetSlug;

        /* Flush any avatars picked before the page existed, then drop the local
           blobs so the tiles show the real saved images. */
        const savedConfig = { ...createConfig };
        if (mainFile) {
          const up = await uploadAvatar(newSlug, mainFile, "main");
          savedConfig.avatar = up.filename;
          pendingMain.current = null;
          setPreview("main", null);
        }
        if (puzzleFile) {
          const up = await uploadAvatar(newSlug, puzzleFile, "puzzle");
          savedConfig.puzzleAvatar = up.filename;
          pendingPuzzle.current = null;
          setPreview("puzzle", null);
        }

        setConfig(savedConfig);
        setSlug(newSlug);
        setEditMode(true); /* further saves now PUT, not POST */
        setPreviewKey((k) => k + 1);
        show(t("editor.toast.created"), "success");
      } else if (isLimited) {
        const merged = withTranslations(config);
        const subset: FriendLimitedUpdate = {
          displayName: config.displayName,
          birthday: config.birthday.trim(),
          accent: config.accent,
          gamesEnabled: config.gamesEnabled,
          giftDisplay: config.giftDisplay,
          giftLayout: config.giftLayout,
          lang: config.lang,
          theme: config.theme,
          bio: cleanOptional(config.bio),
          socials: cleanSocials(config.socials),
          translations: merged.translations,
        };
        await updateFriend(slug, subset);
        setPreviewKey((k) => k + 1);
        show(t("editor.toast.saved"), "success");
      } else {
        await updateFriend(
          slug,
          normalizeConfigForSave(withTranslations(config), t("editor.giftName.default")),
        );
        setPreviewKey((k) => k + 1);
        show(t("editor.toast.saved"), "success");
      }
    } catch (err) {
      show(
        err instanceof ApiError ? err.message : t("editor.toast.saveFailed"),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  /* We can preview as soon as a slug exists (set on load, or after create). */
  const previewSlug = slug;

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
            {t("editor.avatarPick")}
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
              ? t("editor.title.new")
              : isLimited
                ? t("editor.title.mine")
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
            {t("editor.toBack")}
          </PillButton>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* ---- Form column ------------------------------------------------ */}
        <div className="flex flex-col gap-6">
          <StickerCard hover={false}>
            <h2 className="mb-4 text-xl">{t("editor.section.basic")}</h2>
            <div className="flex flex-col gap-4">
              <Field label={t("editor.field.name")}>
                <Input
                  value={config.displayName}
                  onChange={(e) => set("displayName", e.target.value)}
                  placeholder={t("editor.placeholder.name")}
                />
              </Field>

              {showFull && (
                <>
                  <Field
                    label={t("editor.field.username")}
                    hint={t("editor.hint.username")}
                  >
                    <Input
                      value={config.username}
                      onChange={(e) => set("username", e.target.value)}
                      placeholder={t("editor.placeholder.username")}
                    />
                  </Field>

                  {creating && (
                    <Field
                      label={t("editor.field.slug")}
                      hint={
                        derivedSlug
                          ? t("editor.hint.slug", { slug: derivedSlug })
                          : t("editor.hint.slugEmpty")
                      }
                    >
                      <Input
                        value={slugOverride}
                        onChange={(e) => setSlugOverride(e.target.value)}
                        placeholder={deriveSlug(config.username) || t("editor.placeholder.slug")}
                      />
                    </Field>
                  )}
                </>
              )}

              {/* Birthday — editable by owner and friend alike. */}
              <Field
                label={t("editor.field.birthday")}
                hint={t("editor.hint.birthday")}
              >
                <Input
                  value={config.birthday}
                  onChange={(e) => set("birthday", e.target.value)}
                  placeholder={t("editor.placeholder.birthday")}
                />
              </Field>

              {showFull && (
                <Field label={t("editor.field.message")}>
                  <Textarea
                    value={config.message}
                    onChange={(e) => set("message", e.target.value)}
                    placeholder={t("editor.placeholder.message")}
                  />
                </Field>
              )}

              {/* Bio — personal profile blurb, editable in both modes. */}
              <Field
                label={t("editor.field.bio")}
                hint={t("editor.field.bio.hint")}
              >
                <Textarea
                  value={config.bio ?? ""}
                  onChange={(e) => set("bio", e.target.value)}
                  placeholder={t("editor.placeholder.bio")}
                />
              </Field>

              <Field
                label={t("editor.field.accent")}
                hint={t("editor.hint.accent")}
              >
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

          {/* ---- Socials repeater (both modes) -------------------------- */}
          <StickerCard hover={false}>
            <h2 className="mb-4 text-xl">{t("editor.section.socials")}</h2>
            <div className="flex flex-col gap-3">
              {(config.socials ?? []).map((social, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={social.platform}
                    onChange={(e) => setSocial(i, { platform: e.target.value })}
                    aria-label={t("editor.socials.platform")}
                    className="shrink-0 rounded-[var(--radius-md)] border-[2px] border-[var(--color-muted)] bg-[var(--color-surface)] px-3 py-2.5 text-sm font-bold text-[var(--color-text)] outline-none transition-shadow focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_35%,transparent)]"
                  >
                    {SOCIAL_PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={social.url}
                    onChange={(e) => setSocial(i, { url: e.target.value })}
                    placeholder={t("editor.socials.url")}
                    className="min-w-0 flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeSocial(i)}
                    aria-label={t("editor.socials.remove")}
                    title={t("editor.socials.remove")}
                    className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border-[2px] border-[var(--color-muted)] bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-sm)] transition-transform hover:scale-[1.05]"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex justify-start">
                <PillButton variant="ghost" onClick={addSocial}>
                  {t("editor.socials.add")}
                </PillButton>
              </div>
            </div>
          </StickerCard>

          <StickerCard hover={false}>
            <h2 className="mb-4 text-xl">{t("editor.section.avatars")}</h2>
            <div className="flex flex-col gap-4">
              {avatarTile(
                t("editor.field.avatarMain"),
                mainPreview ?? (config.avatar ? `/friends/${slug}/${config.avatar}` : null),
                onPickAvatar("main"),
              )}
              {showFull &&
                avatarTile(
                  t("editor.field.avatarPuzzle"),
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
              <h2 className="mb-4 text-xl">{t("editor.section.gift")}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t("editor.field.giftName")}>
                  <Input
                    value={config.gift?.name ?? ""}
                    onChange={(e) => setGift({ name: e.target.value })}
                    placeholder={t("editor.placeholder.giftName")}
                  />
                </Field>
                <Field label={t("editor.field.giftEmoji")}>
                  <Input
                    value={config.gift?.emoji ?? ""}
                    onChange={(e) => setGift({ emoji: e.target.value })}
                    placeholder={t("editor.placeholder.giftEmoji")}
                  />
                </Field>
                <Field label={t("editor.field.giftLottie")}>
                  <Input
                    value={config.gift?.lottie ?? ""}
                    onChange={(e) => setGift({ lottie: e.target.value })}
                    placeholder={t("editor.placeholder.giftLottie")}
                  />
                </Field>
                <Field label={t("editor.field.giftLink")}>
                  <Input
                    value={config.gift?.link ?? ""}
                    onChange={(e) => setGift({ link: e.target.value })}
                    placeholder={t("editor.placeholder.giftLink")}
                  />
                </Field>
              </div>
            </StickerCard>
          )}

          {showFull && (
            <StickerCard hover={false}>
              <h2 className="mb-4 text-xl">{t("editor.section.games")}</h2>
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
                        {t(`editor.game.${id}`)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </StickerCard>
          )}

          <StickerCard hover={false}>
            <h2 className="mb-4 text-xl">{t("editor.section.settings")}</h2>
            <div className="flex flex-col gap-5">
              <Toggle
                checked={config.gamesEnabled ?? true}
                onChange={(v) => set("gamesEnabled", v)}
                label={t("editor.field.gamesEnabled")}
              />

              <Field label={t("editor.field.giftDisplay")}>
                <div className="flex gap-2">
                  {(["current", "all"] as const).map((opt) => (
                    <SegBtn
                      key={opt}
                      active={(config.giftDisplay ?? "current") === opt}
                      onClick={() => set("giftDisplay", opt)}
                    >
                      {t(`editor.giftDisplay.${opt}`)}
                    </SegBtn>
                  ))}
                </div>
              </Field>

              <Field label={t("editor.field.giftLayout")}>
                <div className="flex gap-2">
                  {(["list", "blocks"] as const).map((opt) => (
                    <SegBtn
                      key={opt}
                      active={(config.giftLayout ?? "list") === opt}
                      onClick={() => set("giftLayout", opt)}
                    >
                      {t(`editor.giftLayout.${opt}`)}
                    </SegBtn>
                  ))}
                </div>
              </Field>

              <Field label={t("editor.field.lang")}>
                <div className="flex gap-2">
                  {(["ru", "en"] as const).map((opt) => (
                    <SegBtn
                      key={opt}
                      active={(config.lang ?? "ru") === opt}
                      onClick={() => set("lang", opt)}
                    >
                      {t(`editor.lang.${opt}`)}
                    </SegBtn>
                  ))}
                </div>
              </Field>

              <Field label={t("editor.field.theme")}>
                <div className="flex flex-wrap gap-2">
                  {(["light", "dark", "halloween", "newyear"] as const).map((opt) => (
                    <SegBtn
                      key={opt}
                      active={(config.theme ?? "light") === opt}
                      onClick={() => set("theme", opt)}
                    >
                      {t(`editor.theme.${opt}`)}
                    </SegBtn>
                  ))}
                </div>
              </Field>
            </div>
          </StickerCard>

          <StickerCard hover={false}>
            <h2 className="mb-1 text-xl">
              {t("editor.section.translation", { lang: t(`editor.lang.${targetLang}`) })}
            </h2>
            <p className="mb-4 text-sm text-[var(--color-text-soft)]">
              {t("editor.translation.hint")}
            </p>
            <div className="flex flex-col gap-4">
              <Field label={t("editor.field.name")}>
                <Input
                  value={tName}
                  onChange={(e) => setTName(e.target.value)}
                />
              </Field>

              {showFull && (
                <Field label={t("editor.field.message")}>
                  <Textarea
                    value={tMessage}
                    onChange={(e) => setTMessage(e.target.value)}
                  />
                </Field>
              )}

              {config.bio?.trim() && (
                <Field label={t("editor.field.bio")}>
                  <Textarea
                    value={tBio}
                    onChange={(e) => setTBio(e.target.value)}
                  />
                </Field>
              )}

              {showFull && config.gift?.name?.trim() && (
                <Field label={t("editor.field.giftName.translation")}>
                  <Input
                    value={tGiftName}
                    onChange={(e) => setTGiftName(e.target.value)}
                  />
                </Field>
              )}

              <div className="flex justify-start">
                <PillButton
                  variant="ghost"
                  onClick={onTranslate}
                  disabled={translating}
                >
                  {translating
                    ? t("editor.translation.translating")
                    : t("editor.translation.translate")}
                </PillButton>
              </div>
            </div>
          </StickerCard>

          <div className="flex justify-end">
            <PillButton onClick={onSave} disabled={saving}>
              {saving
                ? t("editor.saving")
                : creating
                  ? t("editor.save.create")
                  : t("editor.save.update")}
            </PillButton>
          </div>
        </div>

        {/* ---- Preview column -------------------------------------------- */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <StickerCard hover={false} className="p-3">
            <p className="mb-2 px-1 text-sm font-bold text-[var(--color-text-soft)]">
              {t("editor.preview.label")}
            </p>
            {previewSlug ? (
              <iframe
                key={previewKey}
                src={`/${previewSlug}`}
                title={t("editor.preview.title")}
                className="h-[360px] w-full rounded-[var(--radius-md)] border-[2px] border-[var(--color-muted)] bg-[var(--color-cream)] lg:h-[560px]"
              />
            ) : (
              <div className="flex h-[360px] flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border-[2px] border-dashed border-[var(--color-muted)] bg-[var(--color-cream)] text-center text-[var(--color-text-soft)] lg:h-[560px]">
                <span className="text-4xl select-none" aria-hidden="true">
                  ✨
                </span>
                <p className="px-6 text-sm">{t("editor.preview.empty")}</p>
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

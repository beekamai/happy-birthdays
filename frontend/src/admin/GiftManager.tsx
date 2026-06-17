import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useLottie } from "lottie-react";

import { isLottie } from "../lib/lottie.ts";
import { ApiError, uploadGiftAnimation, type GiftConfig } from "./adminApi.ts";
import { Field, Input } from "./adminUi.tsx";

/* The owner's gift manager: edit the whole gift COLLECTION (`giftHistory`) and
   pick which entry is the "current"/featured gift (`config.gift`). It is purely
   presentational — every hook lives inside this component (never below the
   editor's early loading/notFound returns, which would break React's hook order
   → #310). The parent owns nothing but the lifted `gifts` + `currentName`.

   Rows reorder by dragging the ⠿ handle with pointer events (mouse + touch),
   reusing the dashboard's pointer-drag + FLIP approach: the dragged row tracks
   the pointer 1:1 via a live translate, the rest slide into place with a
   hand-rolled FLIP, and the order maps straight onto `giftHistory` (the public
   GiftList renders it in that order).

   Lottie previews are expensive, so we mount the `useLottie` HOOK for at most
   one row at a time — the featured one — and show a light static ✓ marker for
   other rows that carry an animation. (The default `<Lottie>` export crashes
   under Vite's CJS interop, React #130; the hook returns a plain element.) */

type TFn = (key: string, vars?: Record<string, string | number>) => string;
type Show = (message: string, kind: "success" | "error") => void;

/* A gift row plus a stable client id. The id never reaches the saved config —
   it only keys React lists, ref maps and the drag hit-test, since gift names can
   be empty or duplicated and so can't serve as a key. */
interface Row {
  uid: string;
  gift: GiftConfig;
}

let uidSeq = 0;
function nextUid(): string {
  uidSeq += 1;
  return `g${uidSeq}`;
}

/* Today as YYYY-MM-DD for seeding a new row's date. */
function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/* Live drag state: the row uid being moved + a translate offset (px) so it
   follows the pointer. The visual order lives in `rows` and is reordered in
   place as the pointer crosses other rows. */
type DragState = { uid: string; dx: number; dy: number };

interface GiftManagerProps {
  /** Page slug — needed to upload animations; empty in create mode (pre-save). */
  slug: string;
  /** The full gift collection (maps to `config.giftHistory`). */
  gifts: GiftConfig[];
  /** Name of the featured gift (maps to `config.gift?.name`). */
  currentName?: string;
  /** Lift the edited collection + featured name back to the editor. */
  onChange: (gifts: GiftConfig[], currentName: string | undefined) => void;
  t: TFn;
  show: Show;
}

/* Inline Lottie preview for the featured row. Isolated so the hook runs only
   when we hold animation data. */
function GiftAnimPreview({ data }: { data: object }) {
  const { View } = useLottie({ animationData: data, loop: true, autoplay: true });
  return (
    <div
      className="size-16 shrink-0 overflow-hidden rounded-[var(--radius-md)] border-[2px] border-[var(--color-surface)] bg-[var(--color-cream)] shadow-[var(--shadow-sm)]"
      style={{ outline: "2px solid var(--color-accent)", outlineOffset: "1px" }}
    >
      {View}
    </div>
  );
}

export function GiftManager({
  slug,
  gifts,
  currentName,
  onChange,
  t,
  show,
}: GiftManagerProps) {
  /* Rows are the live source of truth for the UI; uids stay stable across our
     own edits (which round-trip through the parent) so drag/refs/focus survive.
     We seed from `gifts` once and re-seed only when the editor swaps to a
     different page (`slug` changes) — the parent's `gifts` prop otherwise just
     echoes back our last commit (minus blank-name rows), and re-seeding on that
     would wipe uids and a just-added blank row mid-edit. */
  const [rows, setRows] = useState<Row[]>(() =>
    gifts.map((g) => ({ uid: nextUid(), gift: g })),
  );
  /* Which uid is the featured gift. Seeded from `currentName` (first match,
     mirroring the parent's name-based lookup); thereafter driven by the star
     button. Falls back to the first row when nothing matches. */
  const [currentUid, setCurrentUid] = useState<string | null>(() => {
    const match = rows.find((r) => r.gift.name === currentName);
    return match?.uid ?? rows[0]?.uid ?? null;
  });

  /* Re-seed both on a page swap. Compared against the slug we last seeded from;
     the initial render already seeded, so this only fires on a real change. */
  const seededSlug = useRef(slug);
  if (seededSlug.current !== slug) {
    seededSlug.current = slug;
    const seeded = gifts.map((g) => ({ uid: nextUid(), gift: g }));
    setRows(seeded);
    const match = seeded.find((r) => r.gift.name === currentName);
    setCurrentUid(match?.uid ?? seeded[0]?.uid ?? null);
  }

  /* Decoded Lottie for the featured row's inline preview. */
  const [featuredAnim, setFeaturedAnim] = useState<object | null>(null);
  /* uid currently uploading an animation (disables that row's picker). */
  const [uploadingUid, setUploadingUid] = useState<string | null>(null);
  /* URLs uploaded this session: not whitelisted for serving until the config is
     saved, so the preview effect must not re-fetch (and 404) them. */
  const freshUrls = useRef<Set<string>>(new Set());

  /* ---- Drag (pointer + FLIP) ------------------------------------------- */
  const [drag, setDrag] = useState<DragState | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  const dragRef = useRef<DragState | null>(null);
  const grabRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rowsRef = useRef<Row[]>(rows);
  rowsRef.current = rows;
  const flipPending = useRef(false);

  /* Resolve the featured uid against the live rows: if the starred row was
     deleted, fall back to the first remaining row (or null when empty). */
  const featuredUid =
    currentUid && rows.some((r) => r.uid === currentUid)
      ? currentUid
      : (rows[0]?.uid ?? null);

  /* Push the current rows + featured name up to the editor. Empty-name rows are
     dropped so they never reach the saved config (the editor's normalize also
     guards, but trimming here keeps the lifted state clean). */
  const commit = (nextRows: Row[], nextFeaturedUid: string | null) => {
    setRows(nextRows);
    setCurrentUid(nextFeaturedUid);
    const cleaned = nextRows
      .map((r) => r.gift)
      .filter((g) => g.name.trim());
    const featured = nextRows.find((r) => r.uid === nextFeaturedUid)?.gift;
    const featuredName =
      featured && featured.name.trim()
        ? featured.name
        : (cleaned[0]?.name ?? undefined);
    onChange(cleaned, featuredName);
  };

  const patchRow = (uid: string, patch: Partial<GiftConfig>) => {
    const next = rowsRef.current.map((r) =>
      r.uid === uid ? { ...r, gift: { ...r.gift, ...patch } } : r,
    );
    commit(next, featuredUid);
  };

  const addRow = () => {
    const row: Row = {
      uid: nextUid(),
      gift: { name: "", emoji: "🎁", date: today() },
    };
    /* First gift becomes featured by default. */
    const next = [...rowsRef.current, row];
    commit(next, rowsRef.current.length === 0 ? row.uid : featuredUid);
  };

  const removeRow = (uid: string) => {
    const next = rowsRef.current.filter((r) => r.uid !== uid);
    const nextFeatured =
      uid === featuredUid ? (next[0]?.uid ?? null) : featuredUid;
    commit(next, nextFeatured);
  };

  const makeCurrent = (uid: string) => commit(rowsRef.current, uid);

  /* ---- Featured animation preview -------------------------------------- */
  const featuredLottie =
    rows.find((r) => r.uid === featuredUid)?.gift.lottie ?? "";
  useEffect(() => {
    /* Just uploaded this session — its bytes don't serve until save, but we
       already showed its preview from the upload response; skip the re-fetch. */
    if (freshUrls.current.has(featuredLottie)) return;
    if (!/^(https?:\/\/|\/)/.test(featuredLottie)) {
      setFeaturedAnim(null);
      return;
    }
    let alive = true;
    fetch(featuredLottie)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: unknown) => {
        if (alive) setFeaturedAnim(isLottie(json) ? (json as object) : null);
      })
      .catch(() => {
        if (alive) setFeaturedAnim(null);
      });
    return () => {
      alive = false;
    };
  }, [featuredLottie]);

  /* ---- Animation upload ------------------------------------------------- */
  const onPickAnimation =
    (uid: string) => async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ""; /* allow re-picking the same file */
      if (!file || !slug) return;

      setUploadingUid(uid);
      try {
        const res = await uploadGiftAnimation(slug, file);
        freshUrls.current.add(res.url);
        patchRow(uid, { lottie: res.url });
        if (uid === featuredUid) setFeaturedAnim(res.animation);
        show(t("editor.toast.giftAnimUploaded"), "success");
      } catch (err) {
        const key =
          err instanceof ApiError && err.status === 413
            ? "editor.toast.giftAnimTooBig"
            : err instanceof ApiError && err.status === 422
              ? "editor.toast.giftAnimInvalid"
              : "editor.toast.giftAnimFailed";
        show(t(key), "error");
      } finally {
        setUploadingUid(null);
      }
    };

  /* ---- FLIP play (neighbours glide on reorder) ------------------------- */
  useLayoutEffect(() => {
    if (!flipPending.current) return;
    flipPending.current = false;
    const refs = rowRefs.current;
    const prev = prevRects.current;
    const draggedUid = dragRef.current?.uid;
    /* Rebase the dragged row's grab origin by its own slot delta so its live
       translate stays continuous after its slot moved. */
    if (draggedUid) {
      const el = refs.get(draggedUid);
      const before = prev.get(draggedUid);
      if (el && before) {
        const prevTransform = el.style.transform;
        el.style.transform = "";
        const after = el.getBoundingClientRect();
        el.style.transform = prevTransform;
        grabRef.current.x += after.left - before.left;
        grabRef.current.y += after.top - before.top;
      }
    }
    const moved: HTMLDivElement[] = [];
    refs.forEach((el, uid) => {
      if (uid === draggedUid) return;
      const before = prev.get(uid);
      if (!before) return;
      const after = el.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (dx === 0 && dy === 0) return;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      moved.push(el);
    });
    if (moved.length === 0) return;
    requestAnimationFrame(() => {
      for (const el of moved) {
        el.style.transition = "transform 200ms ease";
        el.style.transform = "";
      }
    });
  });

  /* Drag handlers held in a ref so the window listeners bound on pointerdown are
     the same objects removed on pointerup/unmount, yet read the latest state. */
  const handlers = useRef({
    overUid(x: number, y: number, draggedUid: string): string | null {
      let best: string | null = null;
      rowRefs.current.forEach((el, uid) => {
        if (uid === draggedUid) return;
        const r = el.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          best = uid;
        }
      });
      return best;
    },
    measure() {
      const draggedUid = dragRef.current?.uid;
      prevRects.current.clear();
      rowRefs.current.forEach((el, uid) => {
        if (uid === draggedUid) {
          const prevTransform = el.style.transform;
          el.style.transform = "";
          prevRects.current.set(uid, el.getBoundingClientRect());
          el.style.transform = prevTransform;
        } else {
          prevRects.current.set(uid, el.getBoundingClientRect());
        }
      });
    },
    onMove(e: PointerEvent) {
      e.preventDefault();
      const cur = dragRef.current;
      const list = rowsRef.current;
      if (!cur) return;
      const dx = e.clientX - grabRef.current.x;
      const dy = e.clientY - grabRef.current.y;
      cur.dx = dx;
      cur.dy = dy;
      setDrag({ uid: cur.uid, dx, dy });

      const over = handlers.current.overUid(e.clientX, e.clientY, cur.uid);
      if (!over || over === cur.uid) return;
      const fromIdx = list.findIndex((r) => r.uid === cur.uid);
      const overIdx = list.findIndex((r) => r.uid === over);
      if (fromIdx < 0 || overIdx < 0 || fromIdx === overIdx) return;
      handlers.current.measure();
      flipPending.current = true;
      const next = [...list];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(overIdx, 0, moved);
      /* Reorder is a real edit — lift it so giftHistory order persists. */
      commitRef.current(next, currentUidRef.current);
    },
    onUp() {
      const h = handlers.current;
      window.removeEventListener("pointermove", h.onMove);
      window.removeEventListener("pointerup", h.onUp);
      window.removeEventListener("pointercancel", h.onUp);
      dragRef.current = null;
      setDrag(null);
    },
  });

  /* Mutable mirrors so the (once-bound) drag handlers call the latest commit and
     read the live featured uid without re-binding listeners each render. */
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const currentUidRef = useRef(featuredUid);
  currentUidRef.current = featuredUid;

  const startDrag = (e: React.PointerEvent, uid: string) => {
    e.preventDefault();
    grabRef.current = { x: e.clientX, y: e.clientY };
    const state: DragState = { uid, dx: 0, dy: 0 };
    dragRef.current = state;
    setDrag(state);
    const h = handlers.current;
    window.addEventListener("pointermove", h.onMove, { passive: false });
    window.addEventListener("pointerup", h.onUp);
    window.addEventListener("pointercancel", h.onUp);
  };

  /* Safety net: drop live listeners if we unmount mid-drag. */
  useEffect(() => {
    const h = handlers.current;
    return () => {
      window.removeEventListener("pointermove", h.onMove);
      window.removeEventListener("pointerup", h.onUp);
      window.removeEventListener("pointercancel", h.onUp);
    };
  }, []);

  /* ---- Render ----------------------------------------------------------- */
  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-md)] border-[2px] border-dashed border-[var(--color-muted)] bg-[var(--color-cream)] px-6 py-8 text-center text-[var(--color-text-soft)]">
          <span className="text-4xl select-none" aria-hidden="true">
            🎁
          </span>
          <p className="text-sm">{t("editor.gift.empty")}</p>
        </div>
        <div className="flex justify-start">
          <AddButton onClick={addRow} label={t("editor.gift.add")} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {rows.length > 1 && (
        <p className="text-xs text-[var(--color-text-soft)]">
          {t("editor.gift.reorderHint")}
        </p>
      )}

      <div className="relative flex flex-col gap-3">
        {rows.map((row) => {
          const isDragged = !!drag && drag.uid === row.uid;
          const isFeatured = row.uid === featuredUid;
          const hasAnim = !!row.gift.lottie;
          return (
            <div
              key={row.uid}
              ref={(el) => {
                if (el) rowRefs.current.set(row.uid, el);
                else rowRefs.current.delete(row.uid);
              }}
              className="relative"
              style={
                isDragged && drag
                  ? {
                      zIndex: 10,
                      transform: `translate(${drag.dx}px, ${drag.dy}px)`,
                      transition: "none",
                      touchAction: "none",
                    }
                  : undefined
              }
            >
              <div
                className={
                  "rounded-[var(--radius-md)] border-[2px] bg-[var(--color-surface)] p-3 transition-[transform,opacity,box-shadow] " +
                  (isDragged ? "scale-[1.01] opacity-95 shadow-[var(--shadow-lg)]" : "")
                }
                style={{
                  borderColor: isFeatured
                    ? "var(--color-accent)"
                    : "var(--color-muted)",
                  backgroundColor: isFeatured
                    ? "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))"
                    : "var(--color-surface)",
                }}
              >
                {/* Header: drag handle, featured badge, star + delete actions. */}
                <div className="mb-3 flex items-center gap-2">
                  <span
                    onPointerDown={(e) => startDrag(e, row.uid)}
                    title={t("editor.gift.reorderHint")}
                    aria-hidden="true"
                    className="-m-1 cursor-grab touch-none p-1 text-lg leading-none text-[var(--color-text-soft)] select-none active:cursor-grabbing"
                  >
                    ⠿
                  </span>

                  {isFeatured ? (
                    <span className="inline-flex items-center gap-1 rounded-[var(--radius-full)] border-[2px] border-[var(--color-accent)] px-2.5 py-0.5 text-xs font-bold text-[var(--color-text)]">
                      ★ {t("editor.gift.current")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => makeCurrent(row.uid)}
                      title={t("editor.gift.makeCurrent")}
                      className="inline-flex min-h-[28px] items-center gap-1 rounded-[var(--radius-full)] border-[2px] border-[var(--color-muted)] px-2.5 py-0.5 text-xs font-bold text-[var(--color-text-soft)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
                    >
                      ☆ {t("editor.gift.makeCurrent")}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => removeRow(row.uid)}
                    aria-label={t("editor.gift.delete")}
                    title={t("editor.gift.delete")}
                    className="ml-auto flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border-[2px] border-[var(--color-muted)] bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-sm)] transition-transform hover:scale-[1.05]"
                  >
                    🗑
                  </button>
                </div>

                <div className="flex items-start gap-3">
                  {/* Animation thumb: live preview for the featured row, a light
                      static marker otherwise (one useLottie max → no lag). */}
                  {isFeatured && featuredAnim ? (
                    <GiftAnimPreview data={featuredAnim} />
                  ) : (
                    <div className="flex size-16 shrink-0 items-center justify-center rounded-[var(--radius-md)] border-[2px] border-[var(--color-surface)] bg-[var(--color-cream)] text-2xl shadow-[var(--shadow-sm)] select-none">
                      {hasAnim ? "🎬" : (row.gift.emoji || "🎁")}
                    </div>
                  )}

                  <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[5rem_minmax(0,1fr)]">
                    <Field label={t("editor.field.giftEmoji")}>
                      <Input
                        value={row.gift.emoji ?? ""}
                        onChange={(e) => patchRow(row.uid, { emoji: e.target.value })}
                        placeholder={t("editor.placeholder.giftEmoji")}
                      />
                    </Field>
                    <Field label={t("editor.field.giftName")}>
                      <Input
                        value={row.gift.name}
                        onChange={(e) => patchRow(row.uid, { name: e.target.value })}
                        placeholder={t("editor.placeholder.giftName")}
                      />
                    </Field>
                    <Field label={t("editor.field.giftLink")} className="sm:col-span-2">
                      <Input
                        value={row.gift.link ?? ""}
                        onChange={(e) => patchRow(row.uid, { link: e.target.value })}
                        placeholder={t("editor.placeholder.giftLink")}
                      />
                    </Field>
                    <Field label={t("editor.gift.date")}>
                      <Input
                        type="date"
                        value={row.gift.date ?? ""}
                        onChange={(e) => patchRow(row.uid, { date: e.target.value })}
                      />
                    </Field>
                    <Field
                      label={t("editor.field.giftAnim")}
                      className="sm:col-span-1"
                    >
                      <label
                        className={`cursor-pointer ${
                          !slug ? "pointer-events-none opacity-50" : ""
                        }`}
                      >
                        <span className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-full)] border-[2px] border-[var(--color-muted)] bg-[var(--color-surface)] px-4 py-2 text-sm font-bold text-[var(--color-text)] shadow-[var(--shadow-sm)] transition-transform hover:scale-[1.03]">
                          {uploadingUid === row.uid ? (
                            <span className="animate-bob select-none" aria-hidden="true">
                              🍜
                            </span>
                          ) : (
                            <>
                              {hasAnim ? "✓ " : "🎬 "}
                              {t("editor.giftAnim.pick")}
                            </>
                          )}
                        </span>
                        <input
                          type="file"
                          accept=".tgs,.json,.lottie,application/json"
                          className="hidden"
                          disabled={!slug || uploadingUid === row.uid}
                          onChange={onPickAnimation(row.uid)}
                        />
                      </label>
                    </Field>
                  </div>
                </div>

                {!slug && (
                  <p className="mt-2 text-xs text-[var(--color-text-soft)]">
                    {t("editor.giftAnim.needSave")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-start">
        <AddButton onClick={addRow} label={t("editor.gift.add")} />
      </div>
    </div>
  );
}

/* Plump "+ add gift" button — ghost-styled to sit quietly under the list. */
function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-full)] border-[2px] border-dashed border-[var(--color-muted)] bg-[var(--color-surface)] px-5 py-2.5 font-bold text-[var(--color-text)] shadow-[var(--shadow-sm)] transition-transform duration-200 hover:scale-[1.03]"
    >
      {label}
    </button>
  );
}

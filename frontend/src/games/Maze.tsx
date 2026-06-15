import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";

import type { GameProps } from "./game-types.ts";
import { playSound } from "../lib/sound.ts";

/* "Path to friendship" — a perfect maze (recursive-backtracker DFS). The owner's
   avatar is the player; the friend's avatar is the goal. Walls are drawn as cell
   borders. Arrow keys + touch swipe move, wall-checked. Both avatars are
   preloaded+decoded before movement is enabled. On reaching the goal the two
   avatars converge to center with hearts + confetti, then we finish. */

interface Cell {
  /* open passages from this cell */
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

interface Maze {
  size: number;
  cells: Cell[]; /* row-major, length size*size */
}

const idx = (r: number, c: number, size: number) => r * size + c;

/** Build a perfect maze via iterative recursive-backtracker DFS. */
function generateMaze(size: number): Maze {
  const cells: Cell[] = Array.from({ length: size * size }, () => ({
    top: false,
    right: false,
    bottom: false,
    left: false,
  }));
  const visited = new Array<boolean>(size * size).fill(false);
  const stack: number[] = [0];
  visited[0] = true;

  while (stack.length) {
    const cur = stack[stack.length - 1]!;
    const r = Math.floor(cur / size);
    const c = cur % size;

    const candidates: { pos: number; dir: keyof Cell; opp: keyof Cell }[] = [];
    if (r > 0 && !visited[idx(r - 1, c, size)])
      candidates.push({ pos: idx(r - 1, c, size), dir: "top", opp: "bottom" });
    if (r < size - 1 && !visited[idx(r + 1, c, size)])
      candidates.push({ pos: idx(r + 1, c, size), dir: "bottom", opp: "top" });
    if (c > 0 && !visited[idx(r, c - 1, size)])
      candidates.push({ pos: idx(r, c - 1, size), dir: "left", opp: "right" });
    if (c < size - 1 && !visited[idx(r, c + 1, size)])
      candidates.push({ pos: idx(r, c + 1, size), dir: "right", opp: "left" });

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }
    const next = candidates[Math.floor(Math.random() * candidates.length)]!;
    cells[cur]![next.dir] = true;
    cells[next.pos]![next.opp] = true;
    visited[next.pos] = true;
    stack.push(next.pos);
  }

  return { size, cells };
}

/** Preload + decode an image; resolves even on error so movement isn't blocked. */
function preload(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => img.decode().then(() => resolve(), () => resolve());
    img.onerror = () => resolve();
    img.src = src;
  });
}

export default function Maze({ friend, site, onFinish, config }: GameProps) {
  const rawSize = Number((config as { size?: number } | undefined)?.size ?? 9);
  const size = Math.max(5, Math.min(13, Number.isFinite(rawSize) ? rawSize : 9));

  const maze = useMemo(() => generateMaze(size), [size]);

  const [pos, setPos] = useState({ r: 0, c: 0 });
  const [ready, setReady] = useState(false);
  const [met, setMet] = useState(false);
  const startRef = useRef(Date.now());
  const finishedRef = useRef(false);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const goal = { r: size - 1, c: size - 1 };
  const ownerAvatar = site?.owner.avatarUrl;
  const friendAvatar = friend.avatarUrl;

  /* preload both avatars before enabling movement */
  useEffect(() => {
    let alive = true;
    const srcs = [friendAvatar, ownerAvatar].filter(Boolean) as string[];
    Promise.all(srcs.map(preload)).then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [friendAvatar, ownerAvatar]);

  function tryMove(dr: number, dc: number) {
    if (!ready || finishedRef.current) return;
    setPos((p) => {
      const cell = maze.cells[idx(p.r, p.c, size)]!;
      if (dr === -1 && !cell.top) return p;
      if (dr === 1 && !cell.bottom) return p;
      if (dc === -1 && !cell.left) return p;
      if (dc === 1 && !cell.right) return p;
      const nr = p.r + dr;
      const nc = p.c + dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) return p;
      playSound("step");
      return { r: nr, c: nc };
    });
  }

  /* keyboard */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };
      const m = map[e.key];
      if (m) {
        e.preventDefault();
        tryMove(m[0], m[1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    /* rebind when readiness/maze/size change; tryMove reads latest via setPos */
  }, [ready, maze, size]);

  /* reaching goal → cutscene → finish */
  useEffect(() => {
    if (finishedRef.current) return;
    if (pos.r === goal.r && pos.c === goal.c) {
      finishedRef.current = true;
      setMet(true);
      confetti({ particleCount: 160, spread: 90, origin: { y: 0.5 } });
      const durationMs = Date.now() - startRef.current;
      const t = setTimeout(() => {
        onFinish({ score: 1000, durationMs, won: true });
      }, 1800);
      return () => clearTimeout(t);
    }
  }, [pos, goal.r, goal.c, onFinish]);

  /* touch swipe */
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    if (t) touchRef.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchRef.current;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    touchRef.current = null;
    if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return;
    if (Math.abs(dx) > Math.abs(dy)) tryMove(0, dx > 0 ? 1 : -1);
    else tryMove(dy > 0 ? 1 : -1, 0);
  }

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center gap-3 p-4"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: "none" }}
    >
      {!ready && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--color-cream)]/80">
          <span className="animate-bob text-lg font-bold text-[var(--color-text)]">
            готовим тропинку…
          </span>
        </div>
      )}

      <div
        className="grid aspect-square w-full max-w-[min(80vh,460px)] overflow-hidden rounded-[var(--radius-lg)] border-[4px] border-white bg-[var(--color-surface)] shadow-[var(--shadow-md)]"
        style={{
          gridTemplateColumns: `repeat(${size}, 1fr)`,
          outline: "3px solid var(--color-accent)",
          outlineOffset: "2px",
        }}
      >
        {maze.cells.map((cell, i) => {
          const r = Math.floor(i / size);
          const c = i % size;
          const isPlayer = r === pos.r && c === pos.c;
          const isGoal = r === goal.r && c === goal.c;
          const wall = "2px solid var(--color-text-soft)";
          return (
            <div
              key={i}
              className="relative flex items-center justify-center"
              style={{
                borderTop: cell.top ? "none" : wall,
                borderRight: cell.right ? "none" : wall,
                borderBottom: cell.bottom ? "none" : wall,
                borderLeft: cell.left ? "none" : wall,
              }}
            >
              {isGoal && !isPlayer && (
                <Avatar src={friendAvatar} alt={friend.displayName} fallback="🎉" />
              )}
              {isPlayer && !met && (
                <Avatar src={ownerAvatar} alt="player" fallback="🚶" />
              )}
            </div>
          );
        })}
      </div>

      <p className="text-sm text-[var(--color-text-soft)]">
        Стрелки или свайп — дойди до друга 🗺️
      </p>

      {/* meeting cutscene */}
      <AnimatePresence>
        {met && (
          <motion.div
            className="absolute inset-0 z-30 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: "rgba(255,247,237,0.85)" }}
          >
            <div className="relative flex items-center justify-center">
              <motion.div
                initial={{ x: -90, rotate: -8 }}
                animate={{ x: -26, rotate: 0 }}
                transition={{ type: "spring", stiffness: 120, damping: 14 }}
              >
                <Avatar src={ownerAvatar} alt="player" fallback="🚶" big />
              </motion.div>
              <motion.div
                initial={{ x: 90, rotate: 8 }}
                animate={{ x: 26, rotate: 0 }}
                transition={{ type: "spring", stiffness: 120, damping: 14 }}
              >
                <Avatar src={friendAvatar} alt={friend.displayName} big />
              </motion.div>
              {["❤️", "❤️", "❤️"].map((h, i) => (
                <motion.span
                  key={i}
                  className="absolute text-2xl"
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: -40 - i * 14, opacity: [0, 1, 0] }}
                  transition={{ duration: 1.4, delay: 0.3 + i * 0.18, repeat: Infinity }}
                  style={{ left: `${40 + i * 10}%` }}
                >
                  {h}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Rounded avatar with an accent ring; falls back to an emoji glyph. */
function Avatar({
  src,
  alt,
  fallback = "🙂",
  big = false,
}: {
  src?: string;
  alt: string;
  fallback?: string;
  big?: boolean;
}) {
  const cls = big ? "size-16" : "size-[80%] max-h-9 max-w-9";
  if (!src) {
    return <span className={big ? "text-4xl" : "text-xl"}>{fallback}</span>;
  }
  return (
    <img
      src={src}
      alt={alt}
      className={`${cls} rounded-full border-2 border-white object-cover`}
      style={{ outline: "2px solid var(--color-accent)", outlineOffset: "1px" }}
    />
  );
}

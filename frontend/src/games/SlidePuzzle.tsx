import { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";

import type { GameProps } from "./game-types.ts";
import { playSound } from "../lib/sound.ts";
import { useT } from "../lib/i18n.ts";

/* A 3×3 sliding puzzle cut from the friend's puzzle/avatar image. The board is
   an array of tile VALUES 0..8 indexed by position; value 8 is the empty slot.
   Each tile shows a 300%×300% slice positioned by its value, so a solved board
   reassembles the picture. Shuffle = N legal random moves (always solvable).

   Helpers for the stuck player: a "peek" button overlays the full picture, and
   a "hint" button BFS-solves from the current board and pulses the tile to move. */

const N = 3;
const EMPTY = N * N - 1; /* value 8 */
const SHUFFLE_MOVES = 40;

/** Positions adjacent to `pos` on an N×N grid. */
function neighbors(pos: number): number[] {
  const r = Math.floor(pos / N);
  const c = pos % N;
  const out: number[] = [];
  if (r > 0) out.push(pos - N);
  if (r < N - 1) out.push(pos + N);
  if (c > 0) out.push(pos - 1);
  if (c < N - 1) out.push(pos + 1);
  return out;
}

/** A solved board: value === position. */
function solvedBoard(): number[] {
  return Array.from({ length: N * N }, (_, i) => i);
}

/** Shuffle by `moves` legal slides, never immediately undoing the last move. */
function shuffleBoard(moves: number): number[] {
  const board = solvedBoard();
  let emptyPos = board.indexOf(EMPTY);
  let prev = -1;
  for (let i = 0; i < moves; i++) {
    const opts = neighbors(emptyPos).filter((p) => p !== prev);
    const pick = opts[Math.floor(Math.random() * opts.length)]!;
    [board[emptyPos], board[pick]] = [board[pick]!, board[emptyPos]!];
    prev = emptyPos;
    emptyPos = pick;
  }
  return board;
}

function isSolved(board: number[]): boolean {
  return board.every((v, i) => v === i);
}

/* BFS from the current board to the solved board; returns the POSITION of the
   tile to slide next on a shortest path (or null if already solved). The 3×3
   state space is tiny (≤181440), so plain BFS resolves instantly. */
function hintMove(board: number[]): number | null {
  const target = solvedBoard().join(",");
  if (board.join(",") === target) return null;

  const visited = new Set<string>([board.join(",")]);
  const queue: { b: number[]; first: number }[] = [];

  const empty0 = board.indexOf(EMPTY);
  for (const pos of neighbors(empty0)) {
    const nb = board.slice();
    [nb[pos], nb[empty0]] = [nb[empty0]!, nb[pos]!];
    const key = nb.join(",");
    if (!visited.has(key)) {
      visited.add(key);
      queue.push({ b: nb, first: pos });
    }
  }

  while (queue.length) {
    const { b, first } = queue.shift()!;
    if (b.join(",") === target) return first;
    const empty = b.indexOf(EMPTY);
    for (const pos of neighbors(empty)) {
      const nb = b.slice();
      [nb[pos], nb[empty]] = [nb[empty]!, nb[pos]!];
      const key = nb.join(",");
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ b: nb, first });
      }
    }
  }
  return null;
}

export default function SlidePuzzle({ friend, onFinish }: GameProps) {
  const { t } = useT();
  const image = friend.puzzleAvatarUrl ?? friend.avatarUrl;

  const [board, setBoard] = useState<number[]>(() => shuffleBoard(SHUFFLE_MOVES));
  const [moves, setMoves] = useState(0);
  const [peek, setPeek] = useState(false);
  const [hintPos, setHintPos] = useState<number | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const startRef = useRef(Date.now());
  const finishedRef = useRef(false);

  const solved = useMemo(() => isSolved(board), [board]);

  /* tap a tile adjacent to the empty slot → swap them */
  function tap(pos: number) {
    if (finishedRef.current) return;
    const emptyPos = board.indexOf(EMPTY);
    if (!neighbors(pos).includes(emptyPos)) return;
    const next = board.slice();
    [next[pos], next[emptyPos]] = [next[emptyPos]!, next[pos]!];
    setBoard(next);
    setMoves((m) => m + 1);
    setHintPos(null);
    playSound("tap");
  }

  function showHint() {
    if (finishedRef.current) return;
    const pos = hintMove(board);
    if (pos === null) return;
    /* Reset then re-set so the pulse restarts even if it's the same tile as the
       previous hint (otherwise React skips the no-op state update). */
    setHintPos(null);
    requestAnimationFrame(() => setHintPos(pos));
    setHintsUsed((h) => h + 1);
    playSound("hint");
  }

  useEffect(() => {
    if (!solved || finishedRef.current || moves === 0) return;
    finishedRef.current = true;
    confetti({ particleCount: 140, spread: 75, origin: { y: 0.6 } });
    /* Score rewards few moves; hints cost a little so they're a help, not a cheat. */
    const score = Math.max(50, 1000 - moves * 10 - hintsUsed * 20);
    onFinish({ score, durationMs: Date.now() - startRef.current, won: true });
  }, [solved, moves, hintsUsed, onFinish]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-4">
      <div className="flex items-center gap-3">
        <span className="rounded-[var(--radius-full)] bg-white/85 px-4 py-1.5 font-bold text-[var(--color-text)] shadow-[var(--shadow-sm)]">
          {t("puzzle.moves", { n: moves })}
        </span>
      </div>

      <div
        className="relative grid aspect-square w-full max-w-[min(70vh,420px)] gap-1 rounded-[var(--radius-lg)] border-[4px] border-white bg-[var(--color-muted)] p-1 shadow-[var(--shadow-md)]"
        style={{
          gridTemplateColumns: `repeat(${N}, 1fr)`,
          touchAction: "manipulation",
          outline: "3px solid var(--color-accent)",
          outlineOffset: "2px",
        }}
      >
        {board.map((value, pos) => {
          const isEmpty = value === EMPTY;
          const row = Math.floor(value / N);
          const col = value % N;
          const isHint = pos === hintPos;
          return (
            <button
              key={pos}
              type="button"
              onClick={() => tap(pos)}
              aria-label={isEmpty ? t("puzzle.empty") : t("puzzle.piece", { n: value + 1 })}
              className={`aspect-square w-full rounded-[var(--radius-sm)] transition-[opacity] duration-150 ${
                isHint ? "animate-pulse-hint" : ""
              }`}
              style={{
                cursor: isEmpty ? "default" : "pointer",
                backgroundColor: isEmpty ? "transparent" : "#fff",
                backgroundImage: isEmpty ? "none" : `url(${image})`,
                backgroundSize: "300% 300%",
                backgroundPosition: `${col * 50}% ${row * 50}%`,
                boxShadow: isHint
                  ? undefined
                  : isEmpty
                    ? "none"
                    : "inset 0 0 0 1px rgba(255,255,255,0.6)",
              }}
            />
          );
        })}

        {/* Peek overlay — the full target picture faded over the board. */}
        {peek && (
          <div
            className="pointer-events-none absolute inset-1 rounded-[var(--radius-md)]"
            style={{
              backgroundImage: `url(${image})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: 0.82,
            }}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onPointerDown={() => setPeek(true)}
          onPointerUp={() => setPeek(false)}
          onPointerLeave={() => setPeek(false)}
          className="rounded-[var(--radius-full)] border-[2px] border-[var(--color-muted)] bg-[var(--color-surface)] px-4 py-2 font-bold text-[var(--color-text)] shadow-[var(--shadow-sm)] transition-transform duration-200 hover:scale-105 active:scale-95"
        >
          {t("puzzle.showPicture")}
        </button>
        <button
          type="button"
          onClick={showHint}
          className="rounded-[var(--radius-full)] bg-[var(--color-accent)] px-4 py-2 font-bold text-white shadow-[var(--shadow-sm)] transition-transform duration-200 hover:scale-105 active:scale-95"
        >
          {t("puzzle.hint")}
        </button>
      </div>

      <p className="text-sm text-[var(--color-text-soft)]">
        {t("puzzle.tip")}
      </p>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";

import type { GameProps } from "./game-types.ts";
import {
  feedFoxConfig,
  type CatcherConfig,
  type CatcherItem,
} from "./catcher-configs.ts";
import { useGameLoop } from "./useGameLoop.ts";
import { playSound } from "../lib/sound.ts";

/* One DOM-based catch engine, configured by `config` (feed-fox / catch-stars).
   Falling items are real DOM nodes whose `transform` is mutated directly in the
   loop — React state is touched only for the HUD (score + time-left), never per
   frame. The basket tracks pointer/touch along the bottom of the arena. */

interface FallingItem {
  el: HTMLDivElement;
  x: number; /* px, left edge */
  y: number; /* px, top edge */
  points: number;
  alive: boolean;
}

const ITEM_SIZE = 44; /* px, both item + basket footprint for collision */
const BASKET_SIZE = 64;

/** Pick an item by weight from the config. */
function pickItem(items: CatcherItem[]): CatcherItem {
  const total = items.reduce((s, it) => s + it.weight, 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it;
  }
  return items[0]!;
}

export default function Catcher({ config, onFinish }: GameProps) {
  const cfg = (config as CatcherConfig | undefined) ?? feedFoxConfig;

  const arenaRef = useRef<HTMLDivElement>(null);
  const basketRef = useRef<HTMLDivElement>(null);

  /* All mutable game state lives in refs — no re-render per frame. */
  const itemsRef = useRef<FallingItem[]>([]);
  const basketXRef = useRef(0); /* center x of basket, px */
  const sinceSpawnRef = useRef(0);
  const scoreRef = useRef(0);
  const finishedRef = useRef(false);

  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(Math.ceil(cfg.duration));

  /* ---- basket follows pointer / touch ------------------------------------ */
  useEffect(() => {
    const arena = arenaRef.current;
    if (!arena) return;

    const move = (clientX: number) => {
      const rect = arena.getBoundingClientRect();
      const x = clamp(clientX - rect.left, BASKET_SIZE / 2, rect.width - BASKET_SIZE / 2);
      basketXRef.current = x;
      const basket = basketRef.current;
      if (basket) basket.style.transform = `translateX(${x - BASKET_SIZE / 2}px)`;
    };

    /* Start centered. */
    const rect = arena.getBoundingClientRect();
    basketXRef.current = rect.width / 2;
    const basket = basketRef.current;
    if (basket) basket.style.transform = `translateX(${rect.width / 2 - BASKET_SIZE / 2}px)`;

    const onPointer = (e: PointerEvent) => move(e.clientX);
    const onTouch = (e: TouchEvent) => {
      if (e.touches[0]) move(e.touches[0].clientX);
    };
    arena.addEventListener("pointermove", onPointer);
    arena.addEventListener("touchmove", onTouch, { passive: true });
    return () => {
      arena.removeEventListener("pointermove", onPointer);
      arena.removeEventListener("touchmove", onTouch);
    };
  }, []);

  /* ---- the loop ----------------------------------------------------------- */
  useGameLoop((dt, elapsed) => {
    const arena = arenaRef.current;
    if (!arena || finishedRef.current) return;

    const rect = arena.getBoundingClientRect();
    const t = Math.min(elapsed / cfg.duration, 1);
    const speed = cfg.speedStartPx + (cfg.speedEndPx - cfg.speedStartPx) * t;

    /* spawn */
    sinceSpawnRef.current += dt;
    if (sinceSpawnRef.current >= cfg.spawnEverySec) {
      sinceSpawnRef.current = 0;
      spawn(arena, rect.width);
    }

    /* move + collide */
    const basketX = basketXRef.current;
    const basketTop = rect.height - BASKET_SIZE - 8;
    const half = BASKET_SIZE / 2;
    let scoreChanged = false;

    for (const item of itemsRef.current) {
      if (!item.alive) continue;
      item.y += speed * dt;
      item.el.style.transform = `translate(${item.x}px, ${item.y}px)`;

      const itemCx = item.x + ITEM_SIZE / 2;
      const inBand =
        item.y + ITEM_SIZE >= basketTop && item.y <= basketTop + BASKET_SIZE;
      if (inBand && Math.abs(itemCx - basketX) <= half) {
        item.alive = false;
        scoreRef.current += item.points;
        scoreChanged = true;
        playSound(item.points >= 0 ? "catch" : "miss");
        item.el.remove();
      } else if (item.y > rect.height) {
        item.alive = false;
        item.el.remove();
      }
    }

    itemsRef.current = itemsRef.current.filter((i) => i.alive);
    if (scoreChanged) setScore(scoreRef.current);

    const left = Math.max(0, Math.ceil(cfg.duration - elapsed));
    setTimeLeft((prev) => (prev !== left ? left : prev));

    if (elapsed >= cfg.duration) {
      finishedRef.current = true;
      onFinish({
        score: scoreRef.current,
        durationMs: cfg.duration * 1000,
        won: scoreRef.current > 0,
      });
    }
  });

  /* ---- helpers ------------------------------------------------------------ */
  function spawn(arena: HTMLDivElement, width: number) {
    const def = pickItem(cfg.items);
    const el = document.createElement("div");
    el.textContent = def.emoji;
    el.style.cssText =
      "position:absolute;top:0;left:0;width:44px;height:44px;display:flex;" +
      "align-items:center;justify-content:center;font-size:34px;will-change:transform;" +
      "user-select:none;pointer-events:none;";
    const x = Math.random() * Math.max(0, width - ITEM_SIZE);
    el.style.transform = `translate(${x}px, -50px)`;
    arena.appendChild(el);
    itemsRef.current.push({ el, x, y: -50, points: def.points, alive: true });
  }

  /* ---- cleanup all nodes on unmount -------------------------------------- */
  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) item.el.remove();
      itemsRef.current = [];
    };
  }, []);

  return (
    <div
      ref={arenaRef}
      className="relative h-full w-full overflow-hidden rounded-[var(--radius-lg)] select-none"
      style={{ background: cfg.background, touchAction: "none" }}
    >
      {/* HUD */}
      <div className="pointer-events-none absolute top-3 left-3 z-10 rounded-[var(--radius-full)] bg-white/85 px-4 py-1.5 font-bold text-[var(--color-text)] shadow-[var(--shadow-sm)]">
        {score} 🏅
      </div>
      <div className="pointer-events-none absolute top-3 right-3 z-10 rounded-[var(--radius-full)] bg-white/85 px-4 py-1.5 font-bold text-[var(--color-text)] shadow-[var(--shadow-sm)]">
        {timeLeft}с ⏳
      </div>

      {/* basket */}
      <div
        ref={basketRef}
        className="pointer-events-none absolute"
        style={{
          bottom: "8px",
          left: 0,
          width: `${BASKET_SIZE}px`,
          height: `${BASKET_SIZE}px`,
          fontSize: "48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          willChange: "transform",
        }}
      >
        {cfg.basketEmoji}
      </div>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { useHappiness } from "./useHappiness.ts";
import { playSound } from "../lib/sound.ts";
import { useT } from "../lib/i18n.ts";

/* Pet glyph footprint and the gap kept from the viewport edges. */
const PET_SIZE = 56;
const MARGIN = 16;
const MAX_HEARTS = 6;
const HEART_TTL = 1100;

interface Heart {
  id: number;
  x: number;
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/* Drag box relative to the bottom-right anchor: it may travel up and left. */
function computeBox(): Box {
  if (typeof window === "undefined") return { left: 0, right: 0, top: 0, bottom: 0 };
  const span = PET_SIZE + MARGIN * 2;
  return {
    left: -(window.innerWidth - span),
    right: 0,
    top: -(window.innerHeight - span),
    bottom: 0,
  };
}

/* The companion is always the little kitsune 🦊 (matches alumi's fox theme).
   Mood is conveyed by scale + an optional sparkle, not by swapping the face. */
const PET_GLYPH = "\u{1F98A}";

/* A happy pet (well-petted) earns a sparkle; a sad one looks a touch wilted. */
function moodSparkle(happiness: number): string {
  if (happiness > 70) return "✨";
  if (happiness < 30) return "\u{1F4A4}";
  return "";
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Floating, draggable kitsune companion. Persists its mood per friend slug,
 * gives hearts on tap, and gently wanders while idle.
 */
export function PetCompanion({ slug }: { slug: string }) {
  const { t } = useT();
  const { happiness, bump } = useHappiness(slug);
  const [constraints, setConstraints] = useState<Box>(computeBox);
  const [hearts, setHearts] = useState<Heart[]>([]);

  const wander = useAnimationControls();
  const isDraggingRef = useRef(false);
  const heartIdRef = useRef(0);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  /* Debounced resize keeps the drag box honest as the viewport changes. */
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => setConstraints(computeBox()), 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      if (debounce) clearTimeout(debounce);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  /* Idle wander — skipped entirely when the user prefers reduced motion. */
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const interval = setInterval(() => {
      if (isDraggingRef.current) return;
      const dx = (Math.random() - 0.5) * 24;
      const dy = (Math.random() - 0.5) * 24;
      void wander.start({
        x: [0, dx, 0],
        y: [0, dy, 0],
        transition: { duration: 2.2, ease: "easeInOut" },
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [wander]);

  /* Clear any pending heart timers on unmount. */
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const removeHeart = (id: number) =>
    setHearts((prev) => prev.filter((h) => h.id !== id));

  const onTap = () => {
    playSound("pet");
    bump(5);
    setHearts((prev) => {
      if (prev.length >= MAX_HEARTS) return prev;
      const id = heartIdRef.current++;
      const timer = setTimeout(() => {
        removeHeart(id);
        timersRef.current.delete(timer);
      }, HEART_TTL);
      timersRef.current.add(timer);
      return [...prev, { id, x: (Math.random() - 0.5) * 36 }];
    });
  };

  const scale = 0.9 + (happiness / 100) * 0.3;

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <motion.div
        className="pointer-events-auto absolute cursor-grab select-none active:cursor-grabbing"
        style={{ right: MARGIN, bottom: MARGIN, touchAction: "none" }}
        drag
        dragMomentum
        dragConstraints={constraints}
        whileDrag={{ scale: 1.25, rotate: -8, cursor: "grabbing" }}
        onTap={onTap}
        onDragStart={() => {
          isDraggingRef.current = true;
        }}
        onDragEnd={() => {
          isDraggingRef.current = false;
        }}
        role="button"
        aria-label={t("pet.aria")}
      >
        {/* Inner wrapper owns the wander animation so it never fights drag. */}
        <motion.div animate={wander} className="relative">
          <AnimatePresence>
            {hearts.map((heart) => (
              <motion.span
                key={heart.id}
                className="pointer-events-none absolute left-1/2 top-0 text-2xl select-none"
                style={{ x: heart.x }}
                initial={{ opacity: 0, y: 0, scale: 0.6 }}
                animate={{ opacity: 1, y: -60, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: HEART_TTL / 1000, ease: "easeOut" }}
                aria-hidden="true"
              >
                {"❤️"}
              </motion.span>
            ))}
          </AnimatePresence>
          <motion.div
            className="relative leading-none select-none"
            style={{
              fontSize: PET_SIZE,
              filter: "drop-shadow(var(--shadow-md))",
            }}
            animate={{ scale }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            aria-hidden="true"
          >
            {PET_GLYPH}
            {moodSparkle(happiness) && (
              <span className="absolute -top-1 -right-1 text-base">
                {moodSparkle(happiness)}
              </span>
            )}
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

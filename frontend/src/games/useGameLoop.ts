import { useEffect, useRef, useState } from "react";

/* A requestAnimationFrame game loop. The callback is stored in a ref so the
   loop is never restarted on re-render — physics keeps its momentum. `dt` is in
   seconds and clamped to ≤0.1 so a backgrounded tab doesn't teleport entities
   on resume. `elapsed` accumulates only while running. */

export interface GameLoopControls {
  pause: () => void;
  resume: () => void;
  isRunning: boolean;
}

/**
 * Drive `cb(dt, elapsed)` on every animation frame.
 * @param cb       called per frame; `dt` and `elapsed` are seconds.
 * @param autoStart whether the loop runs immediately (default true).
 */
export function useGameLoop(
  cb: (dt: number, elapsed: number) => void,
  autoStart = true,
): GameLoopControls {
  const cbRef = useRef(cb);
  cbRef.current = cb;

  const runningRef = useRef(autoStart);
  const elapsedRef = useRef(0);
  const lastRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const [isRunning, setIsRunning] = useState(autoStart);

  useEffect(() => {
    const frame = (now: number) => {
      rafRef.current = requestAnimationFrame(frame);

      if (lastRef.current === null) {
        lastRef.current = now;
        return;
      }
      const rawDt = (now - lastRef.current) / 1000;
      lastRef.current = now;

      if (!runningRef.current) return;

      const dt = Math.min(rawDt, 0.1);
      elapsedRef.current += dt;
      cbRef.current(dt, elapsedRef.current);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return {
    pause: () => {
      runningRef.current = false;
      setIsRunning(false);
    },
    resume: () => {
      /* Drop the stale timestamp so the gap while paused isn't counted as dt. */
      lastRef.current = null;
      runningRef.current = true;
      setIsRunning(true);
    },
    isRunning,
  };
}

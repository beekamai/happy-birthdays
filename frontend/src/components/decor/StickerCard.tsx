import type { ReactNode } from "react";

/* The workhorse "die-cut sticker" card: warm surface, thick white border,
   plump radius, soft shadow. Optionally lifts + tilts on hover. */

interface StickerCardProps {
  children: ReactNode;
  className?: string;
  /** Enable the playful hover lift `scale(1.02) rotate(-1deg)`. Default true. */
  hover?: boolean;
}

export function StickerCard({
  children,
  className = "",
  hover = true,
}: StickerCardProps) {
  const hoverClasses = hover
    ? "transition-transform duration-300 ease-[var(--ease-bounce)] hover:scale-[1.02] hover:-rotate-1"
    : "";

  return (
    <div
      className={`rounded-[var(--radius-lg)] border-[3px] border-white bg-[var(--color-surface)] p-6 text-[var(--color-text)] shadow-[var(--shadow-md)] ${hoverClasses} ${className}`}
    >
      {children}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

export type AppTheme = "none" | "autumn";

export function useTheme() {
  const [theme, setThemeState] = useState<AppTheme>("none");
  useEffect(() => {
    const saved = localStorage.getItem("app-theme") as AppTheme | null;
    if (saved && saved !== "none") setThemeState(saved);
  }, []);
  function setTheme(t: AppTheme) {
    setThemeState(t);
    localStorage.setItem("app-theme", t);
  }
  return { theme, setTheme };
}

// Pre-calculated leaf data so SSR and client match
const LEAVES: { emoji: string; left: number; delay: number; duration: number; size: number; drift: number; rotate: number }[] = [
  { emoji: "🍂", left: 5,  delay: 0,   duration: 9,  size: 20, drift:  35, rotate: 420 },
  { emoji: "🍁", left: 14, delay: 1.4, duration: 11, size: 18, drift: -28, rotate: 360 },
  { emoji: "🍃", left: 23, delay: 0.7, duration: 8,  size: 16, drift:  22, rotate: 500 },
  { emoji: "🍂", left: 33, delay: 2.5, duration: 10, size: 22, drift: -40, rotate: 300 },
  { emoji: "🍁", left: 42, delay: 0.3, duration: 9,  size: 19, drift:  30, rotate: 450 },
  { emoji: "🍃", left: 51, delay: 3.1, duration: 12, size: 17, drift: -25, rotate: 390 },
  { emoji: "🍂", left: 60, delay: 1.0, duration: 8,  size: 21, drift:  42, rotate: 480 },
  { emoji: "🍁", left: 70, delay: 2.0, duration: 10, size: 18, drift: -35, rotate: 330 },
  { emoji: "🍃", left: 79, delay: 0.5, duration: 9,  size: 23, drift:  28, rotate: 410 },
  { emoji: "🍂", left: 88, delay: 3.8, duration: 11, size: 20, drift: -44, rotate: 360 },
  { emoji: "🍁", left: 96, delay: 1.7, duration: 8,  size: 17, drift:  20, rotate: 540 },
  { emoji: "🍃", left: 9,  delay: 4.5, duration: 10, size: 19, drift: -30, rotate: 400 },
  { emoji: "🍂", left: 28, delay: 5.0, duration: 9,  size: 22, drift:  38, rotate: 320 },
  { emoji: "🍁", left: 47, delay: 4.0, duration: 11, size: 16, drift: -22, rotate: 460 },
  { emoji: "🍃", left: 65, delay: 2.8, duration: 8,  size: 20, drift:  45, rotate: 380 },
  { emoji: "🍂", left: 84, delay: 5.5, duration: 10, size: 18, drift: -38, rotate: 500 },
];

export function ThemeOverlay({ theme }: { theme: AppTheme }) {
  if (theme === "none") return null;

  if (theme === "autumn") {
    return (
      <div className="theme-overlay" aria-hidden="true">
        {LEAVES.map((leaf, i) => (          <span
            key={i}
            className="autumn-leaf"
            style={{
              left: `${leaf.left}%`,
              animationDelay: `${leaf.delay}s`,
              animationDuration: `${leaf.duration}s`,
              fontSize: `${leaf.size}px`,
              "--leaf-drift": `${leaf.drift}px`,
              "--leaf-rotate": `${leaf.rotate}deg`,
            } as React.CSSProperties}
          >
            {leaf.emoji}
          </span>
        ))}
      </div>
    );
  }

  return null;
}

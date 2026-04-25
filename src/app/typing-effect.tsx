"use client";

import { useState, useEffect } from "react";

export function TypingEffect({
  text,
  speed = 40,
  delay = 500,
  className,
}: {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
}) {
  const [displayed, setDisplayed] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    let cursorTimeout: ReturnType<typeof setTimeout> | undefined;
    const timeout = setTimeout(() => {
      let i = 0;
      interval = setInterval(() => {
        setDisplayed(text.slice(0, i + 1));
        i++;
        if (i >= text.length) {
          if (interval) clearInterval(interval);
          cursorTimeout = setTimeout(() => setShowCursor(false), 1500);
        }
      }, speed);
    }, delay);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
      if (cursorTimeout) clearTimeout(cursorTimeout);
    };
  }, [text, speed, delay]);

  return (
    <span className={className}>
      {displayed}
      {showCursor && (
        <span className="animate-pulse text-accent">|</span>
      )}
    </span>
  );
}

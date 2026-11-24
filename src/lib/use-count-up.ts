"use client";
import { useEffect, useRef, useState } from "react";

/** Sayıyı önceki değerinden yenisine akıcı biçimde artırır (hareket azaltma tercihinde doğrudan gösterir). */
export function useCountUp(target: number, ms = 900): number {
  const [value, setValue] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !Number.isFinite(target)) {
      from.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = a + (target - a) * eased;
      from.current = v;
      setValue(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

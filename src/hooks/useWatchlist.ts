// src/hooks/useWatchlist.ts
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "whale-cockpit:watchlist";

/** Persistent set of starred wallet addresses (localStorage, no backend). */
export function useWatchlist() {
  const [watched, setWatched] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw) as unknown;
      return new Set(Array.isArray(arr) ? arr.map((x) => String(x).toLowerCase()) : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...watched]));
    } catch {
      /* storage unavailable (private mode) — ignore */
    }
  }, [watched]);

  const toggle = useCallback((address: string) => {
    const a = address.toLowerCase();
    setWatched((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  }, []);

  const isWatched = useCallback((address: string) => watched.has(address.toLowerCase()), [watched]);

  return { watched, toggle, isWatched, count: watched.size };
}

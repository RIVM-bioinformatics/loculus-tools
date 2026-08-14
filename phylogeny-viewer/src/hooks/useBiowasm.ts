import { useEffect, useState } from "react";
import { preloader } from "../services/preloader";

export interface BiowasmState {
  status: "idle" | "loading" | "ready" | "error";
}

/**
 * React hook that kicks off biowasm preloading on mount and exposes the
 * current preload status. Safe to use from multiple components; the
 * underlying preloader is a singleton.
 */
export function useBiowasm(): BiowasmState {
  const [state, setState] = useState<BiowasmState>(() => ({
    status: "loading",
  }));

  useEffect(() => {
    let cancelled = false;

    preloader
      .preloadAll()
      .then(() => {
        if (cancelled) return;
        const status = preloader.getLoadingStatus();
        setState({ status: status.all ? "ready" : "error" });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

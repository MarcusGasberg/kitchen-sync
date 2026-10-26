import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "#/ui/button";
import { Figure, type FigureProps } from "#/ui/figure/figure";
import styles from "./presentation.module.css";

// Future parts supply their own scene and code; navigation remains the same.
export function Presentation({
  name,
  ...figure
}: Omit<FigureProps, "free" | "presentation"> & { readonly name: string }) {
  const element = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setCanFullscreen(document.fullscreenEnabled);
    const changed = () =>
      setFullscreen(document.fullscreenElement === element.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);

  const toggleFullscreen = async () => {
    setError(null);
    try {
      if (fullscreen) await document.exitFullscreen();
      else await element.current?.requestFullscreen();
    } catch {
      setError(
        "Full screen is unavailable. You can still present in this window.",
      );
    }
  };

  return (
    <main ref={element} className={styles.presentation}>
      <header className={styles.header}>
        <Link to="/">Kitchen Sync</Link>
        <h1>{name} · Presentation</h1>
        {canFullscreen && (
          <Button kind="secondary" onClick={toggleFullscreen}>
            {fullscreen ? "Exit full screen" : "Full screen"}
          </Button>
        )}
      </header>
      {error !== null && <p role="status">{error}</p>}
      <Figure {...figure} presentation />
    </main>
  );
}

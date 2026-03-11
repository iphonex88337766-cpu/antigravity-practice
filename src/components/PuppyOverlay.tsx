/**
 * PuppyOverlay — Transparent puppy triggered by right-eye blink.
 * Appears for 2s with pop animation. mix-blend-mode: multiply kills white edges.
 */

import { useState, useEffect, useRef } from "react";
import puppySrc from "@/assets/puppy.png";

interface PuppyOverlayProps {
  blendshapes: Record<string, number> | null;
}

const BLINK_THRESHOLD = 0.6;
const DISPLAY_DURATION = 2000;

export default function PuppyOverlay({ blendshapes }: PuppyOverlayProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number>(0);
  const cooldownRef = useRef(false);

  const rightBlink = blendshapes?.["eyeBlinkRight"] ?? 0;
  const isTriggered = rightBlink >= BLINK_THRESHOLD;

  useEffect(() => {
    if (isTriggered && !visible && !cooldownRef.current) {
      setVisible(true);
      cooldownRef.current = true;
      timerRef.current = window.setTimeout(() => {
        setVisible(false);
        window.setTimeout(() => { cooldownRef.current = false; }, 300);
      }, DISPLAY_DURATION);
    }
  }, [isTriggered, visible]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (!visible) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          right: 50,
          top: 120,
          width: 300,
          background: "transparent",
          border: "none",
          boxShadow: "none",
          zIndex: 2147483647,
          pointerEvents: "none",
          animation: "puppyPop 0.3s ease-out both",
        }}
      >
        <img
          src={puppySrc}
          alt="puppy"
          style={{
            width: "100%",
            height: "auto",
            background: "transparent",
            mixBlendMode: "multiply",
            filter: "contrast(1.2) brightness(1.1)",
          }}
        />
      </div>
      <style>{`
        @keyframes puppyPop {
          0% { opacity: 0; transform: scale(0.3); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}

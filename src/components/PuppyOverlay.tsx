/**
 * PuppyOverlay — Transparent puppy triggered by right-eye blink.
 * Appears for 2s with pop animation. mix-blend-mode: multiply kills white edges.
 */

import { useState, useEffect, useRef } from "react";
import puppySrc from "@/assets/puppy.png";

interface PuppyOverlayProps {
  blendshapes: Record<string, number> | null;
}

const CLOSED_THRESHOLD = 0.38;  // right eye "closed" — easier to reach
const OPEN_THRESHOLD = 0.28;    // right eye "open" — slightly more forgiving
const LEFT_OPEN_MAX = 0.35;     // left eye must stay clearly open (stricter)
const EYE_GAP_MIN = 0.12;       // right eye must be clearly more closed than left
const CLOSED_FRAMES_NEEDED = 1; // single confirmed closed frame → faster response
const DISPLAY_DURATION = 2000;

export default function PuppyOverlay({ blendshapes }: PuppyOverlayProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number>(0);
  const cooldownRef = useRef(false);

  // Blink-cycle state machine: "idle" → "closed" → triggered on re-open
  const phaseRef = useRef<"idle" | "closed">("idle");
  const closedFramesRef = useRef(0);
  const blockedCycleRef = useRef(false);

  const rightBlink = blendshapes?.["eyeBlinkRight"] ?? 0;
  const leftBlink = blendshapes?.["eyeBlinkLeft"] ?? 0;

  useEffect(() => {
    if (visible || cooldownRef.current || !blendshapes) return;

    const rightClosed = rightBlink >= CLOSED_THRESHOLD;
    const rightOpen = rightBlink < OPEN_THRESHOLD;
    const leftOpen = leftBlink < LEFT_OPEN_MAX;

    if (phaseRef.current === "idle") {
      // Wait for right eye to close while left stays open
      if (rightClosed && leftOpen) {
        closedFramesRef.current++;
        if (closedFramesRef.current >= CLOSED_FRAMES_NEEDED) {
          phaseRef.current = "closed";
        }
      } else {
        closedFramesRef.current = 0;
      }
    } else if (phaseRef.current === "closed") {
      // If left eye closes at ANY point during the cycle, abort immediately
      if (!leftOpen) {
        phaseRef.current = "idle";
        closedFramesRef.current = 0;
        return;
      }
      // Right eye was closed long enough — trigger when it opens back up, left still open
      if (rightOpen) {
        phaseRef.current = "idle";
        closedFramesRef.current = 0;
        setVisible(true);
        cooldownRef.current = true;
        timerRef.current = window.setTimeout(() => {
          setVisible(false);
          window.setTimeout(() => { cooldownRef.current = false; }, 500);
        }, DISPLAY_DURATION);
      }
    }
  }, [rightBlink, leftBlink, visible, blendshapes]);

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
          height: 300,
          background: "transparent",
          border: "none",
          boxShadow: "none",
          borderRadius: "50%",
          overflow: "hidden",
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
            height: "100%",
            objectFit: "cover",
            background: "transparent",
            display: "block",
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

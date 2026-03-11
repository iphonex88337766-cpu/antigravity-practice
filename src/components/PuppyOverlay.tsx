/**
 * PuppyOverlay — Transparent puppy triggered by right-eye blink.
 * Appears for 2s with pop animation. mix-blend-mode: multiply kills white edges.
 */

import { useState, useEffect, useRef } from "react";
import puppySrc from "@/assets/puppy.png";

interface PuppyOverlayProps {
  blendshapes: Record<string, number> | null;
}

const CLOSED_THRESHOLD = 0.38;
const OPEN_THRESHOLD = 0.28;
const LEFT_OPEN_MAX = 0.35;
const CLOSED_FRAMES_NEEDED = 1;
const DISPLAY_DURATION = 2000;
const COOLDOWN_AFTER_HIDE = 800;

export default function PuppyOverlay({ blendshapes }: PuppyOverlayProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number>(0);
  const cooldownRef = useRef(false);

  // Blink-cycle state machine: "idle" → "closed" → triggered on re-open
  const phaseRef = useRef<"idle" | "closed">("idle");
  const closedFramesRef = useRef(0);

  const rightBlink = blendshapes?.["eyeBlinkRight"] ?? 0;
  const leftBlink = blendshapes?.["eyeBlinkLeft"] ?? 0;

  useEffect(() => {
    if (cooldownRef.current || !blendshapes) return;

    // While visible, freeze the state machine — no new detections
    if (visible) {
      phaseRef.current = "idle";
      closedFramesRef.current = 0;
      return;
    }

    const rightClosed = rightBlink >= CLOSED_THRESHOLD;
    const rightOpen = rightBlink < OPEN_THRESHOLD;
    const leftOpen = leftBlink < LEFT_OPEN_MAX;

    if (phaseRef.current === "idle") {
      if (rightClosed && leftOpen) {
        closedFramesRef.current++;
        if (closedFramesRef.current >= CLOSED_FRAMES_NEEDED) {
          phaseRef.current = "closed";
        }
      } else {
        closedFramesRef.current = 0;
      }
    } else if (phaseRef.current === "closed") {
      if (!leftOpen) {
        phaseRef.current = "idle";
        closedFramesRef.current = 0;
        return;
      }
      if (rightOpen) {
        phaseRef.current = "idle";
        closedFramesRef.current = 0;
        setVisible(true);
        cooldownRef.current = true;
        timerRef.current = window.setTimeout(() => {
          setVisible(false);
          window.setTimeout(() => { cooldownRef.current = false; }, COOLDOWN_AFTER_HIDE);
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
          0% { opacity: 0.3; transform: scale(0.7); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}

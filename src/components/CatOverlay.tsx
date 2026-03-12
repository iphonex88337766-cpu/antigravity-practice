/**
 * CatOverlay — Cat sticker triggered by left-eye blink.
 * Mirrors the dog's right-eye logic but for the left eye.
 * Appears for 2s with pop animation in a circular frame.
 */

import { useState, useEffect, useRef } from "react";
import catSrc from "@/assets/cat.png";

interface CatOverlayProps {
  blendshapes: Record<string, number> | null;
}

const CLOSED_THRESHOLD = 0.30;
const OPEN_THRESHOLD = 0.35;
const RIGHT_OPEN_MAX = 0.40;
const CLOSED_FRAMES_NEEDED = 1;
const DISPLAY_DURATION = 2000;
const COOLDOWN_AFTER_HIDE = 600;

export default function CatOverlay({ blendshapes }: CatOverlayProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number>(0);
  const cooldownRef = useRef(false);
  const phaseRef = useRef<"idle" | "closed">("idle");
  const closedFramesRef = useRef(0);

  const leftBlink = blendshapes?.["eyeBlinkLeft"] ?? 0;
  const rightBlink = blendshapes?.["eyeBlinkRight"] ?? 0;

  useEffect(() => {
    if (cooldownRef.current || !blendshapes) return;

    // While visible, freeze the state machine — no new detections
    if (visible) {
      phaseRef.current = "idle";
      closedFramesRef.current = 0;
      return;
    }

    const leftClosed = leftBlink >= CLOSED_THRESHOLD;
    const leftOpen = leftBlink < OPEN_THRESHOLD;
    const rightOpen = rightBlink < RIGHT_OPEN_MAX;

    if (phaseRef.current === "idle") {
      if (leftClosed && rightOpen) {
        closedFramesRef.current++;
        if (closedFramesRef.current >= CLOSED_FRAMES_NEEDED) {
          phaseRef.current = "closed";
        }
      } else {
        closedFramesRef.current = 0;
      }
    } else if (phaseRef.current === "closed") {
      if (!rightOpen) {
        phaseRef.current = "idle";
        closedFramesRef.current = 0;
        return;
      }
      if (leftOpen) {
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
  }, [leftBlink, rightBlink, visible, blendshapes]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (!visible) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          right: 50,
          top: 560,
          width: 300,
          height: 300,
          background: "transparent",
          border: "none",
          boxShadow: "none",
          borderRadius: "50%",
          overflow: "hidden",
          zIndex: 2147483647,
          pointerEvents: "none",
          animation: "catPop 0.15s ease-out both",
        }}
      >
        <img
          src={catSrc}
          alt="cat"
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
        @keyframes catPop {
          0% { opacity: 0.3; transform: scale(0.7); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}

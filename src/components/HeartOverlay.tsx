/**
 * HeartOverlay — Heart sticker triggered by both-eyes blink.
 * Highest priority: when both eyes close, dog and cat are suppressed.
 */

import { useState, useEffect, useRef } from "react";
import heartSrc from "@/assets/heart.png";

interface HeartOverlayProps {
  blendshapes: Record<string, number> | null;
  onBothEyesClosed?: (closed: boolean) => void;
}

const BOTH_CLOSED_THRESHOLD = 0.38;
const OPEN_THRESHOLD = 0.32;
const CLOSED_FRAMES_NEEDED = 2; // require 2 frames to avoid accidental squints
const DISPLAY_DURATION = 2000;
const COOLDOWN_AFTER_HIDE = 800;

export default function HeartOverlay({ blendshapes, onBothEyesClosed }: HeartOverlayProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number>(0);
  const cooldownRef = useRef(false);
  const phaseRef = useRef<"idle" | "closed">("idle");
  const closedFramesRef = useRef(0);

  const leftBlink = blendshapes?.["eyeBlinkLeft"] ?? 0;
  const rightBlink = blendshapes?.["eyeBlinkRight"] ?? 0;

  const bothClosed = leftBlink >= BOTH_CLOSED_THRESHOLD && rightBlink >= BOTH_CLOSED_THRESHOLD;

  // Report both-eyes-closed state upstream to suppress dog/cat
  useEffect(() => {
    onBothEyesClosed?.(bothClosed);
  }, [bothClosed, onBothEyesClosed]);

  useEffect(() => {
    if (cooldownRef.current || !blendshapes) return;

    if (visible) {
      phaseRef.current = "idle";
      closedFramesRef.current = 0;
      return;
    }

    const bothOpen = leftBlink < OPEN_THRESHOLD && rightBlink < OPEN_THRESHOLD;

    if (phaseRef.current === "idle") {
      if (bothClosed) {
        closedFramesRef.current++;
        if (closedFramesRef.current >= CLOSED_FRAMES_NEEDED) {
          phaseRef.current = "closed";
        }
      } else {
        closedFramesRef.current = 0;
      }
    } else if (phaseRef.current === "closed") {
      if (bothOpen) {
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
  }, [leftBlink, rightBlink, visible, blendshapes, bothClosed]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (!visible) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          right: 50,
          top: 340,
          width: 300,
          height: 300,
          background: "transparent",
          border: "none",
          boxShadow: "none",
          borderRadius: "50%",
          overflow: "hidden",
          zIndex: 2147483647,
          pointerEvents: "none",
          animation: "heartPop 0.15s ease-out both",
        }}
      >
        <img
          src={heartSrc}
          alt="heart"
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
        @keyframes heartPop {
          0% { opacity: 0.3; transform: scale(0.7); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}

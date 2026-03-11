/**
 * PuppyOverlay — Transparent overlay triggered by right-eye blink.
 * Shows for 1.5s after eyeBlinkRight > 0.4, with pop-in animation.
 */

import { useState, useEffect, useRef } from "react";
import { type NormalizedLandmark } from "@mediapipe/tasks-vision";
import puppySrc from "@/assets/puppy.png";

interface PuppyOverlayProps {
  landmarks: NormalizedLandmark[];
  blendshapes: Record<string, number> | null;
  width: number;
  height: number;
}

const BLINK_THRESHOLD = 0.4;
const DISPLAY_DURATION = 1500;

export default function PuppyOverlay({ blendshapes }: PuppyOverlayProps) {
  const [imgFailed, setImgFailed] = useState(false);
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
        // Small cooldown to prevent re-trigger while eye is still closed
        window.setTimeout(() => { cooldownRef.current = false; }, 300);
      }, DISPLAY_DURATION);
    }
    return () => {};
  }, [isTriggered, visible]);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <>
      {visible && (
        <div
          style={{
            position: "fixed",
            right: 80,
            top: 150,
            width: 300,
            zIndex: 2147483647,
            pointerEvents: "none",
            animation: "puppyPopIn 0.2s ease-out both",
          }}
        >
          {imgFailed ? (
            <div style={{ width: "100%", height: 300, background: "#2255ff", borderRadius: 16 }} />
          ) : (
            <img
              src={puppySrc}
              alt="puppy"
              onError={() => setImgFailed(true)}
              style={{ width: "100%", height: "auto" }}
            />
          )}
        </div>
      )}

      <style>{`
        @keyframes puppyPopIn {
          0% { opacity: 0; transform: scale(0.7); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}

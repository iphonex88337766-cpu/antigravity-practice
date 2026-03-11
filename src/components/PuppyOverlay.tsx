/**
 * PuppyOverlay — STRICT DEBUG
 * Fixed top-right position, large size, blue square fallback.
 */

import { useState } from "react";
import { type NormalizedLandmark } from "@mediapipe/tasks-vision";
import puppySrc from "@/assets/puppy.png";

interface PuppyOverlayProps {
  landmarks: NormalizedLandmark[];
  blendshapes: Record<string, number> | null;
  width: number;
  height: number;
}

const BLINK_THRESHOLD = 0.4;

export default function PuppyOverlay({ blendshapes }: PuppyOverlayProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const rightBlink = blendshapes?.["eyeBlinkRight"] ?? 0;
  const isTriggered = rightBlink >= BLINK_THRESHOLD;

  return (
    <>
      {/* Debug: right eye value — always visible */}
      <div
        style={{
          position: "fixed",
          top: 10,
          right: 10,
          background: "rgba(0,0,0,0.85)",
          color: isTriggered ? "#0f0" : "#fff",
          fontFamily: "monospace",
          fontSize: 22,
          padding: "10px 16px",
          borderRadius: 8,
          zIndex: 999999,
          pointerEvents: "none",
        }}
      >
        Right Eye Value: {rightBlink.toFixed(3)}
        <br />
        {isTriggered ? "🐶 TRIGGERED" : "— waiting —"}
      </div>

      {/* Puppy or blue square fallback — fixed top-right */}
      {isTriggered && (
        imgFailed ? (
          <div
            style={{
              position: "fixed",
              right: 50,
              top: 50,
              width: 300,
              height: 300,
              background: "#2255ff",
              zIndex: 99999,
              pointerEvents: "none",
            }}
          />
        ) : (
          <img
            src={puppySrc}
            alt="puppy"
            onError={() => setImgFailed(true)}
            style={{
              position: "fixed",
              right: 50,
              top: 50,
              width: 300,
              height: 300,
              objectFit: "contain",
              zIndex: 99999,
              pointerEvents: "none",
            }}
          />
        )
      )}
    </>
  );
}

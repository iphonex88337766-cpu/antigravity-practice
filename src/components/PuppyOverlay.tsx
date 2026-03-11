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

  // ALWAYS TRUE for this debug test
  const isTriggered = true;

  return (
    <>
      {/* Debug readout */}
      <div
        style={{
          position: "fixed",
          top: 10,
          right: 10,
          background: "rgba(0,0,0,0.85)",
          color: "#fff",
          fontFamily: "monospace",
          fontSize: 22,
          padding: "10px 16px",
          borderRadius: 8,
          zIndex: 2147483647,
          pointerEvents: "none",
        }}
      >
        Right Eye: {rightBlink.toFixed(3)} | FORCED ON
      </div>

      {/* Magenta-bordered container — ALWAYS visible */}
      <div
        style={{
          position: "fixed",
          right: 80,
          top: 150,
          width: 300,
          height: 300,
          border: "5px solid #FF00FF",
          zIndex: 2147483647,
          pointerEvents: "none",
        }}
      >
        {imgFailed ? (
          <div style={{ width: "100%", height: "100%", background: "#2255ff" }} />
        ) : (
          <img
            src={puppySrc}
            alt="puppy"
            onError={() => setImgFailed(true)}
            style={{ width: "100%", height: "auto", objectFit: "contain" }}
          />
        )}
      </div>
    </>
  );
}

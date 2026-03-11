/**
 * PuppyOverlay — DEBUG VERSION
 * Shows puppy on outer-right of face when right eye closes.
 * Currently in debug mode: shows blink values + forces visibility.
 */

import { useRef, useState, useEffect, memo } from "react";
import { type NormalizedLandmark } from "@mediapipe/tasks-vision";
import puppySrc from "@/assets/puppy.png";

interface PuppyOverlayProps {
  landmarks: NormalizedLandmark[];
  blendshapes: Record<string, number> | null;
  width: number;
  height: number;
}

const BLINK_THRESHOLD = 0.35;
const PUPPY_SIZE = 130;

export default function PuppyOverlay({
  landmarks,
  blendshapes,
  width,
  height,
}: PuppyOverlayProps) {
  const [imgLoaded, setImgLoaded] = useState(false);

  const rightBlink = blendshapes?.["eyeBlinkRight"] ?? 0;
  const leftBlink = blendshapes?.["eyeBlinkLeft"] ?? 0;
  const isTriggered = rightBlink >= BLINK_THRESHOLD;

  // Face bounding box from landmarks
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const lm of landmarks) {
    const px = lm.x * width;
    const py = lm.y * height;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  const faceCenterY = (minY + maxY) / 2;

  // Fixed position: just right of face bbox
  const puppyX = maxX + 40;
  const puppyY = faceCenterY - PUPPY_SIZE / 2;

  return (
    <>
      {/* DEBUG: blink values overlay */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          background: "rgba(0,0,0,0.75)",
          color: "#0f0",
          fontFamily: "monospace",
          fontSize: 14,
          padding: "8px 12px",
          borderRadius: 6,
          zIndex: 100,
          pointerEvents: "none",
        }}
      >
        <div>R-eye blink: {rightBlink.toFixed(3)}</div>
        <div>L-eye blink: {leftBlink.toFixed(3)}</div>
        <div>Threshold: {BLINK_THRESHOLD}</div>
        <div style={{ color: isTriggered ? "#0f0" : "#f55" }}>
          Triggered: {isTriggered ? "YES" : "NO"}
        </div>
        <div>Img loaded: {imgLoaded ? "YES" : "NO"}</div>
        <div>Face X: {minX.toFixed(0)}-{maxX.toFixed(0)}</div>
        <div>Puppy pos: ({puppyX.toFixed(0)}, {puppyY.toFixed(0)})</div>
        <div>Container: {width}x{height}</div>
      </div>

      {/* Puppy image — visible when triggered, no fade for debug */}
      {isTriggered && (
        <img
          src={puppySrc}
          alt="puppy"
          onLoad={() => setImgLoaded(true)}
          onError={() => console.error("PUPPY IMG FAILED TO LOAD")}
          style={{
            position: "absolute",
            left: puppyX,
            top: puppyY,
            width: PUPPY_SIZE,
            height: PUPPY_SIZE,
            objectFit: "contain",
            opacity: 1,
            pointerEvents: "none",
            zIndex: 50,
          }}
        />
      )}

      {/* Always-visible tiny preload to confirm image works */}
      <img
        src={puppySrc}
        alt="preload"
        onLoad={() => setImgLoaded(true)}
        style={{
          position: "absolute",
          bottom: 10,
          right: 10,
          width: 40,
          height: 40,
          objectFit: "contain",
          opacity: 0.5,
          pointerEvents: "none",
          zIndex: 100,
          border: "1px solid lime",
        }}
      />
    </>
  );
}

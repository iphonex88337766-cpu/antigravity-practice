/**
 * PuppyOverlay — Shows a puppy on the outer-right side of the face
 * when the user closes their right eye.
 *
 * Placement is relative to the detected face position (not screen center).
 * The puppy stays outside a face exclusion zone with extra margin.
 */

import { useRef, memo } from "react";
import { type NormalizedLandmark } from "@mediapipe/tasks-vision";
import puppySrc from "@/assets/puppy.png";

interface PuppyOverlayProps {
  landmarks: NormalizedLandmark[];
  blendshapes: Record<string, number> | null;
  width: number;
  height: number;
}

const BLINK_THRESHOLD = 0.45;
const SMOOTHING = 0.25;
const PUPPY_SIZE = 90;
const FACE_MARGIN = 30; // extra margin outside face bounding box

export default memo(function PuppyOverlay({
  landmarks,
  blendshapes,
  width,
  height,
}: PuppyOverlayProps) {
  const smoothRef = useRef(0);
  const visRef = useRef(0); // smooth visibility for fade

  const rightBlink = blendshapes?.["eyeBlinkRight"] ?? 0;

  // Smooth the blink value
  smoothRef.current += (rightBlink - smoothRef.current) * SMOOTHING;
  const isBlinking = smoothRef.current >= BLINK_THRESHOLD;

  // Fade in/out
  const targetVis = isBlinking ? 1 : 0;
  visRef.current += (targetVis - visRef.current) * 0.12;
  const opacity = visRef.current;

  if (opacity < 0.01) return null;

  // Compute face bounding box from landmarks (in pixel coords)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const lm of landmarks) {
    const px = lm.x * width;
    const py = lm.y * height;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }

  // Face center Y, and exclusion zone right edge
  const faceCenterY = (minY + maxY) / 2;
  const exclusionRight = maxX + FACE_MARGIN;

  // Place puppy just outside the exclusion zone on the right
  const puppyX = exclusionRight + 10;
  const puppyY = faceCenterY - PUPPY_SIZE / 2;

  // Clamp to viewport
  const clampedX = Math.min(puppyX, width - PUPPY_SIZE - 5);
  const clampedY = Math.max(5, Math.min(puppyY, height - PUPPY_SIZE - 5));

  return (
    <img
      src={puppySrc}
      alt="puppy"
      style={{
        position: "absolute",
        left: clampedX,
        top: clampedY,
        width: PUPPY_SIZE,
        height: PUPPY_SIZE,
        objectFit: "contain",
        opacity,
        pointerEvents: "none",
        transition: "opacity 0.15s ease-out",
        filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.2))",
        zIndex: 20,
      }}
    />
  );
});

/**
 * AvatarOverlay — Simplified integrated feline mouth.
 *
 * Architecture:
 *   - Container has a dark background (= mouth cavity, visible through the gap)
 *   - Upper face: clipped above a soft W-contour, fixed
 *   - Lower jaw: clipped below the same W-contour, translates down with jawOpen
 *   - The gap between them IS the mouth — no separate mouth SVG overlay
 *   - Skin-toned corner fills bridge the mouth corners into the cheeks
 */

import { useMemo, useRef } from "react";
import { type NormalizedLandmark } from "@mediapipe/tasks-vision";
import babyTigerSrc from "@/assets/baby-tiger.png";

interface AvatarOverlayProps {
  landmarks: NormalizedLandmark[];
  transformationMatrix: { rows: number; columns: number; data: number[] } | null;
  blendshapes?: Record<string, number> | null;
  width: number;
  height: number;
  avatarSrc?: string;
}

function matrixToEuler(data: number[]): { pitch: number; yaw: number; roll: number } {
  const r00 = data[0], r01 = data[1], r02 = data[2];
  const r12 = data[6];
  const r22 = data[10];
  const pitch = Math.atan2(-r12, r22) * (180 / Math.PI);
  const yaw = Math.asin(r02) * (180 / Math.PI);
  const roll = Math.atan2(-r01, r00) * (180 / Math.PI);
  return { pitch, yaw, roll };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

const MAX_JAW_PX = 45;

/** Baseline Y% for the W-contour center (philtrum). Offsets are applied dynamically. */
const BASE_MOUTH_Y = 65.4;

/**
 * Feline upper-lip contour — positioned in the MOUTH zone (~59-62% y),
 * directly under the nose, not on the lower jaw.
 *
 * Small, subtle W-shape. Edges at y=100% so sides never split.
 * Format: [x%, y%]
 */
/**
 * Base W-contour shape — Y values are relative to BASE_MOUTH_Y.
 * At runtime, all Y values are shifted so the contour center aligns
 * with the actual mouth landmark position.
 * Format: [x%, yOffset from BASE_MOUTH_Y]
 */
const W_SHAPE: [number, number][] = [
  [0,   100],
  [10,  100],
  [15,  100],
  [20,  90],
  [24,  80],
  [27,  73],
  [30,  69],
  [33,  66.5],
  [35,  65.5],   // left mouth corner
  [37,  65.8],
  [39,  66.2],
  [41,  66.5],
  [43,  66.7],   // left lobe
  [45,  66.4],
  [47,  66],
  [49,  65.6],
  [50,  65.4],   // philtrum center (= BASE_MOUTH_Y)
  [51,  65.6],
  [53,  66],
  [55,  66.4],
  [57,  66.7],   // right lobe
  [59,  66.5],
  [61,  66.2],
  [63,  65.8],
  [65,  65.5],   // right mouth corner
  [67,  66.5],
  [70,  69],
  [73,  73],
  [76,  80],
  [80,  90],
  [85,  100],
  [90,  100],
  [100, 100],
];

/** Shift W_SHAPE Y values by a delta to align with landmark-derived mouth pos */
function shiftedWPoints(dy: number): [number, number][] {
  return W_SHAPE.map(([x, y]) => {
    // Only shift the "mouth zone" points (y < 100), leave edges pinned
    if (y >= 100) return [x, y] as [number, number];
    return [x, Math.min(y + dy, 100)] as [number, number];
  });
}

/** Upper face clip: everything above the W-contour */
function upperClipPath(points: [number, number][]): string {
  const rev = [...points].reverse().map(([x, y]) => `${x}% ${y}%`).join(", ");
  return `polygon(0% 0%, 100% 0%, 100% 100%, ${rev}, 0% 100%)`;
}

/** Lower jaw clip: everything below the W-contour */
function lowerClipPath(points: [number, number][]): string {
  const fwd = points.map(([x, y]) => `${x}% ${y}%`).join(", ");
  return `polygon(${fwd}, 100% 100%, 0% 100%)`;
}

/**
 * Derive mouth center Y% from landmarks.
 * Uses landmarks 13 (upper lip center) and 14 (lower lip center),
 * mapped relative to forehead (10) and chin (152) to get face-relative %.
 */
function getMouthYPercent(landmarks: NormalizedLandmark[]): number {
  const upperLip = landmarks[13]; // upper lip top center
  const lowerLip = landmarks[14]; // lower lip bottom center
  const forehead = landmarks[10]; // top of face
  const chin = landmarks[152];    // bottom of face

  if (!upperLip || !lowerLip || !forehead || !chin) return BASE_MOUTH_Y;

  const faceTop = forehead.y;
  const faceBottom = chin.y;
  const faceHeight = faceBottom - faceTop;
  if (faceHeight <= 0) return BASE_MOUTH_Y;

  const mouthCenterY = (upperLip.y + lowerLip.y) / 2;
  // Convert to percentage of face height, then scale to avatar image %
  // The avatar face occupies roughly 20%-90% of the image vertically
  const faceRelative = (mouthCenterY - faceTop) / faceHeight; // 0-1 within face
  // Map to avatar image space: face spans ~20% to ~85% of image
  const avatarY = 20 + faceRelative * 65;
  return avatarY;
}

export default function AvatarOverlay({
  landmarks,
  transformationMatrix,
  blendshapes,
  width,
  height,
  avatarSrc = babyTigerSrc,
}: AvatarOverlayProps) {
  const smoothJawRef = useRef(0);

  const jawRaw = useMemo(() => {
    const raw = blendshapes?.["jawOpen"] ?? 0;
    smoothJawRef.current = lerp(smoothJawRef.current, raw, 0.22);
    return smoothJawRef.current;
  }, [blendshapes]);

  const jawDrop = jawRaw * MAX_JAW_PX;

  const containerStyle = useMemo(() => {
    const sz = Math.min(width, height) * 0.8;
    const cx = width / 2;
    const cy = height / 2;

    let rotate = "none";
    if (transformationMatrix && transformationMatrix.data?.length >= 16) {
      const { pitch, yaw, roll } = matrixToEuler(transformationMatrix.data);
      rotate = `rotateX(${pitch}deg) rotateY(${-yaw}deg) rotateZ(${-roll}deg)`;
    }

    return {
      position: "absolute" as const,
      left: cx - sz / 2,
      top: cy - sz / 2,
      width: sz,
      height: sz + MAX_JAW_PX,
      transform: rotate,
      transformStyle: "preserve-3d" as const,
      pointerEvents: "none" as const,
      willChange: "transform",
    };
  }, [transformationMatrix, width, height]);

  const size = Math.min(width, height) * 0.8;

  // Mouth reference positions for the cavity slit
  const lcx = size * 0.35;      // left corner x
  const rcx = size * 0.65;      // right corner x
  const cornerY = size * 0.655; // corner y
  const lobeY = size * 0.667;   // lobe deepest y
  const cx = size * 0.5;

  return (
    <div style={containerStyle}>
      {/* ── Thin mouth slit — a narrow dark opening following the W ── */}
      <svg
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: size,
          height: size + MAX_JAW_PX,
          pointerEvents: "none",
          zIndex: 0,
        }}
        viewBox={`0 0 ${size} ${size + MAX_JAW_PX}`}
      >
        {/* Thin dark slit that follows the W-contour.
            Top edge: the W-contour itself.
            Bottom edge: same W shifted down by jawDrop (min ~2px for a thin natural line). */}
        <path
          d={`
            M ${lcx} ${cornerY}
            Q ${(lcx + cx) / 2} ${lobeY},
              ${cx} ${lobeY - 1}
            Q ${(cx + rcx) / 2} ${lobeY},
              ${rcx} ${cornerY}
            L ${rcx} ${cornerY + Math.max(jawDrop, 1.5)}
            Q ${(cx + rcx) / 2} ${lobeY + Math.max(jawDrop, 1.5) + 1},
              ${cx} ${lobeY + Math.max(jawDrop, 1.5) + 2}
            Q ${(lcx + cx) / 2} ${lobeY + Math.max(jawDrop, 1.5) + 1},
              ${lcx} ${cornerY + Math.max(jawDrop, 1.5)}
            Z
          `}
          fill="hsl(340, 45%, 10%)"
          opacity={jawRaw < 0.01 ? 0.35 : Math.min(0.35 + jawRaw * 3, 1)}
        />
      </svg>

      {/* ── Lower Jaw (translates down with jawOpen) ── */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: size,
          height: size,
          clipPath: LOWER_CLIP,
          zIndex: 1,
          transform: `translateY(${jawDrop}px)`,
          willChange: "transform",
        }}
      >
        <img
          src={avatarSrc}
          alt=""
          draggable={false}
          style={{ width: size, height: size, display: "block" }}
        />
      </div>

      {/* ── Upper Face (fixed) ── */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: size,
          height: size,
          clipPath: UPPER_CLIP,
          zIndex: 2,
        }}
      >
        <img
          src={avatarSrc}
          alt=""
          draggable={false}
          style={{ width: size, height: size, display: "block" }}
        />
      </div>
    </div>
  );
}

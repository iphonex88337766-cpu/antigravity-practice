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
const BASE_MOUTH_Y = 75.4;

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
  [20,  100],
  [24,  93],
  [27,  85],
  [30,  79],
  [33,  76.5],
  [35,  75.5],   // left mouth corner
  [37,  75.8],
  [39,  76.2],
  [41,  76.5],
  [43,  76.7],   // left lobe
  [45,  76.4],
  [47,  76],
  [49,  75.6],
  [50,  75.4],   // philtrum center (= BASE_MOUTH_Y)
  [51,  75.6],
  [53,  76],
  [55,  76.4],
  [57,  76.7],   // right lobe
  [59,  76.5],
  [61,  76.2],
  [63,  75.8],
  [65,  75.5],   // right mouth corner
  [67,  76.5],
  [70,  79],
  [73,  85],
  [76,  93],
  [80,  100],
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
  const smoothMouthYRef = useRef(BASE_MOUTH_Y);

  const jawRaw = useMemo(() => {
    const raw = blendshapes?.["jawOpen"] ?? 0;
    smoothJawRef.current = lerp(smoothJawRef.current, raw, 0.22);
    return smoothJawRef.current;
  }, [blendshapes]);

  const jawDrop = jawRaw * MAX_JAW_PX;

  // Derive mouth Y from landmarks, smoothed
  const mouthYTarget = getMouthYPercent(landmarks);
  smoothMouthYRef.current = lerp(smoothMouthYRef.current, mouthYTarget, 0.15);
  const dy = smoothMouthYRef.current - BASE_MOUTH_Y;
  const wPoints = shiftedWPoints(dy);
  const UPPER_CLIP = upperClipPath(wPoints);
  const LOWER_CLIP = lowerClipPath(wPoints);

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

  // Mouth geometry derived from the W-contour
  const cornerYPct = wPoints.find(([x]) => x === 35)?.[1] ?? 65.5;
  const lobeYPct = wPoints.find(([x]) => x === 43)?.[1] ?? 66.7;
  const philtrumYPct = wPoints.find(([x]) => x === 50)?.[1] ?? 65.4;

  // Key pixel positions
  const lcx = size * 0.35;
  const rcx = size * 0.65;
  const cx = size * 0.5;
  const cornerY = size * (cornerYPct / 100);
  const lobeY = size * (lobeYPct / 100);
  const philtrumY = size * (philtrumYPct / 100);

  // The mouth opening thickness — thin slit when closed, opens with jaw
  const openAmt = Math.max(jawDrop, 1.2);

  return (
    <div style={containerStyle}>
      {/* ── Mouth structure SVG — lip forms + cavity, behind face layers ── */}
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
        <defs>
          <radialGradient id="mouthCavity" cx="50%" cy="30%" rx="55%" ry="65%">
            <stop offset="0%" stopColor="hsl(350, 25%, 18%)" />
            <stop offset="70%" stopColor="hsl(345, 40%, 8%)" />
            <stop offset="100%" stopColor="hsl(340, 45%, 5%)" />
          </radialGradient>
          {/* Soft blur for lip form shadows */}
          <filter id="lipSoft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
          <filter id="cornerBlend" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* ── Dark mouth cavity (innermost, deepest layer) ── */}
        <path
          d={`
            M ${lcx} ${cornerY}
            C ${lcx + size * 0.04} ${cornerY - 1},
              ${cx - size * 0.08} ${philtrumY},
              ${cx} ${philtrumY}
            C ${cx + size * 0.08} ${philtrumY},
              ${rcx - size * 0.04} ${cornerY - 1},
              ${rcx} ${cornerY}
            C ${rcx - size * 0.02} ${cornerY + openAmt * 0.3},
              ${rcx - size * 0.06} ${cornerY + openAmt * 0.7},
              ${cx + size * 0.06} ${philtrumY + openAmt + 1}
            C ${cx + size * 0.02} ${philtrumY + openAmt + 1.5},
              ${cx - size * 0.02} ${philtrumY + openAmt + 1.5},
              ${cx - size * 0.06} ${philtrumY + openAmt + 1}
            C ${lcx + size * 0.06} ${cornerY + openAmt * 0.7},
              ${lcx + size * 0.02} ${cornerY + openAmt * 0.3},
              ${lcx} ${cornerY}
            Z
          `}
          fill="url(#mouthCavity)"
          opacity={jawRaw < 0.01 ? 0.5 : Math.min(0.5 + jawRaw * 2, 1)}
        />

        {/* ── Upper lip thickness — soft shadow band above the seam ── */}
        <path
          d={`
            M ${lcx - size * 0.03} ${cornerY - 3}
            C ${lcx + size * 0.03} ${cornerY - 5},
              ${cx - size * 0.10} ${philtrumY - 5},
              ${cx} ${philtrumY - 4.5}
            C ${cx + size * 0.10} ${philtrumY - 5},
              ${rcx - size * 0.03} ${cornerY - 5},
              ${rcx + size * 0.03} ${cornerY - 3}
            C ${rcx - size * 0.02} ${cornerY - 1},
              ${cx + size * 0.08} ${philtrumY},
              ${cx} ${philtrumY}
            C ${cx - size * 0.08} ${philtrumY},
              ${lcx + size * 0.02} ${cornerY - 1},
              ${lcx - size * 0.03} ${cornerY - 3}
            Z
          `}
          fill="hsla(25, 30%, 12%, 0.18)"
          filter="url(#lipSoft)"
        />

        {/* ── Upper lip edge — crisp seam line ── */}
        <path
          d={`
            M ${lcx} ${cornerY}
            C ${lcx + size * 0.04} ${cornerY - 1},
              ${cx - size * 0.08} ${philtrumY},
              ${cx} ${philtrumY}
            C ${cx + size * 0.08} ${philtrumY},
              ${rcx - size * 0.04} ${cornerY - 1},
              ${rcx} ${cornerY}
          `}
          fill="none"
          stroke="hsla(20, 25%, 10%, 0.35)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />

        {/* ── Lower jaw edge — softer, slightly lighter ── */}
        <path
          d={`
            M ${lcx + size * 0.02} ${cornerY + openAmt * 0.35}
            C ${lcx + size * 0.06} ${cornerY + openAmt * 0.7},
              ${cx - size * 0.06} ${philtrumY + openAmt + 0.5},
              ${cx} ${philtrumY + openAmt + 1.5}
            C ${cx + size * 0.06} ${philtrumY + openAmt + 0.5},
              ${rcx - size * 0.06} ${cornerY + openAmt * 0.7},
              ${rcx - size * 0.02} ${cornerY + openAmt * 0.35}
          `}
          fill="none"
          stroke="hsla(30, 25%, 55%, 0.15)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        {/* Lower jaw shadow — subtle depth below jaw edge */}
        <path
          d={`
            M ${lcx + size * 0.03} ${cornerY + openAmt * 0.45 + 2}
            C ${lcx + size * 0.07} ${cornerY + openAmt * 0.8 + 2},
              ${cx - size * 0.05} ${philtrumY + openAmt + 3},
              ${cx} ${philtrumY + openAmt + 3.5}
            C ${cx + size * 0.05} ${philtrumY + openAmt + 3},
              ${rcx - size * 0.07} ${cornerY + openAmt * 0.8 + 2},
              ${rcx - size * 0.03} ${cornerY + openAmt * 0.45 + 2}
          `}
          fill="none"
          stroke="hsla(25, 20%, 15%, 0.12)"
          strokeWidth="2"
          filter="url(#lipSoft)"
          strokeLinecap="round"
        />

        {/* ── Mouth corner blends — soft radial shadows that merge into cheeks ── */}
        <circle
          cx={lcx - size * 0.01}
          cy={cornerY + openAmt * 0.15}
          r={size * 0.025 + openAmt * 0.15}
          fill="hsla(20, 25%, 12%, 0.2)"
          filter="url(#cornerBlend)"
        />
        <circle
          cx={rcx + size * 0.01}
          cy={cornerY + openAmt * 0.15}
          r={size * 0.025 + openAmt * 0.15}
          fill="hsla(20, 25%, 12%, 0.2)"
          filter="url(#cornerBlend)"
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

      {/* ── Upper Face (fixed, on top) ── */}
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
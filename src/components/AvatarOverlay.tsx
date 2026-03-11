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
const BASE_MOUTH_Y = 74;

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
  [20,  99],
  [24,  92],
  [27,  84],
  [30,  78],
  [33,  75],
  [35,  74],     // left mouth corner
  [37,  74.3],
  [39,  74.7],
  [41,  75],
  [43,  75.2],   // left lobe
  [45,  74.9],
  [47,  74.5],
  [49,  74.2],
  [50,  74],     // philtrum center (= BASE_MOUTH_Y)
  [51,  74.2],
  [53,  74.5],
  [55,  74.9],
  [57,  75.2],   // right lobe
  [59,  75],
  [61,  74.7],
  [63,  74.3],
  [65,  74],     // right mouth corner
  [67,  75],
  [70,  78],
  [73,  84],
  [76,  92],
  [80,  99],
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
  const upperLip = landmarks[13];
  const lowerLip = landmarks[14];
  const forehead = landmarks[10];
  const chin = landmarks[152];

  if (!upperLip || !lowerLip || !forehead || !chin) return BASE_MOUTH_Y;

  const faceTop = forehead.y;
  const faceBottom = chin.y;
  const faceHeight = faceBottom - faceTop;
  if (faceHeight <= 0) return BASE_MOUTH_Y;

  const mouthCenterY = (upperLip.y + lowerLip.y) / 2;
  const faceRelative = (mouthCenterY - faceTop) / faceHeight; // 0-1 within face
  // Map to avatar image space: tiger face spans ~20% to ~85% of image
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
          <radialGradient id="mouthCavity" cx="50%" cy="25%" rx="45%" ry="55%">
            <stop offset="0%" stopColor="hsl(350, 18%, 14%)" />
            <stop offset="50%" stopColor="hsl(345, 30%, 8%)" />
            <stop offset="100%" stopColor="hsl(340, 35%, 4%)" />
          </radialGradient>
          <filter id="lipSoft" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
          <filter id="seamSoft" x="-15%" y="-40%" width="130%" height="180%">
            <feGaussianBlur stdDeviation="1" />
          </filter>
          <filter id="depthSoft" x="-10%" y="-30%" width="120%" height="160%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
          <filter id="cornerBlend" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4.5" />
          </filter>
        </defs>

        {/* ── Mouth cavity — soft dark interior visible through the slit ── */}
        <path
          d={`
            M ${lcx + size * 0.01} ${cornerY}
            C ${lcx + size * 0.05} ${cornerY - 1.5},
              ${cx - size * 0.08} ${philtrumY - 0.5},
              ${cx} ${philtrumY}
            C ${cx + size * 0.08} ${philtrumY - 0.5},
              ${rcx - size * 0.05} ${cornerY - 1.5},
              ${rcx - size * 0.01} ${cornerY}
            C ${rcx - size * 0.025} ${cornerY + openAmt * 0.25},
              ${rcx - size * 0.07} ${cornerY + openAmt * 0.65},
              ${cx + size * 0.05} ${philtrumY + openAmt + 1}
            C ${cx + size * 0.015} ${philtrumY + openAmt + 1.8},
              ${cx - size * 0.015} ${philtrumY + openAmt + 1.8},
              ${cx - size * 0.05} ${philtrumY + openAmt + 1}
            C ${lcx + size * 0.07} ${cornerY + openAmt * 0.65},
              ${lcx + size * 0.025} ${cornerY + openAmt * 0.25},
              ${lcx + size * 0.01} ${cornerY}
            Z
          `}
          fill="url(#mouthCavity)"
          filter="url(#seamSoft)"
          opacity={jawRaw < 0.01 ? 0.3 : Math.min(0.3 + jawRaw * 2.5, 1)}
        />

        {/* ── Upper lip underside — thin dark crease right above the slit ── */}
        {/* This creates the "overhang" depth: the upper lip casts a tiny shadow into the opening */}
        <path
          d={`
            M ${lcx + size * 0.03} ${cornerY - 0.5}
            C ${lcx + size * 0.06} ${cornerY - 2},
              ${cx - size * 0.07} ${philtrumY - 1.5},
              ${cx} ${philtrumY - 1}
            C ${cx + size * 0.07} ${philtrumY - 1.5},
              ${rcx - size * 0.06} ${cornerY - 2},
              ${rcx - size * 0.03} ${cornerY - 0.5}
          `}
          fill="none"
          stroke="hsla(20, 15%, 8%, 0.18)"
          strokeWidth="1.8"
          filter="url(#depthSoft)"
          strokeLinecap="round"
        />

        {/* ── Upper lip form — very subtle broad shadow above ── */}
        <path
          d={`
            M ${lcx - size * 0.03} ${cornerY - 1}
            C ${lcx + size * 0.02} ${cornerY - 5},
              ${cx - size * 0.10} ${philtrumY - 5.5},
              ${cx} ${philtrumY - 5}
            C ${cx + size * 0.10} ${philtrumY - 5.5},
              ${rcx - size * 0.02} ${cornerY - 5},
              ${rcx + size * 0.03} ${cornerY - 1}
            C ${rcx - size * 0.01} ${cornerY - 0.5},
              ${cx + size * 0.08} ${philtrumY + 0.3},
              ${cx} ${philtrumY + 0.3}
            C ${cx - size * 0.08} ${philtrumY + 0.3},
              ${lcx + size * 0.01} ${cornerY - 0.5},
              ${lcx - size * 0.03} ${cornerY - 1}
            Z
          `}
          fill="hsla(25, 20%, 10%, 0.08)"
          filter="url(#lipSoft)"
        />

        {/* ── Slit seam line — the actual lip-contact line, very subtle ── */}
        <path
          d={`
            M ${lcx + size * 0.01} ${cornerY}
            C ${lcx + size * 0.05} ${cornerY - 1.5},
              ${cx - size * 0.08} ${philtrumY - 0.5},
              ${cx} ${philtrumY}
            C ${cx + size * 0.08} ${philtrumY - 0.5},
              ${rcx - size * 0.05} ${cornerY - 1.5},
              ${rcx - size * 0.01} ${cornerY}
          `}
          fill="none"
          stroke="hsla(20, 18%, 10%, 0.16)"
          strokeWidth="0.6"
          filter="url(#depthSoft)"
          strokeLinecap="round"
        />

        {/* ── Lower jaw top edge — faint light catch on the chin edge ── */}
        <path
          d={`
            M ${lcx + size * 0.03} ${cornerY + openAmt * 0.3 + 0.5}
            C ${lcx + size * 0.07} ${cornerY + openAmt * 0.65 + 0.5},
              ${cx - size * 0.05} ${philtrumY + openAmt + 1},
              ${cx} ${philtrumY + openAmt + 1.8}
            C ${cx + size * 0.05} ${philtrumY + openAmt + 1},
              ${rcx - size * 0.07} ${cornerY + openAmt * 0.65 + 0.5},
              ${rcx - size * 0.03} ${cornerY + openAmt * 0.3 + 0.5}
          `}
          fill="none"
          stroke="hsla(35, 25%, 60%, 0.07)"
          strokeWidth="0.6"
          filter="url(#depthSoft)"
          strokeLinecap="round"
        />

        {/* ── Lower jaw underside shadow — subtle depth below jaw edge ── */}
        <path
          d={`
            M ${lcx + size * 0.04} ${cornerY + openAmt * 0.4 + 3}
            C ${lcx + size * 0.08} ${cornerY + openAmt * 0.75 + 3.5},
              ${cx - size * 0.04} ${philtrumY + openAmt + 4.5},
              ${cx} ${philtrumY + openAmt + 5}
            C ${cx + size * 0.04} ${philtrumY + openAmt + 4.5},
              ${rcx - size * 0.08} ${cornerY + openAmt * 0.75 + 3.5},
              ${rcx - size * 0.04} ${cornerY + openAmt * 0.4 + 3}
          `}
          fill="none"
          stroke="hsla(25, 15%, 12%, 0.07)"
          strokeWidth="2"
          filter="url(#lipSoft)"
          strokeLinecap="round"
        />

        {/* ── Mouth corners — soft fades into cheeks ── */}
        <ellipse
          cx={lcx - size * 0.005}
          cy={cornerY + openAmt * 0.08}
          rx={size * 0.025 + openAmt * 0.1}
          ry={size * 0.018 + openAmt * 0.08}
          fill="hsla(20, 18%, 10%, 0.14)"
          filter="url(#cornerBlend)"
        />
        <ellipse
          cx={rcx + size * 0.005}
          cy={cornerY + openAmt * 0.08}
          rx={size * 0.025 + openAmt * 0.1}
          ry={size * 0.018 + openAmt * 0.08}
          fill="hsla(20, 18%, 10%, 0.14)"
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
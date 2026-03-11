/**
 * AvatarOverlay
 *
 * Three-layer mouth with W-shaped feline muzzle contour:
 *   1. Background: Detailed mouth cavity (burgundy + tongue + fierce cartoon fangs)
 *   2. Middle: Lower jaw (W-contour top edge, translates down with jawOpen)
 *   3. Top: Upper face (W-contour bottom edge, fixed)
 * Uses CSS clip-path polygons for the W-shape. No SVG masks.
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

const MAX_JAW_PX = 55;

/**
 * Soft, rounded feline upper-lip W-contour.
 * Flat at the sides (cheeks), curving into a natural cat-lip M/W shape
 * only in the central muzzle zone (~30–70% x). The two whisker-pad
 * bumps peak at ~66.5% y, dipping to ~68% at the philtrum center.
 * Format: [x%, y%]
 */
const W_POINTS: [number, number][] = [
  // ── left cheek (flat) ──
  [0,   63],
  [8,   63],
  [16,  63],
  [22,  63],
  // ── transition into left whisker pad ──
  [26,  63.2],
  [29,  63.6],
  [31,  64.2],
  [33,  64.8],
  // ── left whisker-pad bump (soft peak) ──
  [35,  65.4],
  [37,  65.9],
  [38.5,66.2],
  [40,  66.5],   // left pad apex
  [41.5,66.4],
  [43,  66.0],
  // ── valley between pad and philtrum ──
  [44.5,65.8],
  [46,  66.0],
  [47.5,66.6],
  [49,  67.4],
  [50,  67.8],   // philtrum center – deepest point
  [51,  67.4],
  [52.5,66.6],
  [54,  66.0],
  [55.5,65.8],
  // ── right whisker-pad bump ──
  [57,  66.0],
  [58.5,66.4],
  [60,  66.5],   // right pad apex
  [61.5,66.2],
  [63,  65.9],
  [65,  65.4],
  // ── transition out of right whisker pad ──
  [67,  64.8],
  [69,  64.2],
  [71,  63.6],
  [74,  63.2],
  // ── right cheek (flat) ──
  [78,  63],
  [84,  63],
  [92,  63],
  [100, 63],
];

/** Build CSS clip-path polygon for the UPPER face (everything above the W) */
function upperClipPath(): string {
  return `polygon(0% 0%, 100% 0%, 100% ${W_POINTS[W_POINTS.length - 1][1]}%, ${
    [...W_POINTS].reverse().map(([x, y]) => `${x}% ${y}%`).join(", ")
  }, 0% ${W_POINTS[0][1]}%)`;
}

/** Build CSS clip-path polygon for the LOWER jaw (everything below the W) */
function lowerClipPath(): string {
  const wPath = W_POINTS.map(([x, y]) => `${x}% ${y}%`).join(", ");
  return `polygon(${wPath}, 100% ${W_POINTS[W_POINTS.length - 1][1]}%, 100% 100%, 0% 100%, 0% ${W_POINTS[0][1]}%)`;
}

const UPPER_CLIP = upperClipPath();
const LOWER_CLIP = lowerClipPath();

export default function AvatarOverlay({
  landmarks,
  transformationMatrix,
  blendshapes,
  width,
  height,
  avatarSrc = babyTigerSrc,
}: AvatarOverlayProps) {
  const smoothJawRef = useRef(0);

  // Smooth jawOpen — using raw value 0-1 for scaleY factor
  const jawRaw = useMemo(() => {
    const raw = blendshapes?.["jawOpen"] ?? 0;
    smoothJawRef.current = lerp(smoothJawRef.current, raw, 0.3);
    return smoothJawRef.current;
  }, [blendshapes]);

  const jawDrop = jawRaw * MAX_JAW_PX;

  const containerStyle = useMemo(() => {
    const size = Math.min(width, height) * 0.8;
    const cx = width / 2;
    const cy = height / 2;

    let rotate = "none";
    if (transformationMatrix && transformationMatrix.data?.length >= 16) {
      const { pitch, yaw, roll } = matrixToEuler(transformationMatrix.data);
      rotate = `rotateX(${pitch}deg) rotateY(${-yaw}deg) rotateZ(${-roll}deg)`;
    }

    return {
      position: "absolute" as const,
      left: cx - size / 2,
      top: cy - size / 2,
      width: size,
      height: size + MAX_JAW_PX,
      transform: rotate,
      transformStyle: "preserve-3d" as const,
      pointerEvents: "none" as const,
      willChange: "transform",
    };
  }, [transformationMatrix, width, height]);

  const size = Math.min(width, height) * 0.8;
  // Average Y of the W for cavity positioning
  const avgWY = (W_POINTS.reduce((s, [, y]) => s + y, 0) / W_POINTS.length / 100) * size;

  return (
    <div style={containerStyle}>
      {/* ── LAYER 1: Mouth Cavity with Fierce Dentition ── */}
      <svg
        style={{
          position: "absolute",
          left: 0,
          top: avgWY - 10,
          width: size,
          height: jawDrop + 40,
          pointerEvents: "none",
          zIndex: 0,
          opacity: jawRaw < 0.05 ? 0 : Math.min((jawRaw - 0.05) / 0.1, 1),
          transition: "opacity 0.08s ease",
        }}
        viewBox={`0 0 ${size} ${jawDrop + 40}`}
      >
        {/* Deep burgundy cavity */}
        <ellipse
          cx={size / 2}
          cy={jawDrop * 0.45 + 10}
          rx={size * 0.12 + jawDrop * 0.4}
          ry={Math.max(jawDrop * 0.5, 0.5)}
          fill="hsl(340, 45%, 15%)"
        />
        {/* Inner cavity gradient - darker center */}
        <ellipse
          cx={size / 2}
          cy={jawDrop * 0.45 + 10}
          rx={size * 0.08 + jawDrop * 0.25}
          ry={Math.max(jawDrop * 0.35, 0.3)}
          fill="hsl(340, 50%, 10%)"
        />
        {/* Soft pink tongue - rounded and cute */}
        <ellipse
          cx={size / 2}
          cy={jawDrop * 0.55 + 14}
          rx={size * 0.06 + jawDrop * 0.15}
          ry={Math.max(jawDrop * 0.22, 0.3)}
          fill="hsl(350, 60%, 58%)"
        />
        {/* Tongue highlight */}
        <ellipse
          cx={size / 2 - 2}
          cy={jawDrop * 0.52 + 13}
          rx={size * 0.03 + jawDrop * 0.06}
          ry={Math.max(jawDrop * 0.1, 0.2)}
          fill="hsl(350, 65%, 68%)"
          opacity="0.6"
        />

        {/* ── UPPER TEETH (hang from upper jaw) ── */}
        {/* Left canine fang — prominent & sharp */}
        <polygon
          points={`
            ${size * 0.38},2
            ${size * 0.38 + 5},2
            ${size * 0.38 + 4},${Math.min(6 + jawDrop * 0.5, 22)}
            ${size * 0.38 + 1},${Math.min(8 + jawDrop * 0.55, 25)}
            ${size * 0.38 - 1},${Math.min(4 + jawDrop * 0.3, 15)}
          `}
          fill="hsl(45, 20%, 96%)"
          stroke="hsl(40, 15%, 88%)"
          strokeWidth="0.5"
          opacity={Math.min(jawDrop / 5, 1)}
        />
        {/* Right canine fang — prominent & sharp */}
        <polygon
          points={`
            ${size * 0.62 - 5},2
            ${size * 0.62},2
            ${size * 0.62 + 1},${Math.min(4 + jawDrop * 0.3, 15)}
            ${size * 0.62 - 1},${Math.min(8 + jawDrop * 0.55, 25)}
            ${size * 0.62 - 4},${Math.min(6 + jawDrop * 0.5, 22)}
          `}
          fill="hsl(45, 20%, 96%)"
          stroke="hsl(40, 15%, 88%)"
          strokeWidth="0.5"
          opacity={Math.min(jawDrop / 5, 1)}
        />
        {/* Upper incisors — small rounded teeth between canines */}
        {[-8, -3, 2, 7].map((xOff, i) => (
          <rect
            key={`ui-${i}`}
            x={size / 2 + xOff - 2.5}
            y={2}
            width="5"
            height={Math.min(3 + jawDrop * 0.18, 9)}
            rx="1.8"
            ry="1.8"
            fill="hsl(45, 18%, 95%)"
            stroke="hsl(40, 12%, 90%)"
            strokeWidth="0.3"
            opacity={Math.min(jawDrop / 6, 1)}
          />
        ))}

        {/* ── LOWER TEETH (rise from lower jaw) ── */}
        {/* Lower canine stubs */}
        <polygon
          points={`
            ${size * 0.39},${jawDrop * 0.75 + 8}
            ${size * 0.39 + 4},${jawDrop * 0.75 + 8}
            ${size * 0.39 + 3},${jawDrop * 0.75 + 8 - Math.min(jawDrop * 0.3, 12)}
            ${size * 0.39 + 1},${jawDrop * 0.75 + 8 - Math.min(jawDrop * 0.35, 14)}
          `}
          fill="hsl(45, 18%, 94%)"
          stroke="hsl(40, 12%, 88%)"
          strokeWidth="0.3"
          opacity={Math.min(jawDrop / 6, 1)}
        />
        <polygon
          points={`
            ${size * 0.61 - 4},${jawDrop * 0.75 + 8}
            ${size * 0.61},${jawDrop * 0.75 + 8}
            ${size * 0.61 - 1},${jawDrop * 0.75 + 8 - Math.min(jawDrop * 0.35, 14)}
            ${size * 0.61 - 3},${jawDrop * 0.75 + 8 - Math.min(jawDrop * 0.3, 12)}
          `}
          fill="hsl(45, 18%, 94%)"
          stroke="hsl(40, 12%, 88%)"
          strokeWidth="0.3"
          opacity={Math.min(jawDrop / 6, 1)}
        />
        {/* Lower incisors */}
        {[-5, 0, 5].map((xOff, i) => (
          <rect
            key={`li-${i}`}
            x={size / 2 + xOff - 2}
            y={jawDrop * 0.75 + 8 - Math.min(2.5 + jawDrop * 0.1, 6)}
            width="4"
            height={Math.min(2.5 + jawDrop * 0.1, 6)}
            rx="1.5"
            ry="1.5"
            fill="hsl(45, 15%, 93%)"
            stroke="hsl(40, 10%, 88%)"
            strokeWidth="0.3"
            opacity={Math.min(jawDrop / 6, 1)}
          />
        ))}
      </svg>

      {/* ── LAYER 2: Lower Jaw (W-contour, translates down with jawOpen) ── */}
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
          style={{
            width: size,
            height: size,
            display: "block",
          }}
        />
      </div>

      {/* ── LAYER 3: Upper Face (W-contour, fixed on top) ── */}
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
          style={{
            width: size,
            height: size,
            display: "block",
          }}
        />
      </div>

      {/* ── Elastic cheek connectors at W endpoints ── */}
      {jawDrop > 1.5 && (
        <svg
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: size,
            height: size + MAX_JAW_PX,
            pointerEvents: "none",
            zIndex: 3,
          }}
          viewBox={`0 0 ${size} ${size + MAX_JAW_PX}`}
        >
          {/* Left elastic connector — from left mouth corner W point */}
          <path
            d={`M ${size * 0.22} ${size * 0.76}
                Q ${size * 0.19} ${size * 0.76 + jawDrop * 0.5}
                  ${size * 0.22} ${size * 0.76 + jawDrop}`}
            stroke="hsl(28, 45%, 60%)"
            strokeWidth="2.5"
            fill="none"
            opacity={Math.min(jawDrop / 12, 0.45)}
            strokeLinecap="round"
          />
          {/* Right elastic connector */}
          <path
            d={`M ${size * 0.78} ${size * 0.76}
                Q ${size * 0.81} ${size * 0.76 + jawDrop * 0.5}
                  ${size * 0.78} ${size * 0.76 + jawDrop}`}
            stroke="hsl(28, 45%, 60%)"
            strokeWidth="2.5"
            fill="none"
            opacity={Math.min(jawDrop / 12, 0.45)}
            strokeLinecap="round"
          />
          {/* Skin-fill between upper and lower along the W edges */}
          {jawDrop > 3 && (
            <>
              <path
                d={`M ${size * 0.12} ${size * 0.73}
                    Q ${size * 0.14} ${size * 0.73 + jawDrop * 0.5}
                      ${size * 0.12} ${size * 0.73 + jawDrop}`}
                stroke="hsl(30, 50%, 65%)"
                strokeWidth="1.5"
                fill="none"
                opacity={Math.min(jawDrop / 20, 0.3)}
                strokeLinecap="round"
              />
              <path
                d={`M ${size * 0.88} ${size * 0.73}
                    Q ${size * 0.86} ${size * 0.73 + jawDrop * 0.5}
                      ${size * 0.88} ${size * 0.73 + jawDrop}`}
                stroke="hsl(30, 50%, 65%)"
                strokeWidth="1.5"
                fill="none"
                opacity={Math.min(jawDrop / 20, 0.3)}
                strokeLinecap="round"
              />
            </>
          )}
        </svg>
      )}
    </div>
  );
}

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

/**
 * Simple W-contour for feline upper lip.
 *
 * Edges sit at y=100% (no split at face sides).
 * Mouth corners at ~25% and ~75% x.
 * Lip line at ~74% y with gentle W-shape whisker-pad lobes.
 *
 * Format: [x%, y%]
 */
const W_POINTS: [number, number][] = [
  [0,   100],
  [10,  100],
  // smooth rise from chin into left mouth corner
  [15,  96],
  [18,  88],
  [20,  82],
  [22,  78],
  [24,  75.5],
  [25.5, 74],    // left mouth corner
  // left whisker-pad lobe
  [28,  73],
  [31,  72.2],
  [34,  71.8],
  [37,  71.5],
  [40,  71.4],   // left lobe bottom
  [43,  71.6],
  // philtrum center
  [46,  72],
  [48,  71.8],
  [50,  71.5],   // center — slight rise
  [52,  71.8],
  [54,  72],
  // right whisker-pad lobe
  [57,  71.6],
  [60,  71.4],   // right lobe bottom
  [63,  71.5],
  [66,  71.8],
  [69,  72.2],
  [72,  73],
  [74.5, 74],    // right mouth corner
  // smooth descent back to chin
  [76,  75.5],
  [78,  78],
  [80,  82],
  [82,  88],
  [85,  96],
  [90,  100],
  [100, 100],
];

/** Upper face clip: everything above the W-contour */
function upperClipPath(): string {
  const rev = [...W_POINTS].reverse().map(([x, y]) => `${x}% ${y}%`).join(", ");
  return `polygon(0% 0%, 100% 0%, 100% 100%, ${rev}, 0% 100%)`;
}

/** Lower jaw clip: everything below the W-contour */
function lowerClipPath(): string {
  const fwd = W_POINTS.map(([x, y]) => `${x}% ${y}%`).join(", ");
  return `polygon(${fwd}, 100% 100%, 0% 100%)`;
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

  // Mouth corner positions in px (for corner fills)
  const lcx = size * 0.255;  // left corner x
  const rcx = size * 0.745;  // right corner x
  const cy = size * 0.74;    // corner y

  return (
    <div style={containerStyle}>
      {/* ── Dark mouth cavity background ── */}
      {/* This is just a dark shape behind the face layers.
          The gap between upper and lower clips reveals it. */}
      <div
        style={{
          position: "absolute",
          left: lcx - 4,
          top: cy - 6,
          width: rcx - lcx + 8,
          height: jawDrop + 16,
          background: "radial-gradient(ellipse at 50% 30%, hsl(340, 50%, 12%), hsl(340, 55%, 6%))",
          borderRadius: "0 0 40% 40%",
          zIndex: 0,
          opacity: jawRaw < 0.02 ? 0 : Math.min((jawRaw - 0.02) / 0.06, 1),
          transition: "opacity 0.08s ease",
        }}
      />

      {/* ── Corner skin fills: bridge mouth corners into cheeks ── */}
      {jawDrop > 1 && (
        <svg
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: size,
            height: size + MAX_JAW_PX,
            pointerEvents: "none",
            zIndex: 1,
          }}
          viewBox={`0 0 ${size} ${size + MAX_JAW_PX}`}
        >
          {/* Left corner — smooth triangular fill connecting upper to lower */}
          <path
            d={`M ${lcx} ${cy}
                C ${lcx - 10} ${cy + jawDrop * 0.3},
                  ${lcx - 10} ${cy + jawDrop * 0.7},
                  ${lcx} ${cy + jawDrop}
                L ${lcx + 14} ${cy + jawDrop * 0.5}
                Z`}
            fill="hsl(30, 52%, 67%)"
            opacity={Math.min(jawDrop / 6, 0.6)}
          />
          {/* Right corner */}
          <path
            d={`M ${rcx} ${cy}
                C ${rcx + 10} ${cy + jawDrop * 0.3},
                  ${rcx + 10} ${cy + jawDrop * 0.7},
                  ${rcx} ${cy + jawDrop}
                L ${rcx - 14} ${cy + jawDrop * 0.5}
                Z`}
            fill="hsl(30, 52%, 67%)"
            opacity={Math.min(jawDrop / 6, 0.6)}
          />
        </svg>
      )}

      {/* ── Lower Jaw (translates down with jawOpen) ── */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: size,
          height: size,
          clipPath: LOWER_CLIP,
          zIndex: 2,
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
          zIndex: 3,
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

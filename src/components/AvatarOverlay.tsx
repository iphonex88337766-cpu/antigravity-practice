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
 * Subtle natural feline upper-lip contour.
 *
 * Soft W-shape with only ~2.5% vertical variation — enough to read
 * as a real tiger cub lip boundary, not a decorative graphic curve.
 * Lip line sits at ~75% y (center of the muzzle-to-chin zone).
 * Corners slightly higher (~74%), lobes slightly lower (~76.5%).
 *
 * Edges at y=100% so face sides are never split.
 * Format: [x%, y%]
 */
const W_POINTS: [number, number][] = [
  [0,   100],
  [8,   100],
  // gradual rise into left mouth corner
  [12,  98],
  [15,  94],
  [18,  88],
  [20,  83],
  [22,  79],
  [24,  76.5],
  [26,  75],
  [28,  74.2],
  [30,  73.8],   // left mouth corner
  // gentle descent into left whisker-pad lobe
  [32,  74.2],
  [34,  74.8],
  [36,  75.3],
  [38,  75.7],
  [40,  76],
  [42,  76.2],   // left lobe bottom
  [44,  76],
  [46,  75.6],
  // subtle philtrum rise
  [48,  75.2],
  [50,  75],     // philtrum center
  [52,  75.2],
  [54,  75.6],
  // right whisker-pad lobe
  [56,  76],
  [58,  76.2],   // right lobe bottom
  [60,  76],
  [62,  75.7],
  [64,  75.3],
  [66,  74.8],
  [68,  74.2],
  [70,  73.8],   // right mouth corner
  // gradual descent back to chin
  [72,  74.2],
  [74,  75],
  [76,  76.5],
  [78,  79],
  [80,  83],
  [82,  88],
  [85,  94],
  [88,  98],
  [92,  100],
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

  // Mouth reference positions for the cavity slit
  const lcx = size * 0.30;      // left corner x
  const rcx = size * 0.70;      // right corner x
  const cornerY = size * 0.738; // corner y
  const lobeY = size * 0.762;   // lobe deepest y
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

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
 * Feline upper-lip contour — positioned in the MOUTH zone (~59-62% y),
 * directly under the nose, not on the lower jaw.
 *
 * Small, subtle W-shape. Edges at y=100% so sides never split.
 * Format: [x%, y%]
 */
const W_POINTS: [number, number][] = [
  [0,   100],
  [10,  100],
  // rise into left mouth corner
  [15,  95],
  [20,  85],
  [24,  75],
  [27,  68],
  [30,  64],
  [33,  61.5],
  [35,  60.5],   // left mouth corner
  // subtle W across muzzle
  [37,  60.8],
  [39,  61.2],
  [41,  61.5],
  [43,  61.7],   // left lobe
  [45,  61.4],
  [47,  61],
  [49,  60.6],
  [50,  60.4],   // philtrum center
  [51,  60.6],
  [53,  61],
  [55,  61.4],
  [57,  61.7],   // right lobe
  [59,  61.5],
  [61,  61.2],
  [63,  60.8],
  [65,  60.5],   // right mouth corner
  // descent back to chin
  [67,  61.5],
  [70,  64],
  [73,  68],
  [76,  75],
  [80,  85],
  [85,  95],
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

  // Mouth reference positions for the cavity slit
  const lcx = size * 0.35;      // left corner x
  const rcx = size * 0.65;      // right corner x
  const cornerY = size * 0.605; // corner y
  const lobeY = size * 0.617;   // lobe deepest y
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

/**
 * AvatarOverlay — Elastic jaw via clip-path deformation.
 *
 * The lower jaw is revealed by deforming a clip-path where:
 * - Left/right edges stay PINNED to the upper face
 * - Only the center chin stretches downward
 * - No translateY — continuous silhouette always
 * - Interior: Fangs > Tongue > Cavity (cavity fades in last)
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
  const r12 = data[6], r22 = data[10];
  const pitch = Math.atan2(-r12, r22) * (180 / Math.PI);
  const yaw = Math.asin(r02) * (180 / Math.PI);
  const roll = Math.atan2(-r01, r00) * (180 / Math.PI);
  return { pitch, yaw, roll };
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

const SZ = 500;
const MAX_DROP = 150;
const MOUTH_Y = 72; // % where mouth line sits
const DEAD_ZONE = 0.05;

/**
 * Build an elastic lower contour. Corners pinned at MOUTH_Y%,
 * center drops by `dropPct` percentage points.
 * Returns clip-path polygon points as "x% y%" strings.
 */
function elasticContour(dropPct: number): string {
  // Points from left edge to right edge along the mouth line.
  // Format: [x%, base_y%, elasticity 0-1]
  // elasticity=0 → pinned, elasticity=1 → full drop
  const pts: [number, number, number][] = [
    [0, 100, 0],    // left edge pinned to bottom
    [15, 100, 0],
    [25, MOUTH_Y, 0],       // left cheek — pinned
    [30, MOUTH_Y, 0.05],
    [34, MOUTH_Y, 0.12],    // left mouth corner
    [38, MOUTH_Y, 0.3],
    [42, MOUTH_Y, 0.6],
    [46, MOUTH_Y, 0.85],
    [50, MOUTH_Y, 1.0],     // center chin — full drop
    [54, MOUTH_Y, 0.85],
    [58, MOUTH_Y, 0.6],
    [62, MOUTH_Y, 0.3],
    [66, MOUTH_Y, 0.12],    // right mouth corner
    [70, MOUTH_Y, 0.05],
    [75, MOUTH_Y, 0],       // right cheek — pinned
    [85, 100, 0],
    [100, 100, 0],  // right edge pinned to bottom
  ];

  const polyPts = pts.map(([x, y, e]) => {
    const finalY = y + dropPct * e;
    return `${x}% ${Math.min(finalY, 100)}%`;
  });

  return `polygon(${polyPts.join(", ")})`;
}

/** Upper face clip — everything ABOVE the static mouth line */
function upperClip(): string {
  // Same points but reversed, cutting out everything below
  const pts: [number, number][] = [
    [100, 100], [85, 100],
    [75, MOUTH_Y], [70, MOUTH_Y], [66, MOUTH_Y],
    [62, MOUTH_Y], [58, MOUTH_Y], [54, MOUTH_Y],
    [50, MOUTH_Y], [46, MOUTH_Y], [42, MOUTH_Y],
    [38, MOUTH_Y], [34, MOUTH_Y], [30, MOUTH_Y],
    [25, MOUTH_Y], [15, 100], [0, 100],
  ];
  const rev = pts.map(([x, y]) => `${x}% ${y}%`).join(", ");
  return `polygon(0% 0%, 100% 0%, ${rev})`;
}

const UPPER_CLIP = upperClip();

/**
 * MouthInterior — SVG mouth contents rendered between upper and lower layers.
 */
function MouthInterior({ dropPx, t }: { dropPx: number; t: number }) {
  if (dropPx < 1) return null;

  const cx = SZ * 0.5;
  const mouthTop = SZ * (MOUTH_Y / 100);
  const openH = dropPx;
  const midY = mouthTop + openH * 0.4;
  const mouthW = SZ * 0.14;

  // Fangs and tongue appear FIRST, cavity deepens LAST
  const fangOpacity = Math.min(t * 5, 1);
  const tongueOpacity = Math.min(t * 3, 0.9);
  const cavityOpacity = Math.min(t * 2, 1.0) * 0.75; // mouthOpen * 2, clamped
  const fangLen = lerp(2, 13, t);

  return (
    <svg
      style={{
        position: "absolute",
        left: 0, top: 0,
        width: SZ, height: SZ + MAX_DROP,
        pointerEvents: "none",
        zIndex: 1,
      }}
      viewBox={`0 0 ${SZ} ${SZ + MAX_DROP}`}
    >
      <defs>
        <radialGradient id="cG" cx="50%" cy="35%" r="55%">
          <stop offset="0%" stopColor="hsl(350, 18%, 18%)" />
          <stop offset="100%" stopColor="hsl(340, 25%, 6%)" />
        </radialGradient>
        <filter id="sb"><feGaussianBlur stdDeviation="2" /></filter>
      </defs>

      {/* Layer 1: Dark cavity — appears LAST */}
      <ellipse cx={cx} cy={midY} rx={mouthW} ry={openH * 0.4}
        fill="url(#cG)" opacity={cavityOpacity} filter="url(#sb)" />

      {/* Layer 2: Tongue — appears early */}
      <ellipse cx={cx} cy={midY + openH * 0.1}
        rx={mouthW * 0.5} ry={Math.max(openH * 0.25, 2)}
        fill="hsl(350, 50%, 55%)" opacity={tongueOpacity} />

      {/* Layer 3: Left fang — appears FIRST */}
      <path
        d={`M ${cx - mouthW * 0.45} ${mouthTop - 1}
            L ${cx - mouthW * 0.28} ${mouthTop + fangLen}
            L ${cx - mouthW * 0.1} ${mouthTop - 1} Z`}
        fill="hsl(40, 20%, 95%)" opacity={fangOpacity} />

      {/* Layer 3: Right fang — appears FIRST */}
      <path
        d={`M ${cx + mouthW * 0.1} ${mouthTop - 1}
            L ${cx + mouthW * 0.28} ${mouthTop + fangLen}
            L ${cx + mouthW * 0.45} ${mouthTop - 1} Z`}
        fill="hsl(40, 20%, 95%)" opacity={fangOpacity} />
    </svg>
  );
}

export default function AvatarOverlay({
  landmarks, transformationMatrix, blendshapes,
  width, height, avatarSrc = babyTigerSrc,
}: AvatarOverlayProps) {
  const smoothJawRef = useRef(0);

  const jawRaw = blendshapes?.["jawOpen"] ?? 0;
  smoothJawRef.current = lerp(smoothJawRef.current, jawRaw, 0.18);
  const jawNorm = smoothJawRef.current;

  const isOpen = jawNorm > DEAD_ZONE;
  const t = isOpen ? Math.min(jawNorm * 1.8, 1) : 0;
  const dropPx = t * MAX_DROP;
  const dropPct = (dropPx / SZ) * 100; // as % of SZ for clip-path

  const lowerClip = elasticContour(dropPct);

  const containerStyle = useMemo(() => {
    const cx = width / 2;
    const cy = height / 2;
    let rotate = "none";
    if (transformationMatrix && transformationMatrix.data?.length >= 16) {
      const { pitch, yaw, roll } = matrixToEuler(transformationMatrix.data);
      rotate = `rotateX(${pitch}deg) rotateY(${-yaw}deg) rotateZ(${-roll}deg)`;
    }
    return {
      position: "absolute" as const,
      left: cx - SZ / 2, top: cy - SZ / 2,
      width: SZ, height: SZ + MAX_DROP,
      transform: rotate,
      transformStyle: "preserve-3d" as const,
      pointerEvents: "none" as const,
      willChange: "transform",
    };
  }, [transformationMatrix, width, height]);

  return (
    <div style={containerStyle}>
      {/* Base image — shown when closed, seamless */}
      <img src={avatarSrc} alt="Avatar" draggable={false}
        style={{
          position: "absolute", left: 0, top: 0,
          width: SZ, height: SZ, display: isOpen ? "none" : "block",
        }} />

      {isOpen && (
        <>
          {/* Upper face — static clip above mouth line */}
          <div style={{
            position: "absolute", left: 0, top: 0,
            width: SZ, height: SZ,
            clipPath: UPPER_CLIP, zIndex: 2,
          }}>
            <img src={avatarSrc} alt="" draggable={false}
              style={{ width: SZ, height: SZ, display: "block" }} />
          </div>

          {/* Mouth interior — between layers */}
          <MouthInterior dropPx={dropPx} t={t} />

          {/* Lower jaw — elastic clip, NO translateY. Corners pinned, center stretches */}
          <div style={{
            position: "absolute", left: 0, top: 0,
            width: SZ, height: SZ,
            clipPath: lowerClip, zIndex: 2,
            willChange: "clip-path",
          }}>
            <img src={avatarSrc} alt="" draggable={false}
              style={{ width: SZ, height: SZ, display: "block" }} />
          </div>
        </>
      )}
    </div>
  );
}

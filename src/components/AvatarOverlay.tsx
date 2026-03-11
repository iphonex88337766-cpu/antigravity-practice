/**
 * AvatarOverlay — Flower-bloom mouth with smooth W-contour split.
 *
 * Architecture:
 *   - Upper face: clipped above a smooth W-contour (nose stays fixed)
 *   - Lower jaw: clipped below the W-contour, translates down with jawOpen
 *   - Teeth & tongue SVG revealed behind the split
 *   - When jawOpen=0, the seam is invisible — perfect intact face
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

const SZ = 500;
const MAX_JAW_PX = 40;

/**
 * Smooth W-contour clip path points [x%, y%].
 * Sits at the base of the nose / upper lip line (~73% down).
 * Edges pinned to y=100% so sides never split.
 */
const W_CONTOUR: [number, number][] = [
  [0, 100],
  [12, 100],
  [18, 100],
  [22, 95],
  [26, 87],
  [29, 80],
  [32, 76],
  [34, 74],     // left mouth corner
  [36, 73.5],
  [39, 73.2],
  [42, 73],
  [44, 72.8],   // left W-lobe
  [46, 72.5],
  [48, 72.2],
  [50, 72],     // center philtrum (highest point)
  [52, 72.2],
  [54, 72.5],
  [56, 72.8],   // right W-lobe
  [58, 73],
  [61, 73.2],
  [64, 73.5],
  [66, 74],     // right mouth corner
  [68, 76],
  [71, 80],
  [74, 87],
  [78, 95],
  [82, 100],
  [88, 100],
  [100, 100],
];

/** Upper face clip: everything above the W-contour */
function upperClipPath(pts: [number, number][]): string {
  const reversed = [...pts].reverse().map(([x, y]) => `${x}% ${y}%`).join(", ");
  return `polygon(0% 0%, 100% 0%, 100% 100%, ${reversed}, 0% 100%)`;
}

/** Lower jaw clip: everything below the W-contour */
function lowerClipPath(pts: [number, number][]): string {
  const fwd = pts.map(([x, y]) => `${x}% ${y}%`).join(", ");
  return `polygon(${fwd}, 100% 100%, 0% 100%)`;
}

/** Teeth & tongue SVG revealed inside the mouth cavity */
function MouthInterior({ openAmount }: { openAmount: number }) {
  if (openAmount < 1) return null;

  const opacity = Math.min(openAmount / 8, 1);
  const tongueY = 72 + openAmount * 0.4;

  return (
    <svg
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: SZ,
        height: SZ + MAX_JAW_PX,
        pointerEvents: "none",
        zIndex: 0,
      }}
      viewBox={`0 0 ${SZ} ${SZ + MAX_JAW_PX}`}
    >
      <defs>
        <radialGradient id="cavityGrad" cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor="hsl(350, 20%, 12%)" />
          <stop offset="100%" stopColor="hsl(340, 30%, 5%)" />
        </radialGradient>
        <filter id="mouthSoft" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>

      {/* Dark mouth cavity */}
      <ellipse
        cx={SZ * 0.5}
        cy={SZ * 0.72 + openAmount * 0.35}
        rx={SZ * 0.12 + openAmount * 0.3}
        ry={openAmount * 0.45}
        fill="url(#cavityGrad)"
        opacity={opacity}
      />

      {/* Tongue — pink, visible when open */}
      {openAmount > 4 && (
        <ellipse
          cx={SZ * 0.5}
          cy={SZ * (tongueY / 100) + openAmount * 0.3}
          rx={SZ * 0.07 + openAmount * 0.15}
          ry={openAmount * 0.22}
          fill="hsl(350, 55%, 55%)"
          opacity={Math.min((openAmount - 4) / 12, 0.85)}
          filter="url(#mouthSoft)"
        />
      )}

      {/* Upper fangs — two small triangles */}
      {openAmount > 2 && (
        <>
          {/* Left fang */}
          <path
            d={`
              M ${SZ * 0.42} ${SZ * 0.72}
              L ${SZ * 0.44} ${SZ * 0.72 + Math.min(openAmount * 0.5, 16)}
              L ${SZ * 0.46} ${SZ * 0.72}
              Z
            `}
            fill="hsl(45, 10%, 95%)"
            opacity={Math.min((openAmount - 2) / 8, 0.9)}
          />
          {/* Right fang */}
          <path
            d={`
              M ${SZ * 0.54} ${SZ * 0.72}
              L ${SZ * 0.56} ${SZ * 0.72 + Math.min(openAmount * 0.5, 16)}
              L ${SZ * 0.58} ${SZ * 0.72}
              Z
            `}
            fill="hsl(45, 10%, 95%)"
            opacity={Math.min((openAmount - 2) / 8, 0.9)}
          />
        </>
      )}
    </svg>
  );
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

  // Smooth jaw tracking
  const jawRaw = blendshapes?.["jawOpen"] ?? 0;
  smoothJawRef.current = lerp(smoothJawRef.current, jawRaw, 0.22);
  const jawDrop = smoothJawRef.current * MAX_JAW_PX;

  const UPPER_CLIP = upperClipPath(W_CONTOUR);
  const LOWER_CLIP = lowerClipPath(W_CONTOUR);

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
      left: cx - SZ / 2,
      top: cy - SZ / 2,
      width: SZ,
      height: SZ + MAX_JAW_PX,
      transform: rotate,
      transformStyle: "preserve-3d" as const,
      pointerEvents: "none" as const,
      willChange: "transform",
    };
  }, [transformationMatrix, width, height]);

  return (
    <div style={containerStyle}>
      {/* Mouth interior — teeth, tongue, cavity (behind both face layers) */}
      <MouthInterior openAmount={jawDrop} />

      {/* Lower jaw — moves down with jawOpen */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: SZ,
          height: SZ,
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
          style={{ width: SZ, height: SZ, display: "block" }}
        />
      </div>

      {/* Upper face — fixed, on top (nose stays locked) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: SZ,
          height: SZ,
          clipPath: UPPER_CLIP,
          zIndex: 2,
        }}
      >
        <img
          src={avatarSrc}
          alt=""
          draggable={false}
          style={{ width: SZ, height: SZ, display: "block" }}
        />
      </div>
    </div>
  );
}

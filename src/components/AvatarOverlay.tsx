/**
 * AvatarOverlay — Seamless flower-bloom mouth.
 *
 * Key insight: When jawOpen=0, ONLY render the full unclipped image.
 * The W-contour split only activates when jaw begins opening,
 * with the lower jaw starting at 0px offset and smoothly parting.
 * No gap, no seam, no dark line — the split emerges from nothing.
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

/** Ease-out cubic for smooth bloom feel */
function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

const SZ = 500;
const MAX_JAW_PX = 40;
/** Threshold below which we render the full unbroken image */
const OPEN_THRESHOLD = 0.012;

/**
 * W-contour points [x%, y%] — sits at the tiger's upper lip line.
 * Edges pinned to 100% so sides never split.
 */
const W_CONTOUR: [number, number][] = [
  [0, 100], [12, 100], [18, 100],
  [22, 95], [26, 87], [29, 80], [32, 76],
  [34, 74],      // left corner
  [36, 73.5], [39, 73.2], [42, 73], [44, 72.8],
  [46, 72.5], [48, 72.2],
  [50, 72],      // philtrum center
  [52, 72.2], [54, 72.5],
  [56, 72.8], [58, 73], [61, 73.2], [64, 73.5],
  [66, 74],      // right corner
  [68, 76], [71, 80], [74, 87], [78, 95],
  [82, 100], [88, 100], [100, 100],
];

/** Upper face clip: everything above the W-contour */
function upperClip(pts: [number, number][]): string {
  const rev = [...pts].reverse().map(([x, y]) => `${x}% ${y}%`).join(", ");
  return `polygon(0% 0%, 100% 0%, 100% 100%, ${rev}, 0% 100%)`;
}

/** Lower jaw clip: everything below the W-contour */
function lowerClip(pts: [number, number][]): string {
  const fwd = pts.map(([x, y]) => `${x}% ${y}%`).join(", ");
  return `polygon(${fwd}, 100% 100%, 0% 100%)`;
}

const UPPER_CLIP = upperClip(W_CONTOUR);
const LOWER_CLIP = lowerClip(W_CONTOUR);

/** Mouth interior — teeth + tongue, only when visibly open */
function MouthInterior({ jawDrop }: { jawDrop: number }) {
  if (jawDrop < 2) return null;

  const bloom = easeOut(Math.min(jawDrop / MAX_JAW_PX, 1));
  const cavityOpacity = Math.min(bloom * 1.5, 1);

  // Cavity center Y in pixels — right at the contour line
  const contourY = SZ * 0.72;
  const cavityCY = contourY + jawDrop * 0.35;

  return (
    <svg
      style={{
        position: "absolute",
        left: 0, top: 0,
        width: SZ, height: SZ + MAX_JAW_PX,
        pointerEvents: "none",
        zIndex: 0,
      }}
      viewBox={`0 0 ${SZ} ${SZ + MAX_JAW_PX}`}
    >
      <defs>
        <radialGradient id="cavG" cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor="hsl(350, 20%, 12%)" />
          <stop offset="100%" stopColor="hsl(340, 30%, 5%)" />
        </radialGradient>
        <filter id="mSoft">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>

      {/* Dark cavity — grows with bloom */}
      <ellipse
        cx={SZ * 0.5}
        cy={cavityCY}
        rx={SZ * 0.10 * bloom + jawDrop * 0.25}
        ry={jawDrop * 0.42}
        fill="url(#cavG)"
        opacity={cavityOpacity}
      />

      {/* Tongue */}
      {jawDrop > 6 && (
        <ellipse
          cx={SZ * 0.5}
          cy={cavityCY + jawDrop * 0.12}
          rx={SZ * 0.06 + jawDrop * 0.12}
          ry={jawDrop * 0.18}
          fill="hsl(350, 55%, 55%)"
          opacity={Math.min((jawDrop - 6) / 15, 0.8)}
          filter="url(#mSoft)"
        />
      )}

      {/* Fangs — small triangles that emerge */}
      {jawDrop > 3 && (
        <>
          <path
            d={`M ${SZ * 0.43} ${contourY}
                L ${SZ * 0.445} ${contourY + Math.min(jawDrop * 0.45, 14)}
                L ${SZ * 0.46} ${contourY} Z`}
            fill="hsl(45, 10%, 95%)"
            opacity={Math.min((jawDrop - 3) / 10, 0.9)}
          />
          <path
            d={`M ${SZ * 0.54} ${contourY}
                L ${SZ * 0.555} ${contourY + Math.min(jawDrop * 0.45, 14)}
                L ${SZ * 0.57} ${contourY} Z`}
            fill="hsl(45, 10%, 95%)"
            opacity={Math.min((jawDrop - 3) / 10, 0.9)}
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

  const jawRaw = blendshapes?.["jawOpen"] ?? 0;
  // Smooth with non-linear interpolation for bloom feel
  smoothJawRef.current = lerp(smoothJawRef.current, jawRaw, 0.18);
  const jawNorm = smoothJawRef.current;
  const jawDrop = easeOut(Math.min(jawNorm, 1)) * MAX_JAW_PX;

  // Below threshold = render single unbroken image (zero seam)
  const isOpen = jawNorm > OPEN_THRESHOLD;

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
      height: SZ + (isOpen ? MAX_JAW_PX : 0),
      transform: rotate,
      transformStyle: "preserve-3d" as const,
      pointerEvents: "none" as const,
      willChange: "transform",
    };
  }, [transformationMatrix, width, height, isOpen]);

  // When closed: single clean image, no clips, no seam
  if (!isOpen) {
    return (
      <div style={containerStyle}>
        <img
          src={avatarSrc}
          alt="Avatar"
          draggable={false}
          style={{ width: SZ, height: SZ, display: "block" }}
        />
      </div>
    );
  }

  // When open: bloom split
  return (
    <div style={containerStyle}>
      {/* Mouth interior behind both layers */}
      <MouthInterior jawDrop={jawDrop} />

      {/* Lower jaw — parts downward */}
      <div
        style={{
          position: "absolute",
          left: 0, top: 0,
          width: SZ, height: SZ,
          clipPath: LOWER_CLIP,
          zIndex: 1,
          transform: `translateY(${jawDrop}px)`,
          willChange: "transform",
        }}
      >
        <img src={avatarSrc} alt="" draggable={false}
          style={{ width: SZ, height: SZ, display: "block" }} />
      </div>

      {/* Upper face — fixed, nose stays locked */}
      <div
        style={{
          position: "absolute",
          left: 0, top: 0,
          width: SZ, height: SZ,
          clipPath: UPPER_CLIP,
          zIndex: 2,
        }}
      >
        <img src={avatarSrc} alt="" draggable={false}
          style={{ width: SZ, height: SZ, display: "block" }} />
      </div>
    </div>
  );
}

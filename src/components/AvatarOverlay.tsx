/**
 * AvatarOverlay — Seamless flower-bloom mouth with layered reveal.
 *
 * When closed: single unclipped image, zero seam.
 * Opening: fangs/tongue appear first, dark cavity fades in gradually.
 * W-contour edges are feathered during transition for soft petal parting.
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

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

const SZ = 500;
const MAX_JAW_PX = 40;
const OPEN_THRESHOLD = 0.012;

const W_CONTOUR: [number, number][] = [
  [0, 100], [12, 100], [18, 100],
  [22, 95], [26, 87], [29, 80], [32, 76],
  [34, 74],
  [36, 73.5], [39, 73.2], [42, 73], [44, 72.8],
  [46, 72.5], [48, 72.2],
  [50, 72],
  [52, 72.2], [54, 72.5],
  [56, 72.8], [58, 73], [61, 73.2], [64, 73.5],
  [66, 74],
  [68, 76], [71, 80], [74, 87], [78, 95],
  [82, 100], [88, 100], [100, 100],
];

function upperClip(pts: [number, number][]): string {
  const rev = [...pts].reverse().map(([x, y]) => `${x}% ${y}%`).join(", ");
  return `polygon(0% 0%, 100% 0%, 100% 100%, ${rev}, 0% 100%)`;
}

function lowerClip(pts: [number, number][]): string {
  const fwd = pts.map(([x, y]) => `${x}% ${y}%`).join(", ");
  return `polygon(${fwd}, 100% 100%, 0% 100%)`;
}

const UPPER_CLIP = upperClip(W_CONTOUR);
const LOWER_CLIP = lowerClip(W_CONTOUR);

/**
 * Mouth interior — layered so fangs/tongue appear BEFORE dark cavity.
 * Dark cavity fades in very gradually (delayed opacity).
 */
function MouthInterior({ jawDrop }: { jawDrop: number }) {
  if (jawDrop < 0.5) return null;

  const bloom = Math.min(jawDrop / MAX_JAW_PX, 1);
  const contourY = SZ * 0.72;
  const cavityCY = contourY + jawDrop * 0.35;

  // Cavity: very delayed — only visible after significant opening
  // Starts at 0 opacity, reaches full only at ~70% open
  const cavityOpacity = Math.max(0, (bloom - 0.15) * 0.9);

  // Fangs: appear early (almost immediately)
  const fangOpacity = Math.min(bloom * 3, 0.92);
  const fangLength = Math.min(jawDrop * 0.5, 15);

  // Tongue: appears early but subtle, grows with opening
  const tongueOpacity = Math.min(bloom * 2, 0.75);

  return (
    <svg
      style={{
        position: "absolute",
        left: 0, top: 0,
        width: SZ, height: SZ + MAX_JAW_PX,
        pointerEvents: "none",
      }}
      viewBox={`0 0 ${SZ} ${SZ + MAX_JAW_PX}`}
    >
      <defs>
        <radialGradient id="cavG" cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor="hsl(350, 18%, 15%)" />
          <stop offset="100%" stopColor="hsl(340, 25%, 8%)" />
        </radialGradient>
        <filter id="mSoft">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
        <filter id="fangSoft">
          <feGaussianBlur stdDeviation="0.4" />
        </filter>
      </defs>

      {/* Layer 1 (back): Dark cavity — fades in LAST, very gradually */}
      <ellipse
        cx={SZ * 0.5}
        cy={cavityCY}
        rx={SZ * 0.08 * bloom + jawDrop * 0.2}
        ry={jawDrop * 0.38}
        fill="url(#cavG)"
        opacity={cavityOpacity}
        filter="url(#mSoft)"
      />

      {/* Layer 2 (mid): Tongue — appears early as a hint of pink */}
      {jawDrop > 1.5 && (
        <ellipse
          cx={SZ * 0.5}
          cy={contourY + jawDrop * 0.25}
          rx={SZ * 0.05 + jawDrop * 0.1}
          ry={Math.max(jawDrop * 0.15, 1.5)}
          fill="hsl(350, 50%, 58%)"
          opacity={tongueOpacity}
          filter="url(#mSoft)"
        />
      )}

      {/* Layer 3 (front): Fangs — appear FIRST, closest to viewer */}
      {jawDrop > 0.8 && (
        <>
          <path
            d={`M ${SZ * 0.43} ${contourY - 0.5}
                L ${SZ * 0.445} ${contourY + fangLength}
                L ${SZ * 0.46} ${contourY - 0.5} Z`}
            fill="hsl(40, 15%, 96%)"
            opacity={fangOpacity}
            filter="url(#fangSoft)"
          />
          <path
            d={`M ${SZ * 0.54} ${contourY - 0.5}
                L ${SZ * 0.555} ${contourY + fangLength}
                L ${SZ * 0.57} ${contourY - 0.5} Z`}
            fill="hsl(40, 15%, 96%)"
            opacity={fangOpacity}
            filter="url(#fangSoft)"
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
  smoothJawRef.current = lerp(smoothJawRef.current, jawRaw, 0.18);
  const jawNorm = smoothJawRef.current;
  const jawDrop = easeOut(Math.min(jawNorm, 1)) * MAX_JAW_PX;

  const isOpen = jawNorm > OPEN_THRESHOLD;

  // Feather amount: strongest during early transition, fades as mouth opens fully
  const featherPx = isOpen ? Math.max(0, 2 - jawDrop * 0.08) : 0;

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

  // Closed: single clean image
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

  // Feathered edge filter style for soft petal parting
  const featherFilter = featherPx > 0.1
    ? `drop-shadow(0 0 ${featherPx}px rgba(0,0,0,0.08))`
    : "none";

  return (
    <div style={containerStyle}>
      {/* Mouth interior — fangs on top, cavity in back */}
      <MouthInterior jawDrop={jawDrop} />

      {/* Lower jaw */}
      <div
        style={{
          position: "absolute",
          left: 0, top: 0,
          width: SZ, height: SZ,
          clipPath: LOWER_CLIP,
          zIndex: 1,
          transform: `translateY(${jawDrop}px)`,
          filter: featherFilter,
          willChange: "transform",
        }}
      >
        <img src={avatarSrc} alt="" draggable={false}
          style={{ width: SZ, height: SZ, display: "block" }} />
      </div>

      {/* Upper face — fixed */}
      <div
        style={{
          position: "absolute",
          left: 0, top: 0,
          width: SZ, height: SZ,
          clipPath: UPPER_CLIP,
          zIndex: 2,
          filter: featherFilter,
        }}
      >
        <img src={avatarSrc} alt="" draggable={false}
          style={{ width: SZ, height: SZ, display: "block" }} />
      </div>
    </div>
  );
}

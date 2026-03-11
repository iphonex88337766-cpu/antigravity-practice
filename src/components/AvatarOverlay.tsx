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

const MAX_JAW_PX = 50;

/**
 * Integrated feline mouth contour.
 * 
 * KEY DESIGN: The edges (x=0%, x=100%) sit at y=100% (image bottom),
 * so the face is NEVER split at the sides. The contour only rises into
 * the W-lip shape in the central muzzle zone (~28–72% x). This makes
 * the mouth opening appear as a natural part of the face, not a
 * horizontal cut across the full image.
 *
 * Format: [x%, y%]
 */
const W_POINTS: [number, number][] = [
  // ── far edges: no split (at image bottom) ──
  [0,   100],
  [8,   100],
  // ── sweep up broadly from jaw toward left mouth corner ──
  [12,  95],
  [15,  88],
  [18,  80],
  [20,  75],
  [22,  72],
  [24,  70],      // left mouth corner — wide out on cheek
  // ── left whisker-pad lobe ──
  [26,  69],
  [28,  68.2],
  [30,  67.6],
  [33,  67.0],
  [36,  66.6],
  [39,  66.3],
  [41,  66.2],    // left lobe apex
  [43,  66.4],
  [45,  66.8],
  // ── philtrum rise ──
  [47,  67.0],
  [49,  66.8],
  [50,  66.6],    // center philtrum
  [51,  66.8],
  [53,  67.0],
  // ── right whisker-pad lobe ──
  [55,  66.8],
  [57,  66.4],
  [59,  66.2],    // right lobe apex
  [61,  66.3],
  [64,  66.6],
  [67,  67.0],
  [70,  67.6],
  [72,  68.2],
  [74,  69],
  [76,  70],      // right mouth corner — wide out on cheek
  // ── sweep back down to jaw ──
  [78,  72],
  [80,  75],
  [82,  80],
  [85,  88],
  [88,  95],
  // ── far edges: no split ──
  [92,  100],
  [100, 100],
];

/** Build CSS clip-path polygon for the UPPER face (everything above the W) */
function upperClipPath(): string {
  // Full top rectangle, then trace the W bottom edge (reversed)
  const reversed = [...W_POINTS].reverse().map(([x, y]) => `${x}% ${y}%`).join(", ");
  return `polygon(0% 0%, 100% 0%, 100% 100%, ${reversed}, 0% 100%)`;
}

/** Build CSS clip-path polygon for the LOWER jaw (everything below the W) */
function lowerClipPath(): string {
  const wPath = W_POINTS.map(([x, y]) => `${x}% ${y}%`).join(", ");
  return `polygon(${wPath}, 100% 100%, 0% 100%)`;
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
  // The W-lip center Y for cavity placement (~67.5% of size)
  const mouthCenterY = size * 0.675;
  // Mouth width spans roughly 30–70% of size
  const mouthWidth = size * 0.42;
  const mouthLeft = size * 0.29;
  const halfMouth = mouthWidth / 2;

  return (
    <div style={containerStyle}>
      {/* ── LAYER 1: Mouth Cavity (behind both face halves) ── */}
      <svg
        style={{
          position: "absolute",
          left: mouthLeft,
          top: mouthCenterY - 6,
          width: mouthWidth,
          height: jawDrop + 30,
          pointerEvents: "none",
          zIndex: 0,
          opacity: jawRaw < 0.04 ? 0 : Math.min((jawRaw - 0.04) / 0.08, 1),
          transition: "opacity 0.06s ease",
        }}
        viewBox={`0 0 ${mouthWidth} ${jawDrop + 30}`}
      >
        {/* Dark inner cavity — shaped to fill the W opening */}
        <ellipse
          cx={halfMouth}
          cy={jawDrop * 0.38 + 8}
          rx={halfMouth * 0.75 + jawDrop * 0.2}
          ry={Math.max(jawDrop * 0.46, 0.5)}
          fill="hsl(340, 45%, 12%)"
        />
        {/* Deeper center darkness */}
        <ellipse
          cx={halfMouth}
          cy={jawDrop * 0.38 + 8}
          rx={halfMouth * 0.45 + jawDrop * 0.1}
          ry={Math.max(jawDrop * 0.3, 0.3)}
          fill="hsl(340, 50%, 7%)"
        />

        {/* Upper lip inner edge — soft pink/red line across top */}
        <ellipse
          cx={halfMouth}
          cy={3}
          rx={halfMouth * 0.7}
          ry={Math.max(jawDrop * 0.06, 0.5)}
          fill="hsl(350, 50%, 45%)"
          opacity={Math.min(jawDrop / 8, 0.6)}
        />

        {/* Soft pink tongue */}
        <ellipse
          cx={halfMouth}
          cy={jawDrop * 0.58 + 12}
          rx={halfMouth * 0.35 + jawDrop * 0.08}
          ry={Math.max(jawDrop * 0.2, 0.3)}
          fill="hsl(350, 60%, 58%)"
        />
        {/* Tongue highlight */}
        <ellipse
          cx={halfMouth - 1}
          cy={jawDrop * 0.54 + 11}
          rx={halfMouth * 0.15 + jawDrop * 0.03}
          ry={Math.max(jawDrop * 0.08, 0.2)}
          fill="hsl(350, 65%, 68%)"
          opacity="0.5"
        />

        {/* ── UPPER FANGS (hang from upper lip) ── */}
        {/* Left canine */}
        <polygon
          points={`
            ${halfMouth - halfMouth * 0.42},0
            ${halfMouth - halfMouth * 0.42 + 5},0
            ${halfMouth - halfMouth * 0.42 + 3.5},${Math.min(6 + jawDrop * 0.55, 24)}
            ${halfMouth - halfMouth * 0.42 + 1},${Math.min(8 + jawDrop * 0.6, 27)}
            ${halfMouth - halfMouth * 0.42 - 0.5},${Math.min(4 + jawDrop * 0.35, 16)}
          `}
          fill="hsl(45, 20%, 96%)"
          stroke="hsl(40, 15%, 88%)"
          strokeWidth="0.5"
          opacity={Math.min(jawDrop / 4, 1)}
        />
        {/* Right canine */}
        <polygon
          points={`
            ${halfMouth + halfMouth * 0.42 - 5},0
            ${halfMouth + halfMouth * 0.42},0
            ${halfMouth + halfMouth * 0.42 + 0.5},${Math.min(4 + jawDrop * 0.35, 16)}
            ${halfMouth + halfMouth * 0.42 - 1},${Math.min(8 + jawDrop * 0.6, 27)}
            ${halfMouth + halfMouth * 0.42 - 3.5},${Math.min(6 + jawDrop * 0.55, 24)}
          `}
          fill="hsl(45, 20%, 96%)"
          stroke="hsl(40, 15%, 88%)"
          strokeWidth="0.5"
          opacity={Math.min(jawDrop / 4, 1)}
        />
        {/* Upper incisors */}
        {[-7, -2.5, 2.5, 7].map((xOff, i) => (
          <rect
            key={`ui-${i}`}
            x={halfMouth + xOff - 2}
            y={0}
            width="4"
            height={Math.min(3 + jawDrop * 0.16, 8)}
            rx="1.5"
            ry="1.5"
            fill="hsl(45, 18%, 95%)"
            stroke="hsl(40, 12%, 90%)"
            strokeWidth="0.3"
            opacity={Math.min(jawDrop / 5, 1)}
          />
        ))}

        {/* ── LOWER TEETH (rise from lower jaw) ── */}
        {/* Lower canine stubs */}
        <polygon
          points={`
            ${halfMouth - halfMouth * 0.38},${jawDrop * 0.78 + 6}
            ${halfMouth - halfMouth * 0.38 + 4},${jawDrop * 0.78 + 6}
            ${halfMouth - halfMouth * 0.38 + 3},${jawDrop * 0.78 + 6 - Math.min(jawDrop * 0.25, 10)}
            ${halfMouth - halfMouth * 0.38 + 1},${jawDrop * 0.78 + 6 - Math.min(jawDrop * 0.3, 12)}
          `}
          fill="hsl(45, 18%, 94%)"
          stroke="hsl(40, 12%, 88%)"
          strokeWidth="0.3"
          opacity={Math.min(jawDrop / 6, 1)}
        />
        <polygon
          points={`
            ${halfMouth + halfMouth * 0.38 - 4},${jawDrop * 0.78 + 6}
            ${halfMouth + halfMouth * 0.38},${jawDrop * 0.78 + 6}
            ${halfMouth + halfMouth * 0.38 - 1},${jawDrop * 0.78 + 6 - Math.min(jawDrop * 0.3, 12)}
            ${halfMouth + halfMouth * 0.38 - 3},${jawDrop * 0.78 + 6 - Math.min(jawDrop * 0.25, 10)}
          `}
          fill="hsl(45, 18%, 94%)"
          stroke="hsl(40, 12%, 88%)"
          strokeWidth="0.3"
          opacity={Math.min(jawDrop / 6, 1)}
        />
        {/* Lower incisors */}
        {[-4, 0, 4].map((xOff, i) => (
          <rect
            key={`li-${i}`}
            x={halfMouth + xOff - 1.5}
            y={jawDrop * 0.78 + 6 - Math.min(2 + jawDrop * 0.1, 5)}
            width="3"
            height={Math.min(2 + jawDrop * 0.1, 5)}
            rx="1.2"
            ry="1.2"
            fill="hsl(45, 15%, 93%)"
            stroke="hsl(40, 10%, 88%)"
            strokeWidth="0.3"
            opacity={Math.min(jawDrop / 6, 1)}
          />
        ))}

        {/* Lower lip inner edge */}
        <ellipse
          cx={halfMouth}
          cy={jawDrop * 0.78 + 8}
          rx={halfMouth * 0.65}
          ry={Math.max(jawDrop * 0.05, 0.5)}
          fill="hsl(350, 45%, 42%)"
          opacity={Math.min(jawDrop / 8, 0.5)}
        />
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

      {/* ── Elastic cheek connectors at mouth corners ── */}
      {jawDrop > 2 && (
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
          {/* Left mouth corner — connects upper lip to lower jaw at ~30%, 71% */}
          <path
            d={`M ${size * 0.30} ${size * 0.71}
                Q ${size * 0.27} ${size * 0.71 + jawDrop * 0.5}
                  ${size * 0.30} ${size * 0.71 + jawDrop}`}
            stroke="hsl(28, 40%, 58%)"
            strokeWidth="3"
            fill="none"
            opacity={Math.min(jawDrop / 10, 0.35)}
            strokeLinecap="round"
          />
          {/* Right mouth corner */}
          <path
            d={`M ${size * 0.70} ${size * 0.71}
                Q ${size * 0.73} ${size * 0.71 + jawDrop * 0.5}
                  ${size * 0.70} ${size * 0.71 + jawDrop}`}
            stroke="hsl(28, 40%, 58%)"
            strokeWidth="3"
            fill="none"
            opacity={Math.min(jawDrop / 10, 0.35)}
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
}

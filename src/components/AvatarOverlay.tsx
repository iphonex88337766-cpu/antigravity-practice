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
 * Wide, soft feline upper-lip W-contour.
 * Spans the full whisker-pad area with a pronounced, rounded W shape.
 * The two whisker-pad lobes dip deeply (~73%), with a slight rise at center
 * philtrum (~71.5%), and the mouth corners curve back up to the cheeks (~66%).
 * This creates the characteristic wide cat/tiger lip shape.
 * Format: [x%, y%]
 */
const W_POINTS: [number, number][] = [
  // ── far left cheek ──
  [0,   64],
  [6,   64],
  [12,  64],
  // ── left cheek curving into mouth corner ──
  [16,  64.2],
  [20,  64.8],
  [23,  65.5],
  [25,  66.2],
  [27,  67.0],   // left mouth corner
  // ── left whisker-pad lobe (deep rounded curve) ──
  [29,  68.0],
  [31,  69.2],
  [33,  70.2],
  [35,  71.0],
  [37,  71.8],
  [38.5,72.3],
  [40,  72.8],   // left lobe deepest
  [41.5,72.6],
  [43,  72.0],
  // ── rising toward philtrum center ──
  [44.5,71.2],
  [46,  70.5],
  [47.5,70.2],
  [49,  70.0],
  [50,  69.8],   // philtrum – slight rise between the two lobes
  [51,  70.0],
  [52.5,70.2],
  [53.5,70.5],
  [55.5,71.2],
  // ── right whisker-pad lobe ──
  [57,  72.0],
  [58.5,72.6],
  [60,  72.8],   // right lobe deepest
  [61.5,72.3],
  [63,  71.8],
  [65,  71.0],
  [67,  70.2],
  [69,  69.2],
  [71,  68.0],
  // ── right mouth corner curving back to cheek ──
  [73,  67.0],   // right mouth corner
  [75,  66.2],
  [77,  65.5],
  [80,  64.8],
  [84,  64.2],
  // ── far right cheek ──
  [88,  64],
  [94,  64],
  [100, 64],
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
  // W-contour center Y — average of the deepest lobe points (~72.8%) and corners (~67%)
  const wCenterY = size * 0.695;

  return (
    <div style={containerStyle}>
      {/* ── LAYER 1: Mouth Cavity with Fierce Dentition ── */}
      <svg
        style={{
          position: "absolute",
          left: size * 0.2,
          top: wCenterY - 8,
          width: size * 0.6,
          height: jawDrop + 40,
          pointerEvents: "none",
          zIndex: 0,
          opacity: jawRaw < 0.05 ? 0 : Math.min((jawRaw - 0.05) / 0.1, 1),
          transition: "opacity 0.08s ease",
        }}
        viewBox={`0 0 ${size * 0.6} ${jawDrop + 40}`}
      >
        {/* Deep burgundy cavity — wide to fill the W opening */}
        <ellipse
          cx={size * 0.3}
          cy={jawDrop * 0.4 + 10}
          rx={size * 0.14 + jawDrop * 0.35}
          ry={Math.max(jawDrop * 0.48, 0.5)}
          fill="hsl(340, 45%, 15%)"
        />
        {/* Inner cavity gradient - darker center */}
        <ellipse
          cx={size * 0.3}
          cy={jawDrop * 0.4 + 10}
          rx={size * 0.08 + jawDrop * 0.18}
          ry={Math.max(jawDrop * 0.32, 0.3)}
          fill="hsl(340, 50%, 10%)"
        />
        {/* Soft pink tongue */}
        <ellipse
          cx={size * 0.3}
          cy={jawDrop * 0.55 + 14}
          rx={size * 0.06 + jawDrop * 0.12}
          ry={Math.max(jawDrop * 0.2, 0.3)}
          fill="hsl(350, 60%, 58%)"
        />
        {/* Tongue highlight */}
        <ellipse
          cx={size * 0.3 - 1}
          cy={jawDrop * 0.5 + 13}
          rx={size * 0.03 + jawDrop * 0.05}
          ry={Math.max(jawDrop * 0.08, 0.2)}
          fill="hsl(350, 65%, 68%)"
          opacity="0.6"
        />

        {/* ── UPPER TEETH (hang from upper jaw) ── */}
        {/* Left canine fang */}
        <polygon
          points={`
            ${size * 0.3 - size * 0.07},1
            ${size * 0.3 - size * 0.07 + 5},1
            ${size * 0.3 - size * 0.07 + 4},${Math.min(5 + jawDrop * 0.5, 22)}
            ${size * 0.3 - size * 0.07 + 1},${Math.min(7 + jawDrop * 0.55, 25)}
            ${size * 0.3 - size * 0.07 - 1},${Math.min(3 + jawDrop * 0.3, 15)}
          `}
          fill="hsl(45, 20%, 96%)"
          stroke="hsl(40, 15%, 88%)"
          strokeWidth="0.5"
          opacity={Math.min(jawDrop / 5, 1)}
        />
        {/* Right canine fang */}
        <polygon
          points={`
            ${size * 0.3 + size * 0.07 - 5},1
            ${size * 0.3 + size * 0.07},1
            ${size * 0.3 + size * 0.07 + 1},${Math.min(3 + jawDrop * 0.3, 15)}
            ${size * 0.3 + size * 0.07 - 1},${Math.min(7 + jawDrop * 0.55, 25)}
            ${size * 0.3 + size * 0.07 - 4},${Math.min(5 + jawDrop * 0.5, 22)}
          `}
          fill="hsl(45, 20%, 96%)"
          stroke="hsl(40, 15%, 88%)"
          strokeWidth="0.5"
          opacity={Math.min(jawDrop / 5, 1)}
        />
        {/* Upper incisors */}
        {[-7, -2.5, 2.5, 7].map((xOff, i) => (
          <rect
            key={`ui-${i}`}
            x={size * 0.3 + xOff - 2}
            y={1}
            width="4"
            height={Math.min(3 + jawDrop * 0.16, 8)}
            rx="1.5"
            ry="1.5"
            fill="hsl(45, 18%, 95%)"
            stroke="hsl(40, 12%, 90%)"
            strokeWidth="0.3"
            opacity={Math.min(jawDrop / 6, 1)}
          />
        ))}

        {/* ── LOWER TEETH (rise from lower jaw) ── */}
        <polygon
          points={`
            ${size * 0.3 - size * 0.06},${jawDrop * 0.75 + 8}
            ${size * 0.3 - size * 0.06 + 4},${jawDrop * 0.75 + 8}
            ${size * 0.3 - size * 0.06 + 3},${jawDrop * 0.75 + 8 - Math.min(jawDrop * 0.28, 11)}
            ${size * 0.3 - size * 0.06 + 1},${jawDrop * 0.75 + 8 - Math.min(jawDrop * 0.32, 13)}
          `}
          fill="hsl(45, 18%, 94%)"
          stroke="hsl(40, 12%, 88%)"
          strokeWidth="0.3"
          opacity={Math.min(jawDrop / 6, 1)}
        />
        <polygon
          points={`
            ${size * 0.3 + size * 0.06 - 4},${jawDrop * 0.75 + 8}
            ${size * 0.3 + size * 0.06},${jawDrop * 0.75 + 8}
            ${size * 0.3 + size * 0.06 - 1},${jawDrop * 0.75 + 8 - Math.min(jawDrop * 0.32, 13)}
            ${size * 0.3 + size * 0.06 - 3},${jawDrop * 0.75 + 8 - Math.min(jawDrop * 0.28, 11)}
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
            x={size * 0.3 + xOff - 1.5}
            y={jawDrop * 0.75 + 8 - Math.min(2 + jawDrop * 0.1, 5)}
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
          {/* Left mouth corner connector */}
          <path
            d={`M ${size * 0.33} ${size * 0.648}
                Q ${size * 0.30} ${size * 0.648 + jawDrop * 0.5}
                  ${size * 0.33} ${size * 0.648 + jawDrop}`}
            stroke="hsl(28, 45%, 60%)"
            strokeWidth="2"
            fill="none"
            opacity={Math.min(jawDrop / 12, 0.4)}
            strokeLinecap="round"
          />
          {/* Right mouth corner connector */}
          <path
            d={`M ${size * 0.67} ${size * 0.648}
                Q ${size * 0.70} ${size * 0.648 + jawDrop * 0.5}
                  ${size * 0.67} ${size * 0.648 + jawDrop}`}
            stroke="hsl(28, 45%, 60%)"
            strokeWidth="2"
            fill="none"
            opacity={Math.min(jawDrop / 12, 0.4)}
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
}

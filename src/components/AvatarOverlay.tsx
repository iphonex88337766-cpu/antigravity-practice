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
 * Feline W-contour with PRONOUNCED curvature.
 *
 * The mouth corners sit HIGH (~69% y) while the whisker-pad lobes
 * dip LOW (~76% y), creating a ~7% vertical arc that reads as a
 * clear curved feline mouth, not a flat bar.
 *
 * Edges at y=100% so the face sides are never split.
 * Format: [x%, y%]
 */
const W_POINTS: [number, number][] = [
  [0,   100],
  [8,   100],
  // gentle rise from chin into left mouth corner
  [12,  97],
  [15,  92],
  [17,  86],
  [19,  80],
  [21,  76],
  [23,  73],
  [25,  71],
  [27,  69.5],   // left mouth corner (high)
  // descending into left whisker-pad lobe
  [29,  70.5],
  [31,  71.8],
  [33,  73],
  [35,  74],
  [37,  74.8],
  [39,  75.3],
  [41,  75.6],   // left lobe deepest
  [43,  75.3],
  [45,  74.6],
  // rising toward philtrum
  [47,  74],
  [49,  73.8],
  [50,  73.6],   // philtrum center (slight rise between lobes)
  [51,  73.8],
  [53,  74],
  // descending into right whisker-pad lobe
  [55,  74.6],
  [57,  75.3],
  [59,  75.6],   // right lobe deepest
  [61,  75.3],
  [63,  74.8],
  [65,  74],
  [67,  73],
  [69,  71.8],
  [71,  70.5],
  [73,  69.5],   // right mouth corner (high)
  // descending back to chin
  [75,  71],
  [77,  73],
  [79,  76],
  [81,  80],
  [83,  86],
  [85,  92],
  [88,  97],
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

  // Mouth corner and lobe positions in pixels
  const lcx = size * 0.27;   // left corner x
  const rcx = size * 0.73;   // right corner x
  const cornerY = size * 0.695;  // corner y (high)
  const lobeY = size * 0.756;   // lobe deepest y (low)
  const mouthCx = size * 0.5;

  return (
    <div style={containerStyle}>
      {/* ── Dark mouth cavity — SVG shape following the W-contour ── */}
      {jawDrop > 0.5 && (
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
          {/* The cavity shape: top edge follows the W-contour arc,
              bottom edge is the same arc shifted down by jawDrop */}
          <path
            d={`
              M ${lcx} ${cornerY}
              Q ${lcx + (mouthCx - lcx) * 0.5} ${lobeY},
                ${mouthCx} ${lobeY - 2}
              Q ${mouthCx + (rcx - mouthCx) * 0.5} ${lobeY},
                ${rcx} ${cornerY}
              L ${rcx} ${cornerY + jawDrop}
              Q ${mouthCx + (rcx - mouthCx) * 0.5} ${lobeY + jawDrop + 4},
                ${mouthCx} ${lobeY + jawDrop + 6}
              Q ${lcx + (mouthCx - lcx) * 0.5} ${lobeY + jawDrop + 4},
                ${lcx} ${cornerY + jawDrop}
              Z
            `}
            fill="hsl(340, 50%, 8%)"
            opacity={jawRaw < 0.02 ? 0 : Math.min((jawRaw - 0.02) / 0.06, 1)}
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

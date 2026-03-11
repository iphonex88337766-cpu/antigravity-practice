/**
 * AvatarOverlay — Frame-based mouth + elastic jaw stretch.
 *
 * Upper face is static. Lower jaw (below mouth line) translates
 * downward based on jawOpen, with the mouth interior filling the gap.
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
const MAX_DROP = 150; // max chin drop in px
const SPLIT_Y = 72; // % from top where mouth line sits
const DEAD_ZONE = 0.05;

/**
 * MouthInterior — fills the gap between upper and lower jaw.
 */
function MouthInterior({ dropPx }: { dropPx: number }) {
  if (dropPx < 1) return null;

  const t = Math.min(dropPx / MAX_DROP, 1);
  const cx = SZ * 0.5;
  const mouthTop = SZ * (SPLIT_Y / 100);
  const mouthBot = mouthTop + dropPx;
  const midY = (mouthTop + mouthBot) / 2;
  const mouthW = SZ * 0.16;
  const mouthH = dropPx * 0.45;

  const fangOpacity = Math.min(t * 4, 1);
  const tongueOpacity = Math.min(t * 2.5, 0.9);
  const cavityOpacity = Math.min(t * 1.2, 0.8);
  const fangLen = lerp(2, 14, t);

  return (
    <svg
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: SZ,
        height: SZ + MAX_DROP,
        pointerEvents: "none",
        zIndex: 1,
      }}
      viewBox={`0 0 ${SZ} ${SZ + MAX_DROP}`}
    >
      <defs>
        <radialGradient id="cavG" cx="50%" cy="35%" r="55%">
          <stop offset="0%" stopColor="hsl(350, 18%, 18%)" />
          <stop offset="100%" stopColor="hsl(340, 25%, 6%)" />
        </radialGradient>
        <filter id="sBlur">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>

      {/* Cavity */}
      <ellipse
        cx={cx} cy={midY}
        rx={mouthW} ry={mouthH}
        fill="url(#cavG)" opacity={cavityOpacity} filter="url(#sBlur)"
      />

      {/* Tongue */}
      <ellipse
        cx={cx} cy={midY + mouthH * 0.15}
        rx={mouthW * 0.5} ry={Math.max(mouthH * 0.35, 2)}
        fill="hsl(350, 50%, 55%)" opacity={tongueOpacity}
      />

      {/* Fangs */}
      <path
        d={`M ${cx - mouthW * 0.4} ${mouthTop - 1}
            L ${cx - mouthW * 0.25} ${mouthTop + fangLen}
            L ${cx - mouthW * 0.1} ${mouthTop - 1} Z`}
        fill="hsl(40, 20%, 95%)" opacity={fangOpacity}
      />
      <path
        d={`M ${cx + mouthW * 0.1} ${mouthTop - 1}
            L ${cx + mouthW * 0.25} ${mouthTop + fangLen}
            L ${cx + mouthW * 0.4} ${mouthTop - 1} Z`}
        fill="hsl(40, 20%, 95%)" opacity={fangOpacity}
      />
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

  const isOpen = jawNorm > DEAD_ZONE;
  const dropPx = isOpen
    ? Math.min(jawNorm * 1.8, 1) * MAX_DROP // aggressive 1.8x multiplier
    : 0;

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
      height: SZ + MAX_DROP,
      transform: rotate,
      transformStyle: "preserve-3d" as const,
      pointerEvents: "none" as const,
      willChange: "transform",
    };
  }, [transformationMatrix, width, height]);

  // Upper clip: everything above the split line
  const upperClip = `polygon(0% 0%, 100% 0%, 100% ${SPLIT_Y}%, 0% ${SPLIT_Y}%)`;

  // Lower clip: everything below the split line
  const lowerClip = `polygon(0% ${SPLIT_Y}%, 100% ${SPLIT_Y}%, 100% 100%, 0% 100%)`;

  return (
    <div style={containerStyle}>
      {/* Base image — always visible when closed */}
      <img
        src={avatarSrc}
        alt="Avatar"
        draggable={false}
        style={{
          position: "absolute",
          left: 0, top: 0,
          width: SZ, height: SZ,
          display: isOpen ? "none" : "block",
          zIndex: 0,
        }}
      />

      {isOpen && (
        <>
          {/* Upper face — static, clipped above mouth line */}
          <div style={{
            position: "absolute",
            left: 0, top: 0,
            width: SZ, height: SZ,
            clipPath: upperClip,
            zIndex: 2,
          }}>
            <img src={avatarSrc} alt="" draggable={false}
              style={{ width: SZ, height: SZ, display: "block" }} />
          </div>

          {/* Mouth interior — fills the gap */}
          <MouthInterior dropPx={dropPx} />

          {/* Lower jaw — clipped below mouth line, translated down */}
          <div style={{
            position: "absolute",
            left: 0, top: 0,
            width: SZ, height: SZ,
            clipPath: lowerClip,
            transform: `translateY(${dropPx}px)`,
            zIndex: 2,
            willChange: "transform",
          }}>
            <img src={avatarSrc} alt="" draggable={false}
              style={{ width: SZ, height: SZ, display: "block" }} />
          </div>
        </>
      )}
    </div>
  );
}

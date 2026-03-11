/**
 * AvatarOverlay — Frame-based mouth animation.
 *
 * Uses a single base image with an SVG mouth overlay that
 * crossfades between closed/half/wide states based on jawOpen.
 * No clip-path deformation, no elastic stretching.
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

/**
 * MouthOverlay — SVG-drawn mouth interior that fades in/out.
 * Rendered on top of the base image at the mouth region.
 */
function MouthOverlay({ jawNorm }: { jawNorm: number }) {
  if (jawNorm < 0.05) return null;

  // Normalize to 0-1 range for animation
  const t = Math.min(jawNorm / 0.8, 1); // reaches full at 80% open

  // Mouth geometry — centered on the tiger's muzzle
  const cx = SZ * 0.5;
  const cy = SZ * 0.72;
  const mouthWidth = SZ * 0.18;
  const mouthHeight = lerp(2, SZ * 0.14, t);

  // Opacities — fangs first, then tongue, then cavity deepens
  const fangOpacity = Math.min(t * 3, 1);
  const tongueOpacity = Math.min(t * 2, 0.9);
  const cavityOpacity = Math.min(t * 1.2, 0.85);

  const fangLen = lerp(1, 12, t);

  return (
    <svg
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: SZ,
        height: SZ,
        pointerEvents: "none",
      }}
      viewBox={`0 0 ${SZ} ${SZ}`}
    >
      <defs>
        <radialGradient id="cavGrad" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="hsl(350, 18%, 18%)" />
          <stop offset="100%" stopColor="hsl(340, 25%, 6%)" />
        </radialGradient>
        <filter id="softBlur">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>

      {/* Dark cavity — deepens gradually */}
      <ellipse
        cx={cx}
        cy={cy + mouthHeight * 0.15}
        rx={mouthWidth}
        ry={mouthHeight * 0.55}
        fill="url(#cavGrad)"
        opacity={cavityOpacity}
        filter="url(#softBlur)"
      />

      {/* Tongue */}
      <ellipse
        cx={cx}
        cy={cy + mouthHeight * 0.25}
        rx={mouthWidth * 0.55}
        ry={Math.max(mouthHeight * 0.3, 1.5)}
        fill="hsl(350, 50%, 55%)"
        opacity={tongueOpacity}
      />

      {/* Left fang */}
      <path
        d={`M ${cx - mouthWidth * 0.35} ${cy - 1}
            L ${cx - mouthWidth * 0.25} ${cy + fangLen}
            L ${cx - mouthWidth * 0.15} ${cy - 1} Z`}
        fill="hsl(40, 20%, 95%)"
        opacity={fangOpacity}
      />

      {/* Right fang */}
      <path
        d={`M ${cx + mouthWidth * 0.15} ${cy - 1}
            L ${cx + mouthWidth * 0.25} ${cy + fangLen}
            L ${cx + mouthWidth * 0.35} ${cy - 1} Z`}
        fill="hsl(40, 20%, 95%)"
        opacity={fangOpacity}
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
      height: SZ,
      transform: rotate,
      transformStyle: "preserve-3d" as const,
      pointerEvents: "none" as const,
      willChange: "transform",
    };
  }, [transformationMatrix, width, height]);

  return (
    <div style={containerStyle}>
      {/* Base tiger image — always visible */}
      <img
        src={avatarSrc}
        alt="Avatar"
        draggable={false}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: SZ,
          height: SZ,
          display: "block",
        }}
      />

      {/* Mouth overlay — fades in based on jaw open */}
      <MouthOverlay jawNorm={jawNorm} />
    </div>
  );
}

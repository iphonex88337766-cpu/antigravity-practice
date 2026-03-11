/**
 * AvatarOverlay
 * 
 * Renders a character image centered in its container,
 * rotated using the facial transformation matrix,
 * with expression overlays (eyes, mouth) driven by blendshapes.
 */

import { useMemo, useRef, useEffect } from "react";
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

/** Extract yaw, pitch, roll from a 4×4 row-major matrix */
function matrixToEuler(data: number[]): { pitch: number; yaw: number; roll: number } {
  const r00 = data[0], r01 = data[1], r02 = data[2];
  const r10 = data[4], r11 = data[5], r12 = data[6];
  const r20 = data[8], r21 = data[9], r22 = data[10];

  const pitch = Math.atan2(-r12, r22) * (180 / Math.PI);
  const yaw = Math.asin(r02) * (180 / Math.PI);
  const roll = Math.atan2(-r01, r00) * (180 / Math.PI);

  return { pitch, yaw, roll };
}

/** Linear interpolation */
function lerp(current: number, target: number, factor: number): number {
  return current + (target - current) * factor;
}

/** Smoothed blendshape values stored between renders */
interface SmoothedExpressions {
  eyeBlinkLeft: number;
  eyeBlinkRight: number;
  jawOpen: number;
  mouthSmileLeft: number;
  mouthSmileRight: number;
}

export default function AvatarOverlay({
  landmarks,
  transformationMatrix,
  blendshapes,
  width,
  height,
  avatarSrc = babyTigerSrc,
}: AvatarOverlayProps) {
  const smoothedRef = useRef<SmoothedExpressions>({
    eyeBlinkLeft: 0,
    eyeBlinkRight: 0,
    jawOpen: 0,
    mouthSmileLeft: 0,
    mouthSmileRight: 0,
  });

  // Smooth the blendshape values with lerp
  const expressions = useMemo(() => {
    const s = smoothedRef.current;
    const LERP_FACTOR = 0.3; // Smooth but responsive

    if (!blendshapes) return s;

    s.eyeBlinkLeft = lerp(s.eyeBlinkLeft, blendshapes["eyeBlinkLeft"] ?? 0, LERP_FACTOR);
    s.eyeBlinkRight = lerp(s.eyeBlinkRight, blendshapes["eyeBlinkRight"] ?? 0, LERP_FACTOR);
    s.jawOpen = lerp(s.jawOpen, blendshapes["jawOpen"] ?? 0, LERP_FACTOR);
    s.mouthSmileLeft = lerp(s.mouthSmileLeft, blendshapes["mouthSmileLeft"] ?? 0, LERP_FACTOR);
    s.mouthSmileRight = lerp(s.mouthSmileRight, blendshapes["mouthSmileRight"] ?? 0, LERP_FACTOR);

    return { ...s };
  }, [blendshapes]);

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
      height: size,
      transform: rotate,
      transformStyle: "preserve-3d" as const,
      pointerEvents: "none" as const,
      willChange: "transform",
    };
  }, [transformationMatrix, width, height]);

  // Expression overlay values
  const eyeOpenLeft = 1 - Math.min(expressions.eyeBlinkLeft * 1.5, 1);
  const eyeOpenRight = 1 - Math.min(expressions.eyeBlinkRight * 1.5, 1);
  const mouthOpen = Math.min(expressions.jawOpen * 1.8, 1);
  const smileAmount = (expressions.mouthSmileLeft + expressions.mouthSmileRight) / 2;

  // Jaw drop: pure downward translation in viewBox units
  const jawDrop = mouthOpen * 15;
  // Split line in viewBox units (just above the static mouth)
  const splitY = 74;

  return (
    <div style={containerStyle}>
      {/* Layer 0: Dynamic eyes rendered BEHIND the solid base */}
      <svg
        viewBox="0 0 100 100"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        {/* Left eye */}
        <ellipse cx="35" cy="50" rx="7" ry={Math.max(eyeOpenLeft * 7, 0.6)} fill="#3a2518" />
        <ellipse cx="35" cy="50" rx="4.5" ry={Math.max(eyeOpenLeft * 4.5, 0.4)} fill="#6b4423" />
        <ellipse cx="35" cy="50" rx="2.5" ry={Math.max(eyeOpenLeft * 2.5, 0.3)} fill="#1a0e08" />
        <ellipse cx="33" cy={48.5 - eyeOpenLeft} rx="1.2" ry={Math.max(eyeOpenLeft * 1.5, 0.15)} fill="white" opacity={eyeOpenLeft > 0.2 ? 0.85 : 0} />

        {/* Right eye */}
        <ellipse cx="65" cy="50" rx="7" ry={Math.max(eyeOpenRight * 7, 0.6)} fill="#3a2518" />
        <ellipse cx="65" cy="50" rx="4.5" ry={Math.max(eyeOpenRight * 4.5, 0.4)} fill="#6b4423" />
        <ellipse cx="65" cy="50" rx="2.5" ry={Math.max(eyeOpenRight * 2.5, 0.3)} fill="#1a0e08" />
        <ellipse cx="63" cy={48.5 - eyeOpenRight} rx="1.2" ry={Math.max(eyeOpenRight * 1.5, 0.15)} fill="white" opacity={eyeOpenRight > 0.2 ? 0.85 : 0} />
      </svg>

      {/* Layer 1: Inner mouth cavity — dark background revealed by jaw stretch */}
      <svg
        viewBox="0 0 100 100"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 1,
          overflow: "visible",
        }}
      >
        <defs>
          <radialGradient id="mouth-cavity" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#4a1a2a" />
            <stop offset="50%" stopColor="#2d0f18" />
            <stop offset="100%" stopColor="#1a0a0e" />
          </radialGradient>
        </defs>
        {/* Dark cavity ellipse positioned at the split line, sized to fill the gap */}
        <ellipse
          cx="50"
          cy={splitY + 1}
          rx={8 + smileAmount * 2}
          ry={mouthOpen * 10}
          fill="url(#mouth-cavity)"
          opacity={mouthOpen > 0.05 ? Math.min(mouthOpen * 2, 1) : 0}
        />
        {/* Tongue hint */}
        {mouthOpen > 0.3 && (
          <ellipse
            cx="50"
            cy={splitY + mouthOpen * 6}
            rx={4 + smileAmount}
            ry={mouthOpen * 3}
            fill="#e85d75"
            opacity={0.5}
          />
        )}
      </svg>

      {/* Layer 2: Upper tiger (above mouth line) — solid, with eye holes only */}
      <svg
        viewBox="0 0 100 100"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 2,
        }}
      >
        <defs>
          <clipPath id="upper-clip">
            <rect x="0" y="0" width="100" height={splitY} />
          </clipPath>
          <mask id="eye-mask">
            <rect x="0" y="0" width="100" height="100" fill="white" />
            <ellipse cx="35" cy="50" rx="8" ry="8" fill="black" />
            <ellipse cx="65" cy="50" rx="8" ry="8" fill="black" />
          </mask>
        </defs>
        <image
          href={avatarSrc}
          x="0" y="0" width="100" height="100"
          clipPath="url(#upper-clip)"
          mask="url(#eye-mask)"
          preserveAspectRatio="xMidYMid slice"
        />
      </svg>

      {/* Layer 3: Lower jaw — translates downward + scaleY from top edge */}
      <svg
        viewBox="0 0 100 100"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 3,
          overflow: "visible",
        }}
      >
        <defs>
          <clipPath id="lower-clip">
            <rect x="0" y={splitY} width="100" height={100 - splitY} />
          </clipPath>
        </defs>
        {/* Pure downward translation — top edge stays anchored at splitY */}
        <g transform={`translate(0, ${jawDrop})`}>
          <image
            href={avatarSrc}
            x="0" y="0" width="100" height="100"
            clipPath="url(#lower-clip)"
            preserveAspectRatio="xMidYMid slice"
          />
        </g>
      </svg>
    </div>
  );
}

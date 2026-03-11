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

  return (
    <div style={containerStyle}>
      {/* Layer 1: Dynamic expressions rendered BEHIND the base */}
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
        {/* Left eye — sits inside the left eye socket cutout */}
        <ellipse
          cx="35"
          cy="50"
          rx="7"
          ry={Math.max(eyeOpenLeft * 7, 0.6)}
          fill="#3a2518"
        />
        {/* Left iris */}
        <ellipse
          cx="35"
          cy="50"
          rx="4.5"
          ry={Math.max(eyeOpenLeft * 4.5, 0.4)}
          fill="#6b4423"
        />
        {/* Left pupil */}
        <ellipse
          cx="35"
          cy="50"
          rx="2.5"
          ry={Math.max(eyeOpenLeft * 2.5, 0.3)}
          fill="#1a0e08"
        />
        {/* Left eye shine */}
        <ellipse
          cx="33"
          cy={48.5 - eyeOpenLeft * 1}
          rx="1.2"
          ry={Math.max(eyeOpenLeft * 1.5, 0.15)}
          fill="white"
          opacity={eyeOpenLeft > 0.2 ? 0.85 : 0}
        />

        {/* Right eye — sits inside the right eye socket cutout */}
        <ellipse
          cx="65"
          cy="50"
          rx="7"
          ry={Math.max(eyeOpenRight * 7, 0.6)}
          fill="#3a2518"
        />
        {/* Right iris */}
        <ellipse
          cx="65"
          cy="50"
          rx="4.5"
          ry={Math.max(eyeOpenRight * 4.5, 0.4)}
          fill="#6b4423"
        />
        {/* Right pupil */}
        <ellipse
          cx="65"
          cy="50"
          rx="2.5"
          ry={Math.max(eyeOpenRight * 2.5, 0.3)}
          fill="#1a0e08"
        />
        {/* Right eye shine */}
        <ellipse
          cx="63"
          cy={48.5 - eyeOpenRight * 1}
          rx="1.2"
          ry={Math.max(eyeOpenRight * 1.5, 0.15)}
          fill="white"
          opacity={eyeOpenRight > 0.2 ? 0.85 : 0}
        />

        {/* Mouth — below the nose in the mouth cutout area */}
        <ellipse
          cx="50"
          cy={72 + mouthOpen * 2}
          rx={3.5 + smileAmount * 2}
          ry={0.6 + mouthOpen * 3.5}
          fill="#2d1a1a"
          opacity="0.85"
        />
        {/* Tongue when mouth open */}
        {mouthOpen > 0.25 && (
          <ellipse
            cx="50"
            cy={73 + mouthOpen * 2}
            rx={2 + smileAmount * 0.8}
            ry={mouthOpen * 1.8}
            fill="#e85d75"
            opacity="0.6"
          />
        )}
      </svg>

      {/* Layer 2: Faceless tiger base rendered ON TOP */}
      <img
        src={avatarSrc}
        alt="Avatar"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 1,
        }}
        draggable={false}
      />
    </div>
  );
}

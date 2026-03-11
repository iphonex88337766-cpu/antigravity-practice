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
      <img
        src={avatarSrc}
        alt="Avatar"
        style={{ width: "100%", height: "100%", pointerEvents: "none" }}
        draggable={false}
      />
      {/* Expression overlay — eyes and mouth rendered as SVG on top */}
      <svg
        viewBox="0 0 100 100"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        {/* Left eye */}
        <ellipse
          cx="35"
          cy="47"
          rx="5.5"
          ry={Math.max(eyeOpenLeft * 5.5, 0.5)}
          fill="#1a1a1a"
          opacity="0.85"
        />
        {/* Left eye shine */}
        <ellipse
          cx="33.5"
          cy={46 - eyeOpenLeft * 1.2}
          rx="1.3"
          ry={Math.max(eyeOpenLeft * 1.3, 0.2)}
          fill="white"
          opacity={eyeOpenLeft > 0.3 ? 0.75 : 0}
        />

        {/* Right eye */}
        <ellipse
          cx="65"
          cy="47"
          rx="5.5"
          ry={Math.max(eyeOpenRight * 5.5, 0.5)}
          fill="#1a1a1a"
          opacity="0.85"
        />
        {/* Right eye shine */}
        <ellipse
          cx="63.5"
          cy={46 - eyeOpenRight * 1.2}
          rx="1.3"
          ry={Math.max(eyeOpenRight * 1.3, 0.2)}
          fill="white"
          opacity={eyeOpenRight > 0.3 ? 0.75 : 0}
        />

        {/* Mouth */}
        <ellipse
          cx="50"
          cy={79 + mouthOpen * 2.5}
          rx={4 + smileAmount * 2.5}
          ry={0.8 + mouthOpen * 4}
          fill="#2d1a1a"
          opacity="0.8"
        />
        {/* Tongue hint when mouth open */}
        {mouthOpen > 0.3 && (
          <ellipse
            cx="50"
            cy={80.5 + mouthOpen * 2.5}
            rx={2.5 + smileAmount * 1}
            ry={mouthOpen * 2}
            fill="#e85d75"
            opacity="0.65"
          />
        )}
      </svg>
    </div>
  );
}

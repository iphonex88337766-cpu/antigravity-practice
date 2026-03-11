/**
 * AvatarOverlay
 *
 * Three-layer mouth composition (no SVG masks/clipPaths):
 *   1. Background: SVG mouth cavity (burgundy + tongue + cute teeth)
 *   2. Middle: Lower jaw image (CSS-cropped, translates down with jawOpen)
 *   3. Top: Upper face image (CSS-cropped, fixed)
 * Head rotation via facial transformation matrix preserved.
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

// Split point as percentage of image height (where the mouth seam is)
const SPLIT_PCT = 58;
const MAX_JAW_PX = 60; // max pixel drop at full jawOpen

export default function AvatarOverlay({
  landmarks,
  transformationMatrix,
  blendshapes,
  width,
  height,
  avatarSrc = babyTigerSrc,
}: AvatarOverlayProps) {
  const smoothJawRef = useRef(0);

  const jawDrop = useMemo(() => {
    const raw = blendshapes?.["jawOpen"] ?? 0;
    smoothJawRef.current = lerp(smoothJawRef.current, raw, 0.25);
    return smoothJawRef.current * MAX_JAW_PX;
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
      height: size + MAX_JAW_PX,
      transform: rotate,
      transformStyle: "preserve-3d" as const,
      pointerEvents: "none" as const,
      willChange: "transform",
    };
  }, [transformationMatrix, width, height]);

  const size = Math.min(width, height) * 0.8;
  const splitY = (SPLIT_PCT / 100) * size;

  return (
    <div style={containerStyle}>
      {/* ── LAYER 1: Mouth Cavity (behind jaw) ── */}
      <svg
        style={{
          position: "absolute",
          left: 0,
          top: splitY - 5,
          width: size,
          height: jawDrop + 30,
          pointerEvents: "none",
          zIndex: 0,
        }}
        viewBox={`0 0 ${size} ${jawDrop + 30}`}
      >
        {/* Dark burgundy cavity */}
        <ellipse
          cx={size / 2}
          cy={jawDrop * 0.5 + 5}
          rx={size * 0.08 + jawDrop * 0.3}
          ry={Math.max(jawDrop * 0.45, 0.5)}
          fill="hsl(345, 40%, 18%)"
        />
        {/* Soft pink tongue */}
        <ellipse
          cx={size / 2}
          cy={jawDrop * 0.55 + 7}
          rx={size * 0.05 + jawDrop * 0.12}
          ry={Math.max(jawDrop * 0.25, 0.3)}
          fill="hsl(350, 55%, 55%)"
        />
        {/* Upper teeth — soft rounded nubs */}
        {[-12, -4, 4, 12].map((xOff, i) => (
          <rect
            key={`ut-${i}`}
            x={size / 2 + xOff - 3}
            y={1}
            width="6"
            height={Math.min(4 + jawDrop * 0.15, 10)}
            rx="3"
            ry="3"
            fill="hsl(40, 30%, 95%)"
            opacity={Math.min(jawDrop / 8, 1)}
          />
        ))}
        {/* Lower teeth — smaller nubs */}
        {[-8, 0, 8].map((xOff, i) => (
          <rect
            key={`lt-${i}`}
            x={size / 2 + xOff - 2.5}
            y={jawDrop * 0.75 + 2}
            width="5"
            height={Math.min(3 + jawDrop * 0.1, 7)}
            rx="2.5"
            ry="2.5"
            fill="hsl(40, 25%, 92%)"
            opacity={Math.min(jawDrop / 8, 1)}
          />
        ))}
      </svg>

      {/* ── LAYER 2: Lower Jaw (translates down) ── */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: splitY,
          width: size,
          height: size - splitY,
          overflow: "hidden",
          transform: `translateY(${jawDrop}px)`,
          zIndex: 1,
          willChange: "transform",
        }}
      >
        <img
          src={avatarSrc}
          alt=""
          style={{
            position: "absolute",
            left: 0,
            top: -(splitY),
            width: size,
            height: size,
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>

      {/* ── LAYER 3: Upper Face (fixed, on top) ── */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: size,
          height: splitY,
          overflow: "hidden",
          zIndex: 2,
        }}
      >
        <img
          src={avatarSrc}
          alt=""
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: size,
            height: size,
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>

      {/* ── Elastic cheek connectors ── */}
      {jawDrop > 1 && (
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
          {/* Left cheek */}
          <path
            d={`M ${size * 0.38} ${splitY}
                Q ${size * 0.35} ${splitY + jawDrop * 0.5}
                  ${size * 0.39} ${splitY + jawDrop}`}
            stroke="hsl(30, 45%, 62%)"
            strokeWidth="2"
            fill="none"
            opacity={Math.min(jawDrop / 15, 0.5)}
          />
          {/* Right cheek */}
          <path
            d={`M ${size * 0.62} ${splitY}
                Q ${size * 0.65} ${splitY + jawDrop * 0.5}
                  ${size * 0.61} ${splitY + jawDrop}`}
            stroke="hsl(30, 45%, 62%)"
            strokeWidth="2"
            fill="none"
            opacity={Math.min(jawDrop / 15, 0.5)}
          />
        </svg>
      )}
    </div>
  );
}

/**
 * AvatarOverlay — Image-swap approach.
 *
 * Five pre-rendered tiger PNGs with different mouth states
 * are crossfaded based on the tracked mouth openness.
 * The head never moves; only the visible image changes.
 */

import { useMemo, useRef } from "react";
import { type NormalizedLandmark } from "@mediapipe/tasks-vision";

import tigerMouth0 from "@/assets/tiger-mouth-0.png";
import tigerMouth1 from "@/assets/tiger-mouth-1.png";
import tigerMouth2 from "@/assets/tiger-mouth-2.png";
import tigerMouth3 from "@/assets/tiger-mouth-3.png";
import tigerMouth4 from "@/assets/tiger-mouth-4.png";

const MOUTH_STATES = [tigerMouth0, tigerMouth1, tigerMouth2, tigerMouth3, tigerMouth4];
const THRESHOLDS = [0.10, 0.20, 0.32, 0.48]; // boundaries between states 0-1, 1-2, 2-3, 3-4

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
  const r12 = data[6], r22 = data[10];
  return {
    pitch: Math.atan2(-r12, r22) * (180 / Math.PI),
    yaw: Math.asin(r02) * (180 / Math.PI),
    roll: Math.atan2(-r01, r00) * (180 / Math.PI),
  };
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

const SZ = 500;
const BASELINE = 0.06;
const MAX_RATIO = 0.55;

/**
 * Given a normalized 0..1 value, return the primary state index
 * and a blend factor (0..1) toward the next state for crossfading.
 */
function getMouthState(t: number): { idx: number; blend: number } {
  for (let i = 0; i < THRESHOLDS.length; i++) {
    if (t < THRESHOLDS[i]) {
      if (i === 0) return { idx: 0, blend: t / THRESHOLDS[0] };
      const prev = THRESHOLDS[i - 1];
      return { idx: i, blend: (t - prev) / (THRESHOLDS[i] - prev) };
    }
  }
  // Above last threshold
  const last = THRESHOLDS[THRESHOLDS.length - 1];
  const blend = Math.min((t - last) / (1 - last), 1);
  return { idx: THRESHOLDS.length, blend };
}

export default function AvatarOverlay({
  landmarks, transformationMatrix,
  width, height,
}: AvatarOverlayProps) {
  const smoothRef = useRef(0);

  // Mouth openness from landmarks
  const p13 = landmarks[13];
  const p14 = landmarks[14];
  const p78 = landmarks[78];
  const p308 = landmarks[308];

  const mouthHeight = Math.abs(p14.y - p13.y);
  const mouthWidth = Math.abs(p308.x - p78.x);
  const mouthOpenRaw = mouthWidth > 0.001 ? mouthHeight / mouthWidth : 0;

  const normalized = Math.max(0, Math.min((mouthOpenRaw - BASELINE) / (MAX_RATIO - BASELINE), 1));

  // Smooth
  smoothRef.current = lerp(smoothRef.current, normalized, 0.3);
  const t = smoothRef.current;

  // Determine which images to show and blend
  const { idx, blend } = getMouthState(t);
  const nextIdx = Math.min(idx + 1, MOUTH_STATES.length - 1);

  const containerStyle = useMemo(() => {
    const cx = width / 2;
    const cy = height / 2;
    let rotate = "none";
    if (transformationMatrix?.data?.length >= 16) {
      const { pitch, yaw, roll } = matrixToEuler(transformationMatrix.data);
      rotate = `rotateX(${pitch}deg) rotateY(${-yaw}deg) rotateZ(${-roll}deg)`;
    }
    return {
      position: "absolute" as const,
      left: cx - SZ / 2, top: cy - SZ / 2,
      width: SZ, height: SZ,
      transform: rotate,
      transformStyle: "preserve-3d" as const,
      pointerEvents: "none" as const,
      willChange: "transform",
    };
  }, [transformationMatrix, width, height]);

  return (
    <div style={containerStyle}>
      {/* Render all states, controlling opacity for crossfade */}
      {MOUTH_STATES.map((src, i) => {
        let opacity = 0;
        if (i === idx && idx === nextIdx) {
          opacity = 1; // max state, full opacity
        } else if (i === idx) {
          opacity = 1 - blend; // fading out current
        } else if (i === nextIdx) {
          opacity = blend; // fading in next
        }

        if (opacity <= 0) return null;

        return (
          <img
            key={i}
            src={src}
            alt="Avatar"
            draggable={false}
            style={{
              position: "absolute",
              left: 0, top: 0,
              width: SZ, height: SZ,
              display: "block",
              opacity,
              transition: "opacity 0.05s linear",
            }}
          />
        );
      })}

      {/* Debug overlay */}
      <div style={{
        position: "absolute", left: 4, bottom: 4, zIndex: 99,
        background: "rgba(0,0,0,0.75)", color: "#3DFF8A",
        padding: "6px 10px", borderRadius: 6,
        fontSize: 11, fontFamily: "monospace", lineHeight: 1.5,
        pointerEvents: "none",
      }}>
        <div>raw: {mouthOpenRaw.toFixed(3)}</div>
        <div>norm: {normalized.toFixed(3)}</div>
        <div>t: {t.toFixed(3)}</div>
        <div>state: {idx}{idx !== nextIdx ? `→${nextIdx}` : ""} ({(blend * 100).toFixed(0)}%)</div>
      </div>
    </div>
  );
}

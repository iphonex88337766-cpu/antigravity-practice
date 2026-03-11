/**
 * AvatarOverlay — "Solid Face" approach.
 *
 * The full tiger image is ALWAYS visible as the base.
 * A mouth opening is painted ON TOP of it using SVG,
 * then two "shutter" clip-paths cover the snout area
 * and part vertically to reveal the mouth interior.
 *
 * NO translateY. NO detached jaw. One solid silhouette always.
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
  const r12 = data[6], r22 = data[10];
  return {
    pitch: Math.atan2(-r12, r22) * (180 / Math.PI),
    yaw: Math.asin(r02) * (180 / Math.PI),
    roll: Math.atan2(-r01, r00) * (180 / Math.PI),
  };
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

const SZ = 500;


// Mouth region in % of SZ
const MOUTH_CX = 50;  // center X %
const MOUTH_CY = 72;  // center Y %
const MOUTH_W = 16;   // half-width %
const MAX_MOUTH_H = 12; // max half-height % when fully open

/**
 * MouthSVG — drawn on top of the base image, behind the shutters.
 * Contains cavity, tongue (flat semi-oval), and fangs.
 */
function MouthSVG({ t }: { t: number }) {
  if (t <= 0) return null;

  const cx = SZ * (MOUTH_CX / 100);
  const cy = SZ * (MOUTH_CY / 100);
  const hw = SZ * (MOUTH_W / 100);
  const hh = SZ * (MAX_MOUTH_H / 100) * t; // grows with opening

  // Opacities: fangs instant, tongue early, cavity last
  const fangOp = Math.min(t * 5, 1);
  const tongueOp = Math.min(t * 3, 0.9);
  const cavityOp = Math.min(t * 2, 1) * 0.8;

  const fangLen = lerp(2, 11, t);

  return (
    <svg
      style={{
        position: "absolute", left: 0, top: 0,
        width: SZ, height: SZ,
        pointerEvents: "none", zIndex: 1,
      }}
      viewBox={`0 0 ${SZ} ${SZ}`}
    >
      <defs>
        <radialGradient id="mcG" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="hsl(350, 15%, 15%)" />
          <stop offset="100%" stopColor="hsl(340, 20%, 5%)" />
        </radialGradient>
        <clipPath id="mouthClip">
          <ellipse cx={cx} cy={cy} rx={hw} ry={hh} />
        </clipPath>
      </defs>

      {/* Cavity — elliptical, grows with t */}
      <ellipse cx={cx} cy={cy} rx={hw} ry={hh}
        fill="url(#mcG)" opacity={cavityOp} />

      {/* Tongue — flat semi-oval at the bottom of the mouth */}
      <ellipse
        cx={cx}
        cy={cy + hh * 0.45}
        rx={hw * 0.55}
        ry={hh * 0.35}
        fill="hsl(350, 50%, 52%)"
        opacity={tongueOp}
        clipPath="url(#mouthClip)"
      />

      {/* Left fang — triangle */}
      <path
        d={`M ${cx - hw * 0.5} ${cy - hh + 1}
            L ${cx - hw * 0.3} ${cy - hh + 1 + fangLen}
            L ${cx - hw * 0.1} ${cy - hh + 1} Z`}
        fill="hsl(45, 15%, 95%)" opacity={fangOp}
      />
      {/* Right fang */}
      <path
        d={`M ${cx + hw * 0.1} ${cy - hh + 1}
            L ${cx + hw * 0.3} ${cy - hh + 1 + fangLen}
            L ${cx + hw * 0.5} ${cy - hh + 1} Z`}
        fill="hsl(45, 15%, 95%)" opacity={fangOp}
      />
    </svg>
  );
}

export default function AvatarOverlay({
  landmarks, transformationMatrix, blendshapes,
  width, height, avatarSrc = babyTigerSrc,
}: AvatarOverlayProps) {
  const smoothRef = useRef(0);

  // Compute mouth openness from landmarks 13 (upper lip), 14 (lower lip), 78 (left), 308 (right)
  const p13 = landmarks[13];
  const p14 = landmarks[14];
  const p78 = landmarks[78];
  const p308 = landmarks[308];

  const mouthHeight = Math.abs(p14.y - p13.y);
  const mouthWidth = Math.abs(p308.x - p78.x);
  const mouthOpenRaw = mouthWidth > 0.001 ? mouthHeight / mouthWidth : 0;

  // Subtract baseline (closed mouth ratio ~0.05-0.1) and normalize
  const BASELINE = 0.08;
  const MAX_RATIO = 0.7; // fully open ratio
  const normalized = Math.max(0, Math.min((mouthOpenRaw - BASELINE) / (MAX_RATIO - BASELINE), 1));

  // Smooth
  smoothRef.current = lerp(smoothRef.current, normalized, 0.25);
  const t = smoothRef.current;

  // Shutter clip-paths: two halves of the snout that part vertically
  // Upper shutter covers from top to (mouthCY - gap)
  // Lower shutter covers from (mouthCY + gap) to bottom
  const gapH = MAX_MOUTH_H * t; // half-gap in %
  const upperShutter = `polygon(0% 0%, 100% 0%, 100% ${MOUTH_CY - gapH}%, 0% ${MOUTH_CY - gapH}%)`;
  const lowerShutter = `polygon(0% ${MOUTH_CY + gapH}%, 100% ${MOUTH_CY + gapH}%, 100% 100%, 0% 100%)`;

  // Side strips keep the silhouette solid at the edges
  const leftStrip = `polygon(0% ${MOUTH_CY - gapH}%, ${MOUTH_CX - MOUTH_W}% ${MOUTH_CY - gapH}%, ${MOUTH_CX - MOUTH_W}% ${MOUTH_CY + gapH}%, 0% ${MOUTH_CY + gapH}%)`;
  const rightStrip = `polygon(${MOUTH_CX + MOUTH_W}% ${MOUTH_CY - gapH}%, 100% ${MOUTH_CY - gapH}%, 100% ${MOUTH_CY + gapH}%, ${MOUTH_CX + MOUTH_W}% ${MOUTH_CY + gapH}%)`;

  const isOpen = t > 0.01;

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

  // Debug values
  const debugGapH = MAX_MOUTH_H * t;

  return (
    <div style={containerStyle}>
      {/* Layer 0: Full unbroken tiger — ALWAYS visible */}
      <img src={avatarSrc} alt="Avatar" draggable={false}
        style={{
          position: "absolute", left: 0, top: 0,
          width: SZ, height: SZ, display: "block", zIndex: 0,
        }} />

      {isOpen && (
        <>
          {/* Layer 1: Mouth interior SVG — on top of base */}
          <MouthSVG t={t} />

          {/* Layer 2: Shutter overlays — tiger image clipped to cover snout,
              parting to reveal mouth. Edges always covered by side strips. */}
          {[upperShutter, lowerShutter, leftStrip, rightStrip].map((clip, i) => (
            <div key={i} style={{
              position: "absolute", left: 0, top: 0,
              width: SZ, height: SZ,
              clipPath: clip, zIndex: 2,
            }}>
              <img src={avatarSrc} alt="" draggable={false}
                style={{ width: SZ, height: SZ, display: "block" }} />
            </div>
          ))}
        </>
      )}

      {/* DEBUG OVERLAY */}
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
        <div>gapH: {debugGapH.toFixed(1)}%</div>
      </div>
    </div>
  );
}

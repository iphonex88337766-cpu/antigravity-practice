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

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

const MAX_JAW_PX = 48;

/**
 * Generate a smooth W-contour as an array of {x, y} in pixel coords.
 * The W follows a feline upper lip: two whisker-pad lobes with a
 * philtrum dip at center, mouth corners curving into cheeks.
 * Points outside the mouth zone (x < leftEdge or x > rightEdge) stay
 * at the image bottom so the face sides are never split.
 */
function buildWContour(size: number) {
  // Key Y positions (fraction of size)
  const lipY = 0.735;        // base lip line Y
  const lobeDepth = 0.012;   // how much deeper the whisker-pad lobes go
  const philtrumRise = 0.006; // how much the center rises above lobes
  const cornerY = 0.72;      // mouth corner Y (slightly above lip)

  // Key X positions (fraction of size)
  const cornerL = 0.26;
  const cornerR = 0.74;
  const lobeL = 0.39;
  const lobeR = 0.61;
  const center = 0.50;

  // Build smooth curve with many sample points
  const points: { x: number; y: number }[] = [];
  const steps = 80;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = t * size;
    const xf = t; // fraction

    let y: number;

    if (xf < cornerL - 0.12 || xf > cornerR + 0.12) {
      // Outside mouth zone — at image bottom (no split)
      y = size;
    } else if (xf < cornerL) {
      // Transition from bottom up to left mouth corner
      const blend = (xf - (cornerL - 0.12)) / 0.12;
      const smooth = blend * blend * (3 - 2 * blend); // smoothstep
      y = lerp(size, cornerY * size, smooth);
    } else if (xf > cornerR) {
      // Transition from right mouth corner back to bottom
      const blend = (xf - cornerR) / 0.12;
      const smooth = blend * blend * (3 - 2 * blend);
      y = lerp(cornerY * size, size, smooth);
    } else {
      // Inside the mouth zone — compute the W shape
      const mouthT = (xf - cornerL) / (cornerR - cornerL); // 0..1 within mouth

      // W-shape function: two lobes + philtrum
      // Use a combination of cosines for smooth rounded W
      const lobeLT = (xf - cornerL) / (lobeL - cornerL); // 0..1 corner→left lobe
      const lobeRT = (xf - lobeR) / (cornerR - lobeR);   // 0..1 right lobe→corner

      if (xf <= lobeL) {
        // Corner → left lobe: curve down from corner to lobe depth
        const s = clamp(lobeLT, 0, 1);
        const curve = Math.sin(s * Math.PI * 0.5); // ease into lobe
        y = lerp(cornerY, lipY + lobeDepth, curve) * size;
      } else if (xf >= lobeR) {
        // Right lobe → corner: curve up from lobe depth to corner
        const s = clamp(lobeRT, 0, 1);
        const curve = Math.sin(s * Math.PI * 0.5);
        y = lerp(lipY + lobeDepth, cornerY, curve) * size;
      } else {
        // Between lobes — the central W shape with philtrum rise
        const centerT = (xf - lobeL) / (lobeR - lobeL); // 0..1
        // Two bumps (at ~0.25 and ~0.75) with center dip
        const wShape = Math.cos(centerT * Math.PI * 2) * 0.5 + 0.5; // peaks at 0 and 1, valley at 0.5
        const philtrumBump = Math.exp(-Math.pow((centerT - 0.5) * 5, 2)) * philtrumRise;
        y = (lipY + lobeDepth * (1 - wShape * 0.4) - philtrumBump) * size;
      }
    }

    points.push({ x, y });
  }

  return points;
}

/**
 * Convert W-contour points to a CSS clip-path polygon string.
 * For upper face: everything ABOVE the W-line.
 * For lower jaw: everything BELOW the W-line.
 */
function contourToUpperClip(points: { x: number; y: number }[], size: number): string {
  const pStr = [...points].reverse().map(p => `${(p.x / size * 100)}% ${(p.y / size * 100)}%`).join(", ");
  return `polygon(0% 0%, 100% 0%, 100% 100%, ${pStr}, 0% 100%)`;
}

function contourToLowerClip(points: { x: number; y: number }[], size: number): string {
  const pStr = points.map(p => `${(p.x / size * 100)}% ${(p.y / size * 100)}%`).join(", ");
  return `polygon(${pStr}, 100% 100%, 0% 100%)`;
}

/**
 * Build an SVG path string tracing the W-contour (used for mouth interior top edge).
 * Only includes points in the actual mouth zone (y < size).
 */
function contourToSvgPath(points: { x: number; y: number }[], size: number, offsetX: number, offsetY: number): string {
  const mouthPts = points.filter(p => p.y < size - 1);
  if (mouthPts.length < 2) return "";
  let d = `M ${mouthPts[0].x - offsetX} ${mouthPts[0].y - offsetY}`;
  for (let i = 1; i < mouthPts.length; i++) {
    d += ` L ${mouthPts[i].x - offsetX} ${mouthPts[i].y - offsetY}`;
  }
  return d;
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
  const smoothSpreadRef = useRef(0);

  const jawRaw = useMemo(() => {
    const raw = blendshapes?.["jawOpen"] ?? 0;
    // Softer lerp for jelly-like feel
    smoothJawRef.current = lerp(smoothJawRef.current, raw, 0.22);
    return smoothJawRef.current;
  }, [blendshapes]);

  // Slight corner spread for squash-and-stretch
  const spread = useMemo(() => {
    const target = jawRaw * 0.015;
    smoothSpreadRef.current = lerp(smoothSpreadRef.current, target, 0.18);
    return smoothSpreadRef.current;
  }, [jawRaw]);

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

  // Build the W-contour for this size
  const wContour = useMemo(() => buildWContour(size), [size]);
  const upperClip = useMemo(() => contourToUpperClip(wContour, size), [wContour, size]);
  const lowerClip = useMemo(() => contourToLowerClip(wContour, size), [wContour, size]);

  // Mouth zone bounds (only points that are actually in the mouth area)
  const mouthPts = wContour.filter(p => p.y < size - 1);
  const mouthMinX = mouthPts.length > 0 ? Math.min(...mouthPts.map(p => p.x)) : size * 0.26;
  const mouthMaxX = mouthPts.length > 0 ? Math.max(...mouthPts.map(p => p.x)) : size * 0.74;
  const mouthMinY = mouthPts.length > 0 ? Math.min(...mouthPts.map(p => p.y)) : size * 0.72;
  const mouthW = mouthMaxX - mouthMinX;
  const mouthCx = (mouthMinX + mouthMaxX) / 2;

  // SVG viewport for the mouth cavity
  const cavityLeft = mouthMinX - 8;
  const cavityTop = mouthMinY - 4;
  const cavityW = mouthW + 16;
  const cavityH = jawDrop + 30;

  // W-contour path for the cavity top edge (in cavity-local coords)
  const wSvgPath = contourToSvgPath(wContour, size, cavityLeft, cavityTop);

  // Lower mouth arc (bottom of cavity)
  const lowerArcY = jawDrop * 0.85 + 12;
  const lowerArcPath = `M ${mouthMinX - cavityLeft} ${lowerArcY}
    Q ${mouthCx - cavityLeft} ${lowerArcY + jawDrop * 0.2 + 5}
      ${mouthMaxX - cavityLeft} ${lowerArcY}`;

  return (
    <div style={containerStyle}>
      {/* ── LAYER 1: Mouth Interior (behind face layers) ── */}
      <svg
        style={{
          position: "absolute",
          left: cavityLeft,
          top: cavityTop,
          width: cavityW,
          height: cavityH,
          pointerEvents: "none",
          zIndex: 0,
          opacity: jawRaw < 0.03 ? 0 : Math.min((jawRaw - 0.03) / 0.07, 1),
          transition: "opacity 0.1s ease",
        }}
        viewBox={`0 0 ${cavityW} ${cavityH}`}
      >
        {/* Deep dark cavity — follows the W-contour shape as top edge */}
        <path
          d={`${wSvgPath}
              L ${mouthMaxX - cavityLeft} ${lowerArcY}
              Q ${mouthCx - cavityLeft} ${lowerArcY + jawDrop * 0.25 + 6}
                ${mouthMinX - cavityLeft} ${lowerArcY}
              Z`}
          fill="hsl(340, 50%, 10%)"
        />
        {/* Slightly lighter inner cavity rim */}
        <path
          d={`${wSvgPath}
              L ${mouthMaxX - cavityLeft} ${lowerArcY - 2}
              Q ${mouthCx - cavityLeft} ${lowerArcY + jawDrop * 0.15 + 3}
                ${mouthMinX - cavityLeft} ${lowerArcY - 2}
              Z`}
          fill="hsl(340, 45%, 14%)"
        />

        {/* Inner upper lip — soft pink arc along top edge */}
        {jawDrop > 2 && (
          <path
            d={wSvgPath}
            stroke="hsl(350, 48%, 48%)"
            strokeWidth={clamp(1.5 + jawDrop * 0.04, 1.5, 3)}
            fill="none"
            opacity={clamp(jawDrop / 10, 0, 0.7)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Inner lower lip — soft pink arc along bottom */}
        {jawDrop > 3 && (
          <path
            d={lowerArcPath}
            stroke="hsl(350, 45%, 50%)"
            strokeWidth={clamp(1.2 + jawDrop * 0.03, 1.2, 2.5)}
            fill="none"
            opacity={clamp(jawDrop / 12, 0, 0.6)}
            strokeLinecap="round"
          />
        )}

        {/* Tongue — sits in the lower half of the cavity */}
        <ellipse
          cx={mouthCx - cavityLeft}
          cy={jawDrop * 0.55 + 10}
          rx={mouthW * 0.18 + jawDrop * 0.08}
          ry={Math.max(jawDrop * 0.18, 0.3)}
          fill="hsl(350, 58%, 56%)"
        />
        {/* Tongue highlight */}
        <ellipse
          cx={mouthCx - cavityLeft - 1}
          cy={jawDrop * 0.5 + 9}
          rx={mouthW * 0.08 + jawDrop * 0.03}
          ry={Math.max(jawDrop * 0.07, 0.2)}
          fill="hsl(350, 62%, 66%)"
          opacity="0.5"
        />

        {/* ── UPPER TEETH (hang from upper lip W-contour) ── */}
        {/* Left canine — positioned at left lobe area */}
        <polygon
          points={`
            ${mouthCx - cavityLeft - mouthW * 0.22},${2}
            ${mouthCx - cavityLeft - mouthW * 0.22 + 5},${2}
            ${mouthCx - cavityLeft - mouthW * 0.22 + 3.5},${Math.min(5 + jawDrop * 0.5, 20)}
            ${mouthCx - cavityLeft - mouthW * 0.22 + 1},${Math.min(7 + jawDrop * 0.58, 24)}
            ${mouthCx - cavityLeft - mouthW * 0.22 - 0.5},${Math.min(3 + jawDrop * 0.3, 14)}
          `}
          fill="hsl(48, 15%, 95%)"
          stroke="hsl(40, 12%, 88%)"
          strokeWidth="0.4"
          opacity={clamp(jawDrop / 4, 0, 1)}
        />
        {/* Right canine */}
        <polygon
          points={`
            ${mouthCx - cavityLeft + mouthW * 0.22 - 5},${2}
            ${mouthCx - cavityLeft + mouthW * 0.22},${2}
            ${mouthCx - cavityLeft + mouthW * 0.22 + 0.5},${Math.min(3 + jawDrop * 0.3, 14)}
            ${mouthCx - cavityLeft + mouthW * 0.22 - 1},${Math.min(7 + jawDrop * 0.58, 24)}
            ${mouthCx - cavityLeft + mouthW * 0.22 - 3.5},${Math.min(5 + jawDrop * 0.5, 20)}
          `}
          fill="hsl(48, 15%, 95%)"
          stroke="hsl(40, 12%, 88%)"
          strokeWidth="0.4"
          opacity={clamp(jawDrop / 4, 0, 1)}
        />
        {/* Upper incisors — small rounded teeth at center */}
        {[-6, -2, 2, 6].map((xOff, i) => (
          <rect
            key={`ui-${i}`}
            x={mouthCx - cavityLeft + xOff - 1.8}
            y={1}
            width="3.6"
            height={Math.min(2.5 + jawDrop * 0.14, 7)}
            rx="1.4"
            ry="1.4"
            fill="hsl(48, 14%, 94%)"
            stroke="hsl(40, 10%, 89%)"
            strokeWidth="0.25"
            opacity={clamp(jawDrop / 5, 0, 1)}
          />
        ))}

        {/* ── LOWER TEETH (rise from lower jaw) ── */}
        {/* Lower canine stubs */}
        <polygon
          points={`
            ${mouthCx - cavityLeft - mouthW * 0.19},${lowerArcY - 1}
            ${mouthCx - cavityLeft - mouthW * 0.19 + 4},${lowerArcY - 1}
            ${mouthCx - cavityLeft - mouthW * 0.19 + 3},${lowerArcY - 1 - Math.min(jawDrop * 0.22, 9)}
            ${mouthCx - cavityLeft - mouthW * 0.19 + 1},${lowerArcY - 1 - Math.min(jawDrop * 0.26, 11)}
          `}
          fill="hsl(48, 14%, 93%)"
          stroke="hsl(40, 10%, 87%)"
          strokeWidth="0.25"
          opacity={clamp(jawDrop / 6, 0, 1)}
        />
        <polygon
          points={`
            ${mouthCx - cavityLeft + mouthW * 0.19 - 4},${lowerArcY - 1}
            ${mouthCx - cavityLeft + mouthW * 0.19},${lowerArcY - 1}
            ${mouthCx - cavityLeft + mouthW * 0.19 - 1},${lowerArcY - 1 - Math.min(jawDrop * 0.26, 11)}
            ${mouthCx - cavityLeft + mouthW * 0.19 - 3},${lowerArcY - 1 - Math.min(jawDrop * 0.22, 9)}
          `}
          fill="hsl(48, 14%, 93%)"
          stroke="hsl(40, 10%, 87%)"
          strokeWidth="0.25"
          opacity={clamp(jawDrop / 6, 0, 1)}
        />
        {/* Lower incisors */}
        {[-4, 0, 4].map((xOff, i) => (
          <rect
            key={`li-${i}`}
            x={mouthCx - cavityLeft + xOff - 1.3}
            y={lowerArcY - 1 - Math.min(2 + jawDrop * 0.08, 4.5)}
            width="2.6"
            height={Math.min(2 + jawDrop * 0.08, 4.5)}
            rx="1"
            ry="1"
            fill="hsl(48, 12%, 92%)"
            stroke="hsl(40, 8%, 87%)"
            strokeWidth="0.2"
            opacity={clamp(jawDrop / 6, 0, 1)}
          />
        ))}
      </svg>

      {/* ── Skin-colored corner fills (bridge upper and lower jaw at corners) ── */}
      {jawDrop > 1 && (
        <svg
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: size,
            height: size + MAX_JAW_PX,
            pointerEvents: "none",
            zIndex: 1,
          }}
          viewBox={`0 0 ${size} ${size + MAX_JAW_PX}`}
        >
          {/* Left corner skin bridge */}
          <path
            d={`M ${mouthMinX + 2} ${mouthMinY + 2}
                Q ${mouthMinX - 6} ${mouthMinY + jawDrop * 0.5 + 1}
                  ${mouthMinX + 2} ${mouthMinY + jawDrop + 2}
                L ${mouthMinX + 12} ${mouthMinY + jawDrop * 0.5 + 1}
                Z`}
            fill="hsl(30, 55%, 68%)"
            opacity={clamp(jawDrop / 8, 0, 0.55)}
          />
          {/* Right corner skin bridge */}
          <path
            d={`M ${mouthMaxX - 2} ${mouthMinY + 2}
                Q ${mouthMaxX + 6} ${mouthMinY + jawDrop * 0.5 + 1}
                  ${mouthMaxX - 2} ${mouthMinY + jawDrop + 2}
                L ${mouthMaxX - 12} ${mouthMinY + jawDrop * 0.5 + 1}
                Z`}
            fill="hsl(30, 55%, 68%)"
            opacity={clamp(jawDrop / 8, 0, 0.55)}
          />
        </svg>
      )}

      {/* ── LAYER 2: Lower Jaw (translates down, slight horizontal spread) ── */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: size,
          height: size,
          clipPath: lowerClip,
          zIndex: 2,
          transform: `translateY(${jawDrop}px) scaleX(${1 + spread})`,
          transformOrigin: "50% 73%",
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

      {/* ── LAYER 3: Upper Face (fixed, everything above W-contour) ── */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: size,
          height: size,
          clipPath: upperClip,
          zIndex: 3,
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
    </div>
  );
}

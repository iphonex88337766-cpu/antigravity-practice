/**
 * AvatarOverlay — Elastic corner-anchored bloom mouth.
 *
 * The W-contour corners are FIXED to the upper face.
 * Only the center of the contour drops with jawOpen, creating
 * an elastic stretching effect — no gap at the sides ever.
 * When closed: single unclipped image, zero seam.
 */

import { useMemo, useRef, memo } from "react";
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

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

const SZ = 500;
const MAX_JAW_PX = 53;
const OPEN_THRESHOLD = 0.06;

/**
 * Static W-contour — base positions when mouth is closed.
 * Format: [x%, y%, elasticity]
 *   elasticity: 0 = pinned (corners/edges), 1 = full drop (center)
 *   Values in between create the elastic stretch gradient.
 */
const W_BASE: [number, number, number][] = [
  // Left edge — pinned
  [0, 100, 0], [12, 100, 0], [18, 100, 0],
  // Transition into mouth — gradual elasticity
  [22, 95, 0], [26, 87, 0], [29, 80, 0.02],
  [32, 76, 0.08],
  [34, 74, 0.15],    // left corner — nearly pinned
  [36, 73.5, 0.25],
  [39, 73.2, 0.4],
  [42, 73, 0.6],
  [44, 72.8, 0.75],
  [46, 72.5, 0.85],
  [48, 72.2, 0.95],
  [50, 72, 1.0],     // center — full drop
  [52, 72.2, 0.95],
  [54, 72.5, 0.85],
  [56, 72.8, 0.75],
  [58, 73, 0.6],
  [61, 73.2, 0.4],
  [64, 73.5, 0.25],
  [66, 74, 0.15],    // right corner — nearly pinned
  [68, 76, 0.08],
  [71, 80, 0.02],
  [74, 87, 0], [78, 95, 0],
  // Right edge — pinned
  [82, 100, 0], [88, 100, 0], [100, 100, 0],
];

/**
 * Compute the elastically deformed lower jaw contour.
 * Each point's Y shifts down by (jawDropPx * elasticity),
 * converted to % of SZ. Corners stay put, center stretches.
 */
function elasticLowerContour(jawDropPx: number): [number, number][] {
  return W_BASE.map(([x, y, e]) => {
    if (y >= 100) return [x, y] as [number, number];
    const dropPct = (jawDropPx * e / SZ) * 100;
    return [x, Math.min(y + dropPct, 100)] as [number, number];
  });
}

/** Upper face always uses the STATIC contour (corners never move) */
function upperClip(pts: [number, number][]): string {
  const rev = [...pts].reverse().map(([x, y]) => `${x}% ${y}%`).join(", ");
  return `polygon(0% 0%, 100% 0%, 100% 100%, ${rev}, 0% 100%)`;
}

function lowerClip(pts: [number, number][]): string {
  const fwd = pts.map(([x, y]) => `${x}% ${y}%`).join(", ");
  return `polygon(${fwd}, 100% 100%, 0% 100%)`;
}

// Static upper clip — corners are always fixed
const STATIC_CONTOUR: [number, number][] = W_BASE.map(([x, y]) => [x, y]);
const UPPER_CLIP = upperClip(STATIC_CONTOUR);

/** Mouth interior — fangs first, cavity last */
function MouthInterior({ jawDrop, elasticPts }: { jawDrop: number; elasticPts: [number, number][] }) {
  if (jawDrop < 0.5) return null;

  const bloom = Math.min(jawDrop / MAX_JAW_PX, 1);
  const contourY = SZ * 0.72;

  // Cavity center follows the elastic center point
  const centerPt = elasticPts.find(([x]) => x === 50);
  const cavityCenterY = centerPt ? SZ * (centerPt[1] / 100) : contourY + jawDrop * 0.3;
  const cavityCY = (contourY + cavityCenterY) / 2;

  // The visible opening height is the distance between static upper and elastic lower center
  const openingHeight = cavityCenterY - contourY;

  const cavityOpacity = Math.max(0, (bloom - 0.15) * 0.85);
  const fangOpacity = Math.min(bloom * 3, 0.92);
  const fangLength = Math.min(openingHeight * 0.7, 15);
  const tongueOpacity = Math.min(bloom * 2, 0.75);

  // Cavity width follows the elastic spread — narrower than the corner span
  const leftCorner = elasticPts.find(([x]) => x === 34);
  const rightCorner = elasticPts.find(([x]) => x === 66);
  const lcX = leftCorner ? SZ * (leftCorner[0] / 100) : SZ * 0.34;
  const rcX = rightCorner ? SZ * (rightCorner[0] / 100) : SZ * 0.66;
  const mouthWidth = (rcX - lcX) * 0.6;

  return (
    <svg
      style={{
        position: "absolute",
        left: 0, top: 0,
        width: SZ, height: SZ + MAX_JAW_PX,
        pointerEvents: "none",
      }}
      viewBox={`0 0 ${SZ} ${SZ + MAX_JAW_PX}`}
    >
      <defs>
        <radialGradient id="cavG" cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor="hsl(350, 18%, 15%)" />
          <stop offset="100%" stopColor="hsl(340, 25%, 8%)" />
        </radialGradient>
        <filter id="mSoft">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
        <filter id="fSoft">
          <feGaussianBlur stdDeviation="0.4" />
        </filter>
      </defs>

      {/* Dark cavity — delayed, follows elastic shape */}
      <ellipse
        cx={SZ * 0.5}
        cy={cavityCY}
        rx={mouthWidth * 0.5}
        ry={openingHeight * 0.45}
        fill="url(#cavG)"
        opacity={cavityOpacity}
        filter="url(#mSoft)"
      />

      {/* Tongue — early hint */}
      {openingHeight > 2 && (
        <ellipse
          cx={SZ * 0.5}
          cy={cavityCY + openingHeight * 0.1}
          rx={mouthWidth * 0.3}
          ry={Math.max(openingHeight * 0.25, 1.5)}
          fill="hsl(350, 50%, 58%)"
          opacity={tongueOpacity}
          filter="url(#mSoft)"
        />
      )}

      {/* Fangs — appear first */}
      {openingHeight > 1 && (
        <>
          <path
            d={`M ${SZ * 0.43} ${contourY - 0.5}
                L ${SZ * 0.445} ${contourY + fangLength}
                L ${SZ * 0.46} ${contourY - 0.5} Z`}
            fill="hsl(40, 15%, 96%)"
            opacity={fangOpacity}
            filter="url(#fSoft)"
          />
          <path
            d={`M ${SZ * 0.54} ${contourY - 0.5}
                L ${SZ * 0.555} ${contourY + fangLength}
                L ${SZ * 0.57} ${contourY - 0.5} Z`}
            fill="hsl(40, 15%, 96%)"
            opacity={fangOpacity}
            filter="url(#fSoft)"
          />
        </>
      )}
    </svg>
  );
}

/* ── Eye positions on the 500×500 tiger asset ── */
const LEFT_EYE  = { cx: 190, cy: 222, rx: 38, ry: 22 };
const RIGHT_EYE = { cx: 310, cy: 222, rx: 38, ry: 22 };

// Colors sampled from the tiger's fur around the eyes
const LID_FILL   = "#E89033";  // orange fur
const LID_SHADOW = "#C47428";  // darker crease
const LID_LINE   = "#8B5E2B";  // closed-eye line

/** Eyelid overlay — curved arcs that match the tiger's eye shape */
const EyelidOverlay = memo(function EyelidOverlay({
  leftBlink,
  rightBlink,
}: {
  leftBlink: number;
  rightBlink: number;
}) {
  if (leftBlink < 0.03 && rightBlink < 0.03) return null;

  return (
    <svg
      style={{
        position: "absolute",
        left: 0, top: 0,
        width: SZ, height: SZ,
        pointerEvents: "none",
        zIndex: 3,
      }}
      viewBox={`0 0 ${SZ} ${SZ}`}
    >
      <defs>
        <filter id="lidBlur">
          <feGaussianBlur stdDeviation="0.8" />
        </filter>
        <filter id="lidShadow">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      <EyelidPair eye={LEFT_EYE} blink={leftBlink} />
      <EyelidPair eye={RIGHT_EYE} blink={rightBlink} />
    </svg>
  );
});

/**
 * Single eye — upper lid sweeps down as a concave arc,
 * lower lid sweeps up. Both use cubic beziers to match
 * the almond/oval shape of the tiger's illustrated eyes.
 */
function EyelidPair({
  eye,
  blink,
}: {
  eye: { cx: number; cy: number; rx: number; ry: number };
  blink: number;
}) {
  if (blink < 0.03) return null;

  const { cx, cy, rx, ry } = eye;
  const t = Math.min(blink, 1);

  // Eye corner anchor points (almond shape)
  const lx = cx - rx;       // left corner x
  const rx2 = cx + rx;      // right corner x
  const cornerY = cy + 1;   // corners sit just below center

  // ── UPPER LID ──
  // At t=0: lid sits at top of eye socket (invisible above eye)
  // At t=1: lid arc sweeps down to the center line
  const upperRestY = cy - ry - 4;            // hidden above eye
  const upperClosedY = cy + 1;               // meets center when closed
  const upperPeakY = lerp(upperRestY, upperClosedY, t);

  // Cubic bezier control points for a smooth concave arc
  // The lid curves DOWN from corners, deepest at center
  const upperPath = [
    `M ${lx} ${cornerY}`,
    `C ${lx + rx * 0.3} ${upperPeakY - ry * 0.15},`,
    `  ${rx2 - rx * 0.3} ${upperPeakY - ry * 0.15},`,
    `  ${rx2} ${cornerY}`,
    // Close upward through the socket top (fills the lid area)
    `L ${rx2} ${cy - ry - 6}`,
    `C ${rx2 - rx * 0.4} ${cy - ry - 8},`,
    `  ${lx + rx * 0.4} ${cy - ry - 8},`,
    `  ${lx} ${cy - ry - 6}`,
    `Z`,
  ].join(" ");

  // ── LOWER LID ──
  const lowerRestY = cy + ry + 4;
  const lowerClosedY = cy - 1;
  const lowerPeakY = lerp(lowerRestY, lowerClosedY, t);

  const lowerPath = [
    `M ${lx} ${cornerY}`,
    `C ${lx + rx * 0.3} ${lowerPeakY + ry * 0.15},`,
    `  ${rx2 - rx * 0.3} ${lowerPeakY + ry * 0.15},`,
    `  ${rx2} ${cornerY}`,
    `L ${rx2} ${cy + ry + 6}`,
    `C ${rx2 - rx * 0.4} ${cy + ry + 8},`,
    `  ${lx + rx * 0.4} ${cy + ry + 8},`,
    `  ${lx} ${cy + ry + 6}`,
    `Z`,
  ].join(" ");

  // Crease shadow above upper lid — subtle depth
  const creaseOpacity = t * 0.4;

  // Thin closed-eye curve when nearly shut
  const showClosedLine = t > 0.8;
  const closedLineOpacity = Math.min((t - 0.8) / 0.2, 1) * 0.85;

  return (
    <g>
      {/* Subtle shadow/crease above the upper lid */}
      <path
        d={upperPath}
        fill={LID_SHADOW}
        opacity={creaseOpacity}
        filter="url(#lidShadow)"
        transform={`translate(0, -2)`}
      />

      {/* Upper eyelid */}
      <path
        d={upperPath}
        fill={LID_FILL}
        opacity={Math.min(t * 1.3, 1)}
        filter="url(#lidBlur)"
      />

      {/* Lower eyelid — subtler, follows less aggressively */}
      <path
        d={lowerPath}
        fill={LID_FILL}
        opacity={Math.min(t * 0.9, 0.85)}
        filter="url(#lidBlur)"
      />

      {/* Closed-eye line — thin curved stroke when fully shut */}
      {showClosedLine && (
        <path
          d={`M ${lx + 4} ${cy} C ${lx + rx * 0.4} ${cy - 3}, ${rx2 - rx * 0.4} ${cy - 3}, ${rx2 - 4} ${cy}`}
          stroke={LID_LINE}
          strokeWidth={1.5}
          strokeLinecap="round"
          fill="none"
          opacity={closedLineOpacity}
        />
      )}
    </g>
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
  const smoothLeftEyeRef = useRef(0);
  const smoothRightEyeRef = useRef(0);

  const jawRaw = blendshapes?.["jawOpen"] ?? 0;
  smoothJawRef.current = lerp(smoothJawRef.current, jawRaw, 0.18);
  const jawNorm = smoothJawRef.current;
  const jawDrop = easeOut(Math.min(jawNorm, 1)) * MAX_JAW_PX;

  // Eye blink: blendshape gives 0=open, 1=closed
  const leftBlinkRaw = blendshapes?.["eyeBlinkLeft"] ?? 0;
  const rightBlinkRaw = blendshapes?.["eyeBlinkRight"] ?? 0;
  smoothLeftEyeRef.current = lerp(smoothLeftEyeRef.current, leftBlinkRaw, 0.25);
  smoothRightEyeRef.current = lerp(smoothRightEyeRef.current, rightBlinkRaw, 0.25);

  const isOpen = jawNorm > OPEN_THRESHOLD;

  // Compute elastic contour — corners pinned, center drops
  const elasticPts = elasticLowerContour(jawDrop);
  const ELASTIC_LOWER_CLIP = isOpen ? lowerClip(elasticPts) : "none";

  const featherPx = isOpen ? Math.max(0, 1.5 - jawDrop * 0.06) : 0;

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
      height: SZ + MAX_JAW_PX,
      transform: rotate,
      transformStyle: "preserve-3d" as const,
      pointerEvents: "none" as const,
      willChange: "transform",
    };
  }, [transformationMatrix, width, height]);

  const featherFilter = featherPx > 0.1
    ? `drop-shadow(0 0 ${featherPx}px rgba(0,0,0,0.06))`
    : "none";

  return (
    <div style={containerStyle}>
      {/* Base image — ALWAYS rendered, never unmounted */}
      <img
        src={avatarSrc}
        alt="Avatar"
        draggable={false}
        style={{
          position: "absolute",
          left: 0, top: 0,
          width: SZ, height: SZ,
          display: "block",
          zIndex: 0,
        }}
      />

      {/* Layered structure — only visible when open, overlays the base */}
      {isOpen && (
        <>
          {/* Mouth interior — behind clipped layers */}
          <MouthInterior jawDrop={jawDrop} elasticPts={elasticPts} />

          {/* Lower jaw — elastic clip */}
          <div
            style={{
              position: "absolute",
              left: 0, top: 0,
              width: SZ, height: SZ,
              clipPath: ELASTIC_LOWER_CLIP,
              zIndex: 1,
              filter: featherFilter,
              willChange: "clip-path",
            }}
          >
            <img src={avatarSrc} alt="" draggable={false}
              style={{ width: SZ, height: SZ, display: "block" }} />
          </div>

          {/* Upper face — fixed contour */}
          <div
            style={{
              position: "absolute",
              left: 0, top: 0,
              width: SZ, height: SZ,
              clipPath: UPPER_CLIP,
              zIndex: 2,
              filter: featherFilter,
            }}
          >
            <img src={avatarSrc} alt="" draggable={false}
              style={{ width: SZ, height: SZ, display: "block" }} />
          </div>
        </>
      )}

      {/* Eyelid blink overlay — always on top */}
      <EyelidOverlay
        leftBlink={smoothLeftEyeRef.current}
        rightBlink={smoothRightEyeRef.current}
      />
    </div>
  );
}

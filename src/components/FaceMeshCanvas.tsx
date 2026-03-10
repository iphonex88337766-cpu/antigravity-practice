/**
 * FaceMeshCanvas
 * 
 * Renders the 468-point face mesh as slightly irregular polygons
 * connected by tessellation lines in Bio-Phosphor green.
 * 
 * Anti-pattern: No perfect circles. Each landmark is a 3-4 vertex
 * polygon that subtly shifts shape each frame — living cells, not dots.
 */

import { useEffect, useRef, memo } from "react";
import { type NormalizedLandmark, FaceLandmarker } from "@mediapipe/tasks-vision";

interface FaceMeshCanvasProps {
  landmarks: NormalizedLandmark[] | null;
  width: number;
  height: number;
  hasDetected: boolean;
}

const BIO_PHOSPHOR = "#3DFF8A";
const BIO_PHOSPHOR_DIM = "rgba(61, 255, 138, 0.3)";

/**
 * Draw an irregular polygon (3-4 vertices) at a point.
 * Vertices jitter slightly each frame for organic feel.
 */
function drawIrregularDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number
) {
  const vertices = 3 + Math.floor(Math.random() * 2);
  ctx.beginPath();
  for (let i = 0; i < vertices; i++) {
    const angle = (Math.PI * 2 * i) / vertices + (Math.random() - 0.5) * 0.6;
    const r = radius * (0.7 + Math.random() * 0.6);
    const vx = x + Math.cos(angle) * r;
    const vy = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(vx, vy);
    else ctx.lineTo(vx, vy);
  }
  ctx.closePath();
  ctx.fill();
}

const FaceMeshCanvas = memo(function FaceMeshCanvas({
  landmarks,
  width,
  height,
  hasDetected,
}: FaceMeshCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (!landmarks || landmarks.length === 0) return;

    // Mirror X coordinates to match the CSS-mirrored video feed.
    // MediaPipe returns landmarks in unmirrored space, but our video
    // is displayed with scaleX(-1), so we flip x: (1 - x).

    // Draw tessellation lines
    ctx.strokeStyle = BIO_PHOSPHOR_DIM;
    ctx.lineWidth = 0.5;

    const connections = FaceLandmarker.FACE_LANDMARKS_TESSELATION;
    if (connections) {
      for (const conn of connections) {
        const p1 = landmarks[(conn as any).start];
        const p2 = landmarks[(conn as any).end];
        if (!p1 || !p2) continue;

        ctx.beginPath();
        ctx.moveTo((1 - p1.x) * width, p1.y * height);
        ctx.lineTo((1 - p2.x) * width, p2.y * height);
        ctx.stroke();
      }
    }

    // Draw landmark dots as irregular polygons
    ctx.fillStyle = BIO_PHOSPHOR;
    for (const point of landmarks) {
      drawIrregularDot(ctx, (1 - point.x) * width, point.y * height, 1.2);
    }
  }, [landmarks, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`absolute inset-0 w-full h-full ${hasDetected ? "animate-heartbeat" : ""}`}
      style={{ pointerEvents: "none" }}
    />
  );
});

export default FaceMeshCanvas;

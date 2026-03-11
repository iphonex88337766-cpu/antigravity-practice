/**
 * PuppyOverlay — DISABLED for clean-screen test.
 * Renders nothing. Blink trigger commented out.
 */

import { type NormalizedLandmark } from "@mediapipe/tasks-vision";

interface PuppyOverlayProps {
  landmarks: NormalizedLandmark[];
  blendshapes: Record<string, number> | null;
  width: number;
  height: number;
}

export default function PuppyOverlay(_props: PuppyOverlayProps) {
  // DISABLED — rendering nothing to confirm clean screen
  return null;
}

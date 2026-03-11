/**
 * AvatarOverlay
 * 
 * Renders a character image centered on the nose tip (landmark 1),
 * scaled by face size, and rotated using the facial transformation matrix.
 * Ready for asset-swapping — just change the image import.
 */

import { useMemo } from "react";
import { type NormalizedLandmark } from "@mediapipe/tasks-vision";
import babyTigerSrc from "@/assets/baby-tiger.png";

interface AvatarOverlayProps {
  landmarks: NormalizedLandmark[];
  transformationMatrix: { rows: number; columns: number; data: number[] } | null;
  width: number;
  height: number;
  avatarSrc?: string;
}

/** Extract yaw, pitch, roll from a 4×4 column-major matrix */
function matrixToEuler(data: number[]): { pitch: number; yaw: number; roll: number } {
  // MediaPipe returns a 4x4 matrix in row-major order
  const r00 = data[0], r01 = data[1], r02 = data[2];
  const r10 = data[4], r11 = data[5], r12 = data[6];
  const r20 = data[8], r21 = data[9], r22 = data[10];

  const pitch = Math.atan2(-r12, r22) * (180 / Math.PI);
  const yaw = Math.asin(r02) * (180 / Math.PI);
  const roll = Math.atan2(-r01, r00) * (180 / Math.PI);

  return { pitch, yaw, roll };
}

export default function AvatarOverlay({
  landmarks,
  transformationMatrix,
  width,
  height,
  avatarSrc = babyTigerSrc,
}: AvatarOverlayProps) {
  const style = useMemo(() => {
    if (!landmarks || landmarks.length === 0) return { display: "none" as const };

    // Nose tip — landmark 1, mirrored to match CSS-mirrored video
    const nose = landmarks[1];
    const cx = (1 - nose.x) * width;
    const cy = nose.y * height;

    // Scale based on distance between outer eye corners (landmarks 33 & 263)
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const eyeDistPx = Math.hypot(
      (leftEye.x - rightEye.x) * width,
      (leftEye.y - rightEye.y) * height
    );

    // Avatar size = ~2.8× eye distance for a good face cover
    const size = Math.max(eyeDistPx * 2.8, 60);

    // Rotation from transformation matrix
    let rotate = "none";
    if (transformationMatrix && transformationMatrix.data?.length >= 16) {
      const { pitch, yaw, roll } = matrixToEuler(transformationMatrix.data);
      // Mirror yaw and roll to match the mirrored video
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
      willChange: "transform, left, top, width, height",
    };
  }, [landmarks, transformationMatrix, width, height]);

  return (
    <img
      src={avatarSrc}
      alt="Avatar"
      style={style}
      draggable={false}
    />
  );
}

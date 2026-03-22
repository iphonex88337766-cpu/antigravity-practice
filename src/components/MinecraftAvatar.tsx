import { useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { type NormalizedLandmark } from "@mediapipe/tasks-vision";
import { Group, MathUtils, Mesh } from "three";

interface MinecraftAvatarProps {
  landmarks: NormalizedLandmark[];
  transformationMatrix: { rows: number; columns: number; data: number[] } | null;
  blendshapes?: Record<string, number> | null;
  width: number;
  height: number;
}

function matrixToEuler(data: number[]): { pitch: number; yaw: number; roll: number } {
  // Matches the math used in AvatarOverlay
  const r00 = data[0], r01 = data[1], r02 = data[2];
  const r12 = data[6];
  const r22 = data[10];
  const pitch = Math.atan2(-r12, r22);   // Radians
  const yaw = Math.asin(r02);            // Radians
  const roll = Math.atan2(-r01, r00);    // Radians
  return { pitch, yaw, roll };
}

function MinecraftHead({ landmarks, transformationMatrix, blendshapes }: Partial<MinecraftAvatarProps>) {
  const avatarGroupRef = useRef<Group>(null);
  const headGroupRef = useRef<Group>(null);
  const jawRef = useRef<Group>(null);
  const leftEyeRef = useRef<Group>(null);
  const rightEyeRef = useRef<Group>(null);
  const mouthCavityRef = useRef<Mesh>(null);
  const leftSmileCornerRef = useRef<Mesh>(null);
  const rightSmileCornerRef = useRef<Mesh>(null);
  const leftFrownCornerRef = useRef<Mesh>(null);
  const rightFrownCornerRef = useRef<Mesh>(null);

  const { viewport } = useThree();

  // Smooth out blendshapes using refs
  const currentJaw = useRef(0);
  const currentLeftEye = useRef(0);
  const currentRightEye = useRef(0);
  const currentWideLeft = useRef(0);
  const currentWideRight = useRef(0);
  const currentSmile = useRef(0);
  const currentFrownLeft = useRef(0);
  const currentFrownRight = useRef(0);
  const currentFrown = useRef(0);

  useFrame((_, delta) => {
    // 0. Face Position & Scale tracking
    if (avatarGroupRef.current && landmarks && landmarks.length > 0) {
      const nose = landmarks[1]; // Nose tip
      const topHead = landmarks[10]; // Top of face
      const bottomChin = landmarks[152]; // Bottom of chin

      // Face size in normalized coordinates
      const faceHeight = Math.abs(topHead.y - bottomChin.y);
      const targetScale = faceHeight * 2.5; // Reduced scale by ~33% to prevent it from being too large

      // Map normalized coordinates (0 to 1) to viewport coordinates
      // Video is mirrored, so we mirror the X axis coordinates
      const targetX = -(nose.x - 0.5) * viewport.width;
      const targetY = -(nose.y - 0.5) * viewport.height;

      avatarGroupRef.current.position.x = MathUtils.lerp(avatarGroupRef.current.position.x, targetX, 15 * delta);
      avatarGroupRef.current.position.y = MathUtils.lerp(avatarGroupRef.current.position.y, targetY, 15 * delta);

      avatarGroupRef.current.scale.x = MathUtils.lerp(avatarGroupRef.current.scale.x, targetScale, 15 * delta);
      avatarGroupRef.current.scale.y = MathUtils.lerp(avatarGroupRef.current.scale.y, targetScale, 15 * delta);
      avatarGroupRef.current.scale.z = MathUtils.lerp(avatarGroupRef.current.scale.z, targetScale, 15 * delta);
    }

    // 1. Head Rotation mapping from MediaPipe transformation matrix
    if (headGroupRef.current && transformationMatrix && transformationMatrix.data?.length >= 16) {
      const { pitch, yaw, roll } = matrixToEuler(transformationMatrix.data);
      // Adjust axes for Three.js coordinates vs MediaPipe camera coordinates
      // The pitch is negated to correctly map looking up/down
      // Add a slight backward tilt (negative pitch) proportional to jaw opening for a surprised look
      // Add a forward tilt (positive pitch) proportional to frown for a sad look
      const surpriseTilt = currentJaw.current * 0.4;
      const frownTilt = currentFrown.current * 0.15; // Reduced from 0.3 for a softer tilt
      headGroupRef.current.rotation.set(-pitch - surpriseTilt + frownTilt, yaw, roll);
    }

    // 2. Blendshapes (Jaw, Blink & Wide Eyes)
    if (blendshapes) {
      const rawJaw = blendshapes["jawOpen"] ?? 0;
      // Sensitivity up: multiply by 2.5 so small mouth openings are detected
      // Clamp to max 0.5 radians so it doesn't open too wide
      const clampedJaw = MathUtils.clamp(rawJaw * 2.5, 0, 0.5);

      // S-Curve Easing (Smoothstep):
      // Maps the linear 0~0.5 value to a smooth S-curve (0~1)
      // This makes the animation start slow, speed up in the middle, and slow down at the end
      const smoothFactor = MathUtils.smoothstep(clampedJaw, 0, 0.5);
      const targetSmoothedJaw = smoothFactor * 0.5;

      // Soft hardware lerp for fluid, non-robotic trailing motion
      currentJaw.current = MathUtils.lerp(currentJaw.current, targetSmoothedJaw, 10 * delta);

      if (jawRef.current) {
        // Apply final eased rotation
        jawRef.current.rotation.x = currentJaw.current;
      }

      // Swapped left/right blendshapes to fix mirroring
      const targetLeft = blendshapes["eyeBlinkRight"] ?? 0;
      const targetRight = blendshapes["eyeBlinkLeft"] ?? 0;
      currentLeftEye.current = MathUtils.lerp(currentLeftEye.current, targetLeft, 15 * delta);
      currentRightEye.current = MathUtils.lerp(currentRightEye.current, targetRight, 15 * delta);

      // Eye wide blendshapes
      const targetWideLeft = blendshapes["eyeWideRight"] ?? 0;
      const targetWideRight = blendshapes["eyeWideLeft"] ?? 0;
      currentWideLeft.current = MathUtils.lerp(currentWideLeft.current, targetWideLeft, 15 * delta);
      currentWideRight.current = MathUtils.lerp(currentWideRight.current, targetWideRight, 15 * delta);

      // Smile and Frown blendshapes
      const targetSmileLeft = blendshapes["mouthSmileLeft"] ?? 0;
      const targetSmileRight = blendshapes["mouthSmileRight"] ?? 0;
      currentSmile.current = MathUtils.lerp(currentSmile.current, Math.max(targetSmileLeft, targetSmileRight), 15 * delta);

      const targetFrownLeft = blendshapes["mouthFrownLeft"] ?? 0;
      const targetFrownRight = blendshapes["mouthFrownRight"] ?? 0;
      currentFrownLeft.current = MathUtils.lerp(currentFrownLeft.current, targetFrownLeft, 15 * delta);
      currentFrownRight.current = MathUtils.lerp(currentFrownRight.current, targetFrownRight, 15 * delta);

      // Average for general face rotation/tilt tracking
      currentFrown.current = (currentFrownLeft.current + currentFrownRight.current) / 2.0;

      // Ensure a tiny bit of natural asymmetry if the raw data is perfectly identical
      // Adding a subtle 15% reduction to the right side of the face for sad expressions only.
      const mixedFrownLeft = currentFrownLeft.current;
      const mixedFrownRight = currentFrownRight.current * 0.85;

      // Scale Y of eye meshes to simulate blinking, widening, smiling (squint), and sadness (drooping). 
      // Eye wide scales it UP, eye blink scales it DOWN. Smile squints it slightly DOWN.
      const smileSquint = currentSmile.current * 0.6; // Increased squint for a clearer smile

      const wideLeftScale = 1 + (currentWideLeft.current * 1.5) + (currentJaw.current * 0.6) - smileSquint - (mixedFrownLeft * 0.15);
      const wideRightScale = 1 + (currentWideRight.current * 1.5) + (currentJaw.current * 0.6) - smileSquint - (mixedFrownRight * 0.15);

      if (leftEyeRef.current) {
        leftEyeRef.current.scale.y = Math.max(0.1, wideLeftScale - currentLeftEye.current * 1.5);
        leftEyeRef.current.position.y = 0.5 - (mixedFrownLeft * 0.08); // Reduced from 0.15 for subtle movement
      }
      if (rightEyeRef.current) {
        rightEyeRef.current.scale.y = Math.max(0.1, wideRightScale - currentRightEye.current * 1.5);
        rightEyeRef.current.position.y = 0.5 - (mixedFrownRight * 0.08); // Reduced from 0.15 for subtle movement
      }

      // Mouth Cavity Smile Logic
      if (mouthCavityRef.current) {
        // Widen horizontally & lift slightly when smiling
        mouthCavityRef.current.scale.x = 1 + (currentSmile.current * 0.2);
        mouthCavityRef.current.position.y = 0.75 + (currentSmile.current * 0.1);
      }

      if (leftSmileCornerRef.current && rightSmileCornerRef.current) {
        // The scale of the corners creates the "U" shape of the smile
        const cornerScale = Math.max(0.001, currentSmile.current * 1.5);
        leftSmileCornerRef.current.scale.y = cornerScale;
        rightSmileCornerRef.current.scale.y = cornerScale;

        // Move corners outward to match the widened mouth cavity
        const cornerX = 1.5 + (currentSmile.current * 0.25);
        leftSmileCornerRef.current.position.x = cornerX;
        rightSmileCornerRef.current.position.x = -cornerX;

        // Base Y is 1.0 (touches top of mouth cavity)
        // Lift slightly to match the lifted mouth cavity
        const cornerY = 1.0 + (currentSmile.current * 0.1);
        leftSmileCornerRef.current.position.y = cornerY;
        rightSmileCornerRef.current.position.y = cornerY;
      }

      // Frown Corners (with asymmetry)
      if (leftFrownCornerRef.current && rightFrownCornerRef.current) {
        // We use mixedFrownLeft and mixedFrownRight which already contain natural + mathematical asymmetry
        const frownLeftScale = Math.max(0.001, mixedFrownLeft * 0.7);
        const frownRightScale = Math.max(0.001, mixedFrownRight * 0.7);

        leftFrownCornerRef.current.scale.y = frownLeftScale;
        rightFrownCornerRef.current.scale.y = frownRightScale;

        leftFrownCornerRef.current.position.x = 1.35 + (mixedFrownLeft * 0.1);
        rightFrownCornerRef.current.position.x = -(1.35 + (mixedFrownRight * 0.1));

        // Let them hang slightly differently
        leftFrownCornerRef.current.position.y = 0.5 - (mixedFrownLeft * 0.05);
        rightFrownCornerRef.current.position.y = 0.5 - (mixedFrownRight * 0.05);
      }
    }
  });

  return (
    <group ref={avatarGroupRef}>
      <group ref={headGroupRef}>
        {/* ── Upper Head (Skull + Eyes + Hair) ── */}
        <group>
          {/* Main Head Cube */}
          <mesh position={[0, 1.25, 0]}>
            <boxGeometry args={[4, 3.5, 4]} />
            <meshStandardMaterial color="#fcd5b4" roughness={0.9} /> {/* Minecraft skin tone */}
          </mesh>

          {/* Hair block layer */}
          <mesh position={[0, 3.25, 0]}>
            <boxGeometry args={[4.2, 0.8, 4.2]} />
            <meshStandardMaterial color="#2d1d13" roughness={0.9} />
          </mesh>
          {/* Back of hair */}
          <mesh position={[0, 1.25, -2.1]}>
            <boxGeometry args={[4.2, 3.5, 0.4]} />
            <meshStandardMaterial color="#2d1d13" roughness={0.9} />
          </mesh>

          {/* ── Facial Features (flush with front face at Z=2.01) ── */}
          <group position={[0, 1, 2.01]}>
            {/* Left Eye (Viewer's Right side = +X) */}
            <group ref={leftEyeRef} position={[1, 0.5, 0]}>
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.8, 0.8, 0.1]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
              <mesh position={[-0.2, 0, 0.05]}>
                <boxGeometry args={[0.4, 0.8, 0.1]} />
                <meshStandardMaterial color="#000000" />
              </mesh>
            </group>

            {/* Right Eye (Viewer's Left side = -X) */}
            <group ref={rightEyeRef} position={[-1, 0.5, 0]}>
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.8, 0.8, 0.1]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
              <mesh position={[0.2, 0, 0.05]}>
                <boxGeometry args={[0.4, 0.8, 0.1]} />
                <meshStandardMaterial color="#000000" />
              </mesh>
            </group>

            {/* Nose */}
            <mesh position={[0, -0.2, 0]}>
              <boxGeometry args={[0.8, 0.6, 0.3]} />
              <meshStandardMaterial color="#e0a37e" /> {/* Darker skin tone */}
            </mesh>
          </group>
        </group>

        {/* ── Lower Jaw Block (Mouth) ── */}
        {/* Hinge positioned at the back of the head [-0.5 Y, -1.5 Z] to act as a proper natural jaw pivot */}
        <group ref={jawRef} position={[0, -0.5, -1.5]}>
          {/* Inner group offsets the jaw shape back to its relative original center */}
          <group position={[0, -0.75, 1.5]}>
            <mesh>
              <boxGeometry args={[4, 1.5, 4]} />
              <meshStandardMaterial color="#fcd5b4" roughness={0.9} />
            </mesh>
            {/* Mouth Cavity block slightly recessed */}
            <mesh ref={mouthCavityRef} position={[0, 0.75, 1.95]}>
              <boxGeometry args={[2.5, 0.5, 0.2]} />
              <meshStandardMaterial color="#330000" />
            </mesh>

            {/* Smile Corners to create U-shape */}
            <mesh ref={leftSmileCornerRef} position={[1.5, 1.0, 1.96]}>
              <boxGeometry args={[0.5, 0.5, 0.2]} />
              <meshStandardMaterial color="#330000" />
            </mesh>
            <mesh ref={rightSmileCornerRef} position={[-1.5, 1.0, 1.96]}>
              <boxGeometry args={[0.5, 0.5, 0.2]} />
              <meshStandardMaterial color="#330000" />
            </mesh>

            {/* Frown Corners to create inverted U-shape */}
            <mesh ref={leftFrownCornerRef} position={[1.35, 0.5, 1.96]}>
              <boxGeometry args={[0.3, 0.5, 0.2]} />
              <meshStandardMaterial color="#330000" />
            </mesh>
            <mesh ref={rightFrownCornerRef} position={[-1.35, 0.5, 1.96]}>
              <boxGeometry args={[0.3, 0.5, 0.2]} />
              <meshStandardMaterial color="#330000" />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

export default function MinecraftAvatar({
  landmarks,
  transformationMatrix,
  blendshapes,
  width,
  height,
}: MinecraftAvatarProps) {
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width, height, pointerEvents: "none" }}>
      <Canvas camera={{ position: [0, 0, 12], fov: 45 }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[5, 10, 5]} intensity={2.0} castShadow />
        <MinecraftHead
          landmarks={landmarks}
          transformationMatrix={transformationMatrix}
          blendshapes={blendshapes}
        />
      </Canvas>
    </div>
  );
}

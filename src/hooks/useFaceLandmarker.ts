/**
 * useFaceLandmarker Hook
 * 
 * Initializes the MediaPipe FaceLandmarker model and provides
 * a detection function for use in a requestAnimationFrame loop.
 * 
 * Studio Animata — the living engine beneath the mesh.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

export type LandmarkerState = "idle" | "loading" | "ready" | "error";

interface UseFaceLandmarkerReturn {
  state: LandmarkerState;
  error: string | null;
  detect: (video: HTMLVideoElement, timestamp: number) => FaceLandmarkerResult | null;
}

export function useFaceLandmarker(): UseFaceLandmarkerReturn {
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const [state, setState] = useState<LandmarkerState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setState("loading");
      try {
        // Resolve the WASM fileset from CDN
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        // Create the FaceLandmarker with face mesh enabled
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });

        if (!cancelled) {
          landmarkerRef.current = landmarker;
          setState("ready");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("FaceLandmarker init failed:", err);
          setError(
            err instanceof Error
              ? err.message
              : "Failed to initialize face tracking model"
          );
          setState("error");
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
    };
  }, []);

  const detect = useCallback(
    (video: HTMLVideoElement, timestamp: number): FaceLandmarkerResult | null => {
      if (!landmarkerRef.current || state !== "ready") return null;
      try {
        return landmarkerRef.current.detectForVideo(video, timestamp);
      } catch {
        return null;
      }
    },
    [state]
  );

  return { state, error, detect };
}

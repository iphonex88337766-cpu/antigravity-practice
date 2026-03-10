/**
 * useWebcam Hook
 * 
 * Manages webcam stream acquisition and cleanup.
 * Reports clear error states for blocked/unavailable cameras.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type WebcamState = "idle" | "requesting" | "active" | "error";

interface UseWebcamReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  state: WebcamState;
  error: string | null;
  start: () => void;
}

export function useWebcam(): UseWebcamReturn {
  const videoRef = useRef<HTMLVideoElement>(null!);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<WebcamState>("idle");
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setState("active");
      }
    } catch (err) {
      console.error("Webcam error:", err);
      let message = "WEBCAM UNAVAILABLE";
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          message = "WEBCAM BLOCKED";
        } else if (err.name === "NotFoundError") {
          message = "NO WEBCAM DETECTED";
        }
      }
      setError(message);
      setState("error");
    }
  }, []);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { videoRef, state, error, start };
}
